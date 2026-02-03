// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { Factory } from "../src/Factory.sol";
import { LiquidityPool } from "../src/LiquidityPool.sol";
import { MyToken } from "../src/MyToken.sol";

/**
 * @title FactoryTest
 * @notice Unit tests for the Factory contract
 */
contract FactoryTest is Test {
    Factory public factory;
    MyToken public tokenA;
    MyToken public tokenB;

    address public alice = makeAddr("alice");

    event PoolCreated(address indexed token, address indexed pool, uint256 poolIndex);

    function setUp() public {
        factory = new Factory();
        tokenA = new MyToken("Token A", "TKNA", 1_000_000 ether);
        tokenB = new MyToken("Token B", "TKNB", 1_000_000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                        CREATE POOL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CreatePoolSucceeds() public {
        address pool = factory.createPool(address(tokenA));

        assertNotEq(pool, address(0));
        assertEq(factory.getPool(address(tokenA)), pool);
        assertEq(factory.allPoolsLength(), 1);
    }

    function test_CreatePoolEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit PoolCreated(address(tokenA), address(0), 0); // Can't predict exact pool address

        factory.createPool(address(tokenA));
    }

    function test_CreatePoolSetsCorrectToken() public {
        address poolAddress = factory.createPool(address(tokenA));
        LiquidityPool pool = LiquidityPool(payable(poolAddress));

        assertEq(address(pool.token()), address(tokenA));
    }

    function test_CreateMultiplePools() public {
        address poolA = factory.createPool(address(tokenA));
        address poolB = factory.createPool(address(tokenB));

        assertNotEq(poolA, poolB);
        assertEq(factory.allPoolsLength(), 2);
        assertEq(factory.allPools(0), poolA);
        assertEq(factory.allPools(1), poolB);
    }

    function test_CreatePoolRevertsWithZeroAddress() public {
        vm.expectRevert(Factory.ZeroAddress.selector);
        factory.createPool(address(0));
    }

    function test_CreatePoolRevertsWithDuplicate() public {
        factory.createPool(address(tokenA));

        vm.expectRevert(Factory.PoolExists.selector);
        factory.createPool(address(tokenA));
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetAllPools() public {
        factory.createPool(address(tokenA));
        factory.createPool(address(tokenB));

        address[] memory pools = factory.getAllPools();

        assertEq(pools.length, 2);
    }

    function test_AllPoolsLengthStartsAtZero() public view {
        assertEq(factory.allPoolsLength(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                        INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_PoolCreatedViaFactoryWorks() public {
        // Create pool via factory
        address poolAddress = factory.createPool(address(tokenA));
        LiquidityPool pool = LiquidityPool(payable(poolAddress));

        // Add liquidity
        tokenA.transfer(alice, 100_000 ether);
        vm.deal(alice, 100 ether);

        vm.startPrank(alice);
        tokenA.approve(address(pool), 100_000 ether);
        uint256 liquidity = pool.addLiquidity{ value: 100 ether }(100_000 ether);
        vm.stopPrank();

        assertGt(liquidity, 0);
        assertEq(pool.reserveETH(), 100 ether);
        assertEq(pool.reserveToken(), 100_000 ether);
    }
}
