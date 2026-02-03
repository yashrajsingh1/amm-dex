// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LiquidityPool } from "./LiquidityPool.sol";
import { MyToken } from "./MyToken.sol";

/**
 * @title Factory
 * @author Yash Raj
 * @notice Factory contract for deploying new liquidity pools
 * @dev Demonstrates protocol-level thinking and architecture
 *
 * Features:
 * - Deploy new ETH/Token liquidity pools
 * - Track all deployed pools
 * - Prevent duplicate pools for same token
 * - Events for pool creation
 *
 * Security:
 * - Only one pool per token (prevents liquidity fragmentation)
 * - No admin functions (fully decentralized)
 * - Immutable pool mappings
 */
contract Factory {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping from token address to pool address
    mapping(address => address) public getPool;

    /// @notice Array of all created pools
    address[] public allPools;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event PoolCreated(address indexed token, address indexed pool, uint256 poolIndex);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error PoolExists();

    /*//////////////////////////////////////////////////////////////
                          EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new liquidity pool for a token
     * @param token The ERC20 token to create a pool for
     * @return pool The address of the newly created pool
     *
     * Security: Checks for zero address and duplicate pools
     */
    function createPool(address token) external returns (address pool) {
        if (token == address(0)) revert ZeroAddress();
        if (getPool[token] != address(0)) revert PoolExists();

        // Deploy new pool
        pool = address(new LiquidityPool(token));

        // Store pool reference
        getPool[token] = pool;
        allPools.push(pool);

        emit PoolCreated(token, pool, allPools.length - 1);
    }

    /**
     * @notice Get the total number of pools created
     * @return count Number of pools
     */
    function allPoolsLength() external view returns (uint256 count) {
        count = allPools.length;
    }

    /**
     * @notice Get all pool addresses
     * @return pools Array of all pool addresses
     */
    function getAllPools() external view returns (address[] memory pools) {
        pools = allPools;
    }
}
