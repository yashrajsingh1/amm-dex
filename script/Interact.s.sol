// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script, console } from "forge-std/Script.sol";
import { LiquidityPool } from "../src/LiquidityPool.sol";
import { MyToken } from "../src/MyToken.sol";

/**
 * @title InteractScript
 * @notice Script for interacting with deployed contracts
 *
 * Usage:
 *    forge script script/Interact.s.sol --broadcast --rpc-url $RPC_URL
 */
contract InteractScript is Script {
    // Update these with your deployed addresses
    address public constant POOL_ADDRESS = address(0); // Update after deployment
    address public constant TOKEN_ADDRESS = address(0); // Update after deployment

    function run() public {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));

        vm.startBroadcast(deployerPrivateKey);

        LiquidityPool pool = LiquidityPool(payable(POOL_ADDRESS));
        MyToken token = MyToken(TOKEN_ADDRESS);

        console.log("=== Pool Status ===");
        console.log("Reserve ETH:", pool.reserveETH());
        console.log("Reserve Token:", pool.reserveToken());
        console.log("Total Liquidity:", pool.totalLiquidity());

        // Example: Swap 0.1 ETH for tokens
        // uint256 tokensOut = pool.swapETHForToken{value: 0.1 ether}(0);
        // console.log("Received tokens:", tokensOut);

        vm.stopBroadcast();
    }
}
