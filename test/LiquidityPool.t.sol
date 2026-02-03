// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { LiquidityPool } from "../src/LiquidityPool.sol";
import { MyToken } from "../src/MyToken.sol";

/**
 * @title LiquidityPoolTest
 * @notice Comprehensive unit tests for the AMM Liquidity Pool
 *
 * Test Categories:
 * 1. Deployment
 * 2. Add Liquidity
 * 3. Remove Liquidity
 * 4. Swaps (ETH -> Token, Token -> ETH)
 * 5. Edge Cases
 * 6. Security (Reentrancy, Slippage)
 * 7. Fuzz Tests
 */
contract LiquidityPoolTest is Test {
    LiquidityPool public pool;
    MyToken public token;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public attacker = makeAddr("attacker");

    uint256 public constant INITIAL_TOKEN_SUPPLY = 1_000_000 ether;
    uint256 public constant INITIAL_ETH = 100 ether;
    uint256 public constant INITIAL_TOKENS = 100_000 ether;

    event LiquidityAdded(address indexed provider, uint256 ethAmount, uint256 tokenAmount, uint256 liquidityMinted);
    event LiquidityRemoved(address indexed provider, uint256 ethAmount, uint256 tokenAmount, uint256 liquidityBurned);
    event Swap(address indexed user, uint256 ethIn, uint256 tokenIn, uint256 ethOut, uint256 tokenOut);

    function setUp() public {
        // Deploy token and pool
        token = new MyToken("Test Token", "TEST", INITIAL_TOKEN_SUPPLY);
        pool = new LiquidityPool(address(token));

        // Setup alice with tokens and ETH
        token.transfer(alice, 500_000 ether);
        vm.deal(alice, 1000 ether);

        // Setup bob with tokens and ETH
        token.transfer(bob, 100_000 ether);
        vm.deal(bob, 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          DEPLOYMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DeploymentSetsToken() public view {
        assertEq(address(pool.token()), address(token));
    }

    function test_DeploymentInitializesReservesToZero() public view {
        assertEq(pool.reserveETH(), 0);
        assertEq(pool.reserveToken(), 0);
    }

    function test_DeploymentRevertsWithZeroAddress() public {
        vm.expectRevert(LiquidityPool.ZeroAddress.selector);
        new LiquidityPool(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                        ADD LIQUIDITY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AddLiquidityFirstProvider() public {
        vm.startPrank(alice);
        token.approve(address(pool), INITIAL_TOKENS);

        uint256 liquidity = pool.addLiquidity{ value: INITIAL_ETH }(INITIAL_TOKENS);
        vm.stopPrank();

        // Check reserves updated
        assertEq(pool.reserveETH(), INITIAL_ETH);
        assertEq(pool.reserveToken(), INITIAL_TOKENS);

        // Check liquidity minted (sqrt(100 * 100000) - 1000 minimum)
        uint256 expectedLiquidity = _sqrt(INITIAL_ETH * INITIAL_TOKENS) - pool.MINIMUM_LIQUIDITY();
        assertEq(liquidity, expectedLiquidity);
        assertEq(pool.liquidityBalance(alice), expectedLiquidity);
    }

    function test_AddLiquidityEmitsEvent() public {
        vm.startPrank(alice);
        token.approve(address(pool), INITIAL_TOKENS);

        uint256 expectedLiquidity = _sqrt(INITIAL_ETH * INITIAL_TOKENS) - pool.MINIMUM_LIQUIDITY();

        vm.expectEmit(true, false, false, true);
        emit LiquidityAdded(alice, INITIAL_ETH, INITIAL_TOKENS, expectedLiquidity);

        pool.addLiquidity{ value: INITIAL_ETH }(INITIAL_TOKENS);
        vm.stopPrank();
    }

    function test_AddLiquiditySubsequentProvider() public {
        // First provider (alice)
        _addInitialLiquidity();

        // Second provider (bob)
        uint256 ethToAdd = 10 ether;
        uint256 tokensToAdd = 10_000 ether;

        vm.startPrank(bob);
        token.approve(address(pool), tokensToAdd);

        uint256 liquidityBefore = pool.totalLiquidity();
        uint256 liquidity = pool.addLiquidity{ value: ethToAdd }(tokensToAdd);
        vm.stopPrank();

        // Liquidity should be proportional
        assertGt(liquidity, 0);
        assertEq(pool.liquidityBalance(bob), liquidity);
        assertGt(pool.totalLiquidity(), liquidityBefore);
    }

    function test_AddLiquidityRevertsWithZeroETH() public {
        vm.startPrank(alice);
        token.approve(address(pool), INITIAL_TOKENS);

        vm.expectRevert(LiquidityPool.InsufficientInputAmount.selector);
        pool.addLiquidity{ value: 0 }(INITIAL_TOKENS);
        vm.stopPrank();
    }

    function test_AddLiquidityRevertsWithZeroTokens() public {
        vm.startPrank(alice);
        token.approve(address(pool), 0);

        vm.expectRevert(LiquidityPool.InsufficientInputAmount.selector);
        pool.addLiquidity{ value: INITIAL_ETH }(0);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                      REMOVE LIQUIDITY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RemoveLiquiditySucceeds() public {
        _addInitialLiquidity();

        uint256 aliceLiquidity = pool.liquidityBalance(alice);
        uint256 aliceETHBefore = alice.balance;
        uint256 aliceTokensBefore = token.balanceOf(alice);

        vm.prank(alice);
        (uint256 ethOut, uint256 tokensOut) = pool.removeLiquidity(aliceLiquidity, 0, 0);

        assertGt(ethOut, 0);
        assertGt(tokensOut, 0);
        assertEq(pool.liquidityBalance(alice), 0);
        assertEq(alice.balance, aliceETHBefore + ethOut);
        assertEq(token.balanceOf(alice), aliceTokensBefore + tokensOut);
    }

    function test_RemoveLiquidityEmitsEvent() public {
        _addInitialLiquidity();

        uint256 aliceLiquidity = pool.liquidityBalance(alice);

        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit LiquidityRemoved(alice, 0, 0, aliceLiquidity);

        pool.removeLiquidity(aliceLiquidity, 0, 0);
    }

    function test_RemoveLiquidityPartial() public {
        _addInitialLiquidity();

        uint256 aliceLiquidity = pool.liquidityBalance(alice);
        uint256 removeAmount = aliceLiquidity / 2;

        vm.prank(alice);
        pool.removeLiquidity(removeAmount, 0, 0);

        assertEq(pool.liquidityBalance(alice), aliceLiquidity - removeAmount);
    }

    function test_RemoveLiquidityRevertsWithSlippage() public {
        _addInitialLiquidity();

        uint256 aliceLiquidity = pool.liquidityBalance(alice);

        vm.prank(alice);
        vm.expectRevert(LiquidityPool.SlippageExceeded.selector);
        pool.removeLiquidity(aliceLiquidity, type(uint256).max, 0);
    }

    function test_RemoveLiquidityRevertsWithInsufficientLiquidity() public {
        _addInitialLiquidity();

        vm.prank(bob); // Bob has no liquidity
        vm.expectRevert(LiquidityPool.InsufficientLiquidity.selector);
        pool.removeLiquidity(1000, 0, 0);
    }

    /*//////////////////////////////////////////////////////////////
                          SWAP ETH -> TOKEN
    //////////////////////////////////////////////////////////////*/

    function test_SwapETHForTokenSucceeds() public {
        _addInitialLiquidity();

        uint256 ethIn = 1 ether;
        uint256 expectedOut = pool.getAmountOut(ethIn, pool.reserveETH(), pool.reserveToken());

        uint256 bobTokensBefore = token.balanceOf(bob);

        vm.prank(bob);
        uint256 tokensOut = pool.swapETHForToken{ value: ethIn }(0);

        assertEq(tokensOut, expectedOut);
        assertEq(token.balanceOf(bob), bobTokensBefore + tokensOut);
    }

    function test_SwapETHForTokenEmitsEvent() public {
        _addInitialLiquidity();

        uint256 ethIn = 1 ether;

        vm.prank(bob);
        vm.expectEmit(true, false, false, false);
        emit Swap(bob, ethIn, 0, 0, 0);

        pool.swapETHForToken{ value: ethIn }(0);
    }

    function test_SwapETHForTokenRevertsWithSlippage() public {
        _addInitialLiquidity();

        vm.prank(bob);
        vm.expectRevert(LiquidityPool.SlippageExceeded.selector);
        pool.swapETHForToken{ value: 1 ether }(type(uint256).max);
    }

    function test_SwapETHForTokenRevertsWithZeroInput() public {
        _addInitialLiquidity();

        vm.prank(bob);
        vm.expectRevert(LiquidityPool.InsufficientInputAmount.selector);
        pool.swapETHForToken{ value: 0 }(0);
    }

    function test_SwapETHForTokenRevertsWithNoLiquidity() public {
        vm.prank(bob);
        vm.expectRevert(LiquidityPool.InsufficientLiquidity.selector);
        pool.swapETHForToken{ value: 1 ether }(0);
    }

    /*//////////////////////////////////////////////////////////////
                          SWAP TOKEN -> ETH
    //////////////////////////////////////////////////////////////*/

    function test_SwapTokenForETHSucceeds() public {
        _addInitialLiquidity();

        uint256 tokenIn = 1000 ether;
        uint256 expectedOut = pool.getAmountOut(tokenIn, pool.reserveToken(), pool.reserveETH());

        uint256 bobETHBefore = bob.balance;

        vm.startPrank(bob);
        token.approve(address(pool), tokenIn);
        uint256 ethOut = pool.swapTokenForETH(tokenIn, 0);
        vm.stopPrank();

        assertEq(ethOut, expectedOut);
        assertEq(bob.balance, bobETHBefore + ethOut);
    }

    function test_SwapTokenForETHEmitsEvent() public {
        _addInitialLiquidity();

        uint256 tokenIn = 1000 ether;

        vm.startPrank(bob);
        token.approve(address(pool), tokenIn);

        vm.expectEmit(true, false, false, false);
        emit Swap(bob, 0, tokenIn, 0, 0);

        pool.swapTokenForETH(tokenIn, 0);
        vm.stopPrank();
    }

    function test_SwapTokenForETHRevertsWithSlippage() public {
        _addInitialLiquidity();

        vm.startPrank(bob);
        token.approve(address(pool), 1000 ether);

        vm.expectRevert(LiquidityPool.SlippageExceeded.selector);
        pool.swapTokenForETH(1000 ether, type(uint256).max);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                          FEE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SwapApplies0Point3PercentFee() public {
        _addInitialLiquidity();

        uint256 ethIn = 10 ether;

        // Without fee: tokensOut = (100000 * 10) / (100 + 10) = 9090.9 ether
        // With 0.3% fee: tokensOut = (100000 * 10 * 997) / (100 * 1000 + 10 * 997)
        // = 997000000 / 109970 = ~9066.1 ether

        vm.prank(bob);
        uint256 tokensOut = pool.swapETHForToken{ value: ethIn }(0);

        // Should be less than no-fee amount
        uint256 noFeeAmount = (INITIAL_TOKENS * ethIn) / (INITIAL_ETH + ethIn);
        assertLt(tokensOut, noFeeAmount);

        // Verify fee is approximately 0.3%
        uint256 feePaid = noFeeAmount - tokensOut;
        uint256 feePercentage = (feePaid * 10000) / noFeeAmount;
        assertGt(feePercentage, 25); // > 0.25%
        assertLt(feePercentage, 35); // < 0.35%
    }

    /*//////////////////////////////////////////////////////////////
                      CONSTANT PRODUCT INVARIANT
    //////////////////////////////////////////////////////////////*/

    function test_ConstantProductInvariantHoldsAfterSwap() public {
        _addInitialLiquidity();

        uint256 kBefore = pool.reserveETH() * pool.reserveToken();

        vm.prank(bob);
        pool.swapETHForToken{ value: 5 ether }(0);

        uint256 kAfter = pool.reserveETH() * pool.reserveToken();

        // k should increase or stay the same (due to fees)
        assertGe(kAfter, kBefore);
    }

    function test_ConstantProductInvariantHoldsAfterMultipleSwaps() public {
        _addInitialLiquidity();

        uint256 kBefore = pool.reserveETH() * pool.reserveToken();

        // Multiple swaps
        vm.startPrank(bob);
        token.approve(address(pool), type(uint256).max);

        pool.swapETHForToken{ value: 1 ether }(0);
        pool.swapTokenForETH(500 ether, 0);
        pool.swapETHForToken{ value: 2 ether }(0);
        pool.swapTokenForETH(1000 ether, 0);

        vm.stopPrank();

        uint256 kAfter = pool.reserveETH() * pool.reserveToken();

        // k should have increased due to accumulated fees
        assertGt(kAfter, kBefore);
    }

    /*//////////////////////////////////////////////////////////////
                            EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function test_LowLiquiditySwap() public {
        // Add minimal liquidity
        vm.startPrank(alice);
        token.approve(address(pool), 1001);
        pool.addLiquidity{ value: 1001 }(1001);
        vm.stopPrank();

        // Try small swap - should revert due to zero output from integer division
        vm.prank(bob);
        vm.expectRevert(LiquidityPool.InsufficientOutputAmount.selector);
        pool.swapETHForToken{ value: 1 }(0);

        // Slightly larger swap should work
        vm.prank(bob);
        uint256 tokensOut = pool.swapETHForToken{ value: 100 }(0);
        assertGt(tokensOut, 0);
    }

    function test_LargeSwapHighSlippage() public {
        _addInitialLiquidity();

        // Large swap (50% of reserves)
        uint256 largeEthIn = 50 ether;

        vm.prank(bob);
        uint256 tokensOut = pool.swapETHForToken{ value: largeEthIn }(0);

        // Output should be significantly less than proportional due to slippage
        uint256 proportionalOutput = (INITIAL_TOKENS * largeEthIn) / INITIAL_ETH;
        assertLt(tokensOut, proportionalOutput * 90 / 100); // More than 10% slippage
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_AddLiquidity(uint256 ethAmount, uint256 tokenAmount) public {
        ethAmount = bound(ethAmount, 1 ether, 100 ether);
        tokenAmount = bound(tokenAmount, 1000 ether, 100_000 ether);

        vm.startPrank(alice);
        token.approve(address(pool), tokenAmount);

        uint256 liquidity = pool.addLiquidity{ value: ethAmount }(tokenAmount);
        vm.stopPrank();

        assertGt(liquidity, 0);
        assertEq(pool.reserveETH(), ethAmount);
        assertEq(pool.reserveToken(), tokenAmount);
    }

    function testFuzz_SwapETHForToken(uint256 ethIn) public {
        _addInitialLiquidity();

        ethIn = bound(ethIn, 0.001 ether, 50 ether);

        uint256 expectedOut = pool.getAmountOut(ethIn, pool.reserveETH(), pool.reserveToken());

        vm.prank(bob);
        uint256 tokensOut = pool.swapETHForToken{ value: ethIn }(0);

        assertEq(tokensOut, expectedOut);
    }

    function testFuzz_SwapPreservesOrIncreasesK(uint256 ethIn) public {
        _addInitialLiquidity();

        ethIn = bound(ethIn, 0.01 ether, 10 ether);

        uint256 kBefore = pool.reserveETH() * pool.reserveToken();

        vm.prank(bob);
        pool.swapETHForToken{ value: ethIn }(0);

        uint256 kAfter = pool.reserveETH() * pool.reserveToken();

        assertGe(kAfter, kBefore);
    }

    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _addInitialLiquidity() internal {
        vm.startPrank(alice);
        token.approve(address(pool), INITIAL_TOKENS);
        pool.addLiquidity{ value: INITIAL_ETH }(INITIAL_TOKENS);
        vm.stopPrank();
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
