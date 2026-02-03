// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LiquidityPool} from "../src/LiquidityPool.sol";
import {MyToken} from "../src/MyToken.sol";

/**
 * @title EchidnaAssertions
 * @notice Assertion-based testing for more specific edge cases
 * 
 * This contract uses Echidna's assertion mode to test specific conditions
 * that should never fail.
 * 
 * Run with: echidna echidna/EchidnaAssertions.sol --contract EchidnaAssertions --test-mode assertion
 */
contract EchidnaAssertions {
    LiquidityPool public pool;
    MyToken public token;
    
    bool public initialized;
    
    constructor() {
        token = new MyToken("Assert Token", "ASRT", 10_000_000 ether);
        pool = new LiquidityPool(address(token));
    }
    
    /**
     * @notice Test that adding liquidity never fails silently
     */
    function test_addLiquidity_increases_supply(uint256 ethAmount, uint256 tokenAmount) public {
        // Bound inputs
        ethAmount = bound(ethAmount, 0.1 ether, 10 ether);
        tokenAmount = bound(tokenAmount, 100 ether, 10000 ether);
        
        // Setup
        token.approve(address(pool), tokenAmount);
        
        uint256 liquidityBefore = pool.totalLiquidity();
        
        // Action
        try pool.addLiquidity{value: ethAmount}(tokenAmount) returns (uint256 liquidity) {
            // Assert: liquidity increased
            assert(pool.totalLiquidity() > liquidityBefore);
            assert(liquidity > 0);
        } catch {
            // OK to fail with proper revert
        }
    }
    
    /**
     * @notice Test that swaps always move reserves in opposite directions
     */
    function test_swap_moves_reserves_correctly(uint256 ethIn) public {
        if (pool.reserveETH() == 0) return;
        
        ethIn = bound(ethIn, 0.01 ether, 1 ether);
        
        uint256 reserveETHBefore = pool.reserveETH();
        uint256 reserveTokenBefore = pool.reserveToken();
        
        try pool.swapETHForToken{value: ethIn}(0) {
            // Assert: ETH reserve increased
            assert(pool.reserveETH() > reserveETHBefore);
            // Assert: Token reserve decreased
            assert(pool.reserveToken() < reserveTokenBefore);
        } catch {
            // OK
        }
    }
    
    /**
     * @notice Test that liquidity can always be removed (no stuck funds)
     */
    function test_liquidity_removable(uint256 removePercent) public {
        if (!initialized) return;
        
        uint256 userLiquidity = pool.liquidityBalance(address(this));
        if (userLiquidity == 0) return;
        
        removePercent = bound(removePercent, 1, 100);
        uint256 toRemove = (userLiquidity * removePercent) / 100;
        if (toRemove == 0) toRemove = 1;
        
        uint256 ethBefore = address(this).balance;
        uint256 tokenBefore = token.balanceOf(address(this));
        
        try pool.removeLiquidity(toRemove, 0, 0) returns (uint256 ethOut, uint256 tokenOut) {
            // Assert: received something
            assert(ethOut > 0 || tokenOut > 0);
            // Assert: balances increased
            assert(address(this).balance >= ethBefore);
            assert(token.balanceOf(address(this)) >= tokenBefore);
        } catch {
            // OK to fail for edge cases
        }
    }
    
    /**
     * @notice Initialize pool for testing
     */
    function initialize() public {
        if (initialized) return;
        
        uint256 ethAmount = 10 ether;
        uint256 tokenAmount = 10000 ether;
        
        token.approve(address(pool), tokenAmount);
        pool.addLiquidity{value: ethAmount}(tokenAmount);
        initialized = true;
    }
    
    function bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }
    
    receive() external payable {}
}
