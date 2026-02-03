// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script, console } from "forge-std/Script.sol";
import { MyToken } from "../src/MyToken.sol";
import { LiquidityPool } from "../src/LiquidityPool.sol";
import { Factory } from "../src/Factory.sol";

/**
 * @title Deploy
 * @notice Deployment script for the AMM DEX
 *
 * Usage:
 *
 * 1. Local deployment (Anvil):
 *    anvil
 *    forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
 *
 * 2. Testnet deployment (Sepolia):
 *    forge script script/Deploy.s.sol --broadcast --rpc-url $SEPOLIA_RPC_URL --verify
 */
contract DeployScript is Script {
    // Deployment parameters
    uint256 public constant INITIAL_TOKEN_SUPPLY = 1_000_000 ether;
    uint256 public constant INITIAL_LIQUIDITY_ETH = 1 ether;
    uint256 public constant INITIAL_LIQUIDITY_TOKENS = 1000 ether;

    function run() public {
        // Get deployer private key from environment
        uint256 deployerPrivateKey =
            vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)); // Default: Anvil account 0

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== AMM DEX Deployment ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));

        // 1. Deploy Factory
        Factory factory = new Factory();
        console.log("Factory deployed at:", address(factory));

        // 2. Deploy Test Token
        MyToken token = new MyToken("AMM Test Token", "AMM", INITIAL_TOKEN_SUPPLY);
        console.log("Token deployed at:", address(token));

        // 3. Create Pool via Factory
        address poolAddress = factory.createPool(address(token));
        LiquidityPool pool = LiquidityPool(payable(poolAddress));
        console.log("Pool deployed at:", address(pool));

        // 4. Add Initial Liquidity
        token.approve(address(pool), INITIAL_LIQUIDITY_TOKENS);
        pool.addLiquidity{ value: INITIAL_LIQUIDITY_ETH }(INITIAL_LIQUIDITY_TOKENS);
        console.log("Initial liquidity added:");
        console.log("  ETH:", INITIAL_LIQUIDITY_ETH / 1e18, "ETH");
        console.log("  Tokens:", INITIAL_LIQUIDITY_TOKENS / 1e18, "tokens");

        vm.stopBroadcast();

        // Log summary
        console.log("\n=== Deployment Summary ===");
        console.log("Factory:", address(factory));
        console.log("Token:", address(token));
        console.log("Pool:", address(pool));
        console.log("Reserve ETH:", pool.reserveETH());
        console.log("Reserve Token:", pool.reserveToken());
    }
}
