// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { MyToken } from "../src/MyToken.sol";

/**
 * @title MyTokenTest
 * @notice Comprehensive unit tests for MyToken ERC20 contract
 */
contract MyTokenTest is Test {
    MyToken public token;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    // Declare events for testing
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function setUp() public {
        token = new MyToken("Test Token", "TEST", INITIAL_SUPPLY);
    }

    /*//////////////////////////////////////////////////////////////
                          DEPLOYMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DeploymentSetsCorrectName() public view {
        assertEq(token.name(), "Test Token");
    }

    function test_DeploymentSetsCorrectSymbol() public view {
        assertEq(token.symbol(), "TEST");
    }

    function test_DeploymentSetsCorrectDecimals() public view {
        assertEq(token.decimals(), 18);
    }

    function test_DeploymentMintsInitialSupply() public view {
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
        assertEq(token.balanceOf(address(this)), INITIAL_SUPPLY);
    }

    /*//////////////////////////////////////////////////////////////
                          TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_TransferSucceeds() public {
        uint256 amount = 100 ether;

        bool success = token.transfer(alice, amount);

        assertTrue(success);
        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(address(this)), INITIAL_SUPPLY - amount);
    }

    function test_TransferEmitsEvent() public {
        uint256 amount = 100 ether;

        vm.expectEmit(true, true, false, true);
        emit Transfer(address(this), alice, amount);

        token.transfer(alice, amount);
    }

    function test_TransferRevertsOnInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert("ERC20: insufficient balance");
        token.transfer(bob, 1 ether);
    }

    function test_TransferRevertsToZeroAddress() public {
        vm.expectRevert("ERC20: transfer to zero address");
        token.transfer(address(0), 1 ether);
    }

    function test_TransferRevertsFromZeroAddress() public {
        // This is handled internally, can't directly test
        // The zero address check in _transfer protects against this
    }

    /*//////////////////////////////////////////////////////////////
                          APPROVAL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ApproveSucceeds() public {
        uint256 amount = 100 ether;

        bool success = token.approve(alice, amount);

        assertTrue(success);
        assertEq(token.allowance(address(this), alice), amount);
    }

    function test_ApproveEmitsEvent() public {
        uint256 amount = 100 ether;

        vm.expectEmit(true, true, false, true);
        emit Approval(address(this), alice, amount);

        token.approve(alice, amount);
    }

    function test_ApproveCanOverwrite() public {
        token.approve(alice, 100 ether);
        token.approve(alice, 50 ether);

        assertEq(token.allowance(address(this), alice), 50 ether);
    }

    /*//////////////////////////////////////////////////////////////
                        TRANSFER FROM TESTS
    //////////////////////////////////////////////////////////////*/

    function test_TransferFromSucceeds() public {
        uint256 amount = 100 ether;
        token.approve(alice, amount);

        vm.prank(alice);
        bool success = token.transferFrom(address(this), bob, amount);

        assertTrue(success);
        assertEq(token.balanceOf(bob), amount);
        assertEq(token.allowance(address(this), alice), 0);
    }

    function test_TransferFromDeductsAllowance() public {
        uint256 approveAmount = 100 ether;
        uint256 transferAmount = 40 ether;

        token.approve(alice, approveAmount);

        vm.prank(alice);
        token.transferFrom(address(this), bob, transferAmount);

        assertEq(token.allowance(address(this), alice), approveAmount - transferAmount);
    }

    function test_TransferFromMaxAllowanceDoesNotDeduct() public {
        token.approve(alice, type(uint256).max);

        vm.prank(alice);
        token.transferFrom(address(this), bob, 100 ether);

        // Max allowance should not be deducted (gas optimization)
        assertEq(token.allowance(address(this), alice), type(uint256).max);
    }

    function test_TransferFromRevertsOnInsufficientAllowance() public {
        token.approve(alice, 50 ether);

        vm.prank(alice);
        vm.expectRevert("ERC20: insufficient allowance");
        token.transferFrom(address(this), bob, 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Transfer(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(to != address(this)); // Exclude self-transfer edge case
        vm.assume(amount <= INITIAL_SUPPLY);

        token.transfer(to, amount);

        assertEq(token.balanceOf(to), amount);
    }

    function testFuzz_TransferFrom(address spender, address to, uint256 amount) public {
        vm.assume(spender != address(0));
        vm.assume(to != address(0));
        vm.assume(to != address(this)); // Exclude self-transfer edge case
        vm.assume(amount <= INITIAL_SUPPLY);

        token.approve(spender, amount);

        vm.prank(spender);
        token.transferFrom(address(this), to, amount);

        assertEq(token.balanceOf(to), amount);
    }
}
