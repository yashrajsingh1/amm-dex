# AMM DEX

Secure, gas-optimized Automated Market Maker built on EVM with Echidna invariant testing.

![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity)
![Foundry](https://img.shields.io/badge/Foundry-Latest-orange)
![Tests](https://img.shields.io/badge/Tests-56%20passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

## Demo

<p align="center">
  <img src="frontend/public/screenshot.png" alt="AMM DEX Interface" width="800"/>
</p>

## About

This is a full-stack decentralized exchange implementing the constant product AMM model (x * y = k). The project emphasizes security through property-based testing with Echidna.

**Core Features:**
- ETH/Token liquidity pools with LP tokens
- Constant product swaps with 0.3% fee
- Slippage protection on all operations
- Minimum liquidity lock to prevent inflation attacks

## Contracts

| Contract | Description |
|----------|-------------|
| `LiquidityPool.sol` | Core AMM with swap/liquidity logic |
| `Factory.sol` | Deploys and tracks pools |
| `MyToken.sol` | Test ERC20 token |

## Security

- Reentrancy guards on state-changing functions
- Checks-Effects-Interactions pattern throughout
- Integer overflow protection (Solidity 0.8.x)
- Slippage protection parameters

## Testing

### Unit Tests

```bash
forge test
```

56 tests covering swaps, liquidity operations, edge cases, and failure modes.

### Echidna Invariants

```bash
echidna echidna/EchidnaLiquidityPool.sol --contract EchidnaLiquidityPool --config echidna/echidna.yaml
```

8 invariant properties:

| Property | Description |
|----------|-------------|
| `constantProductNeverDecreases` | k only increases from fees |
| `reservesNonNegative` | Reserves are always consistent |
| `poolIsSolvent` | Actual balances >= reserves |
| `liquidityConsistency` | LP tokens don't exceed supply |
| `minimumLiquidityLocked` | 1000 tokens locked at address(0) |
| `reservesSynced` | Reserves match balances |
| `swapOutputLessThanReserve` | Can't drain in single swap |
| `feeAlwaysCollected` | Fee always taken on swaps |

## Quick Start

```bash
# Install
git clone https://github.com/yashrajsingh1/amm-dex.git
cd amm-dex
forge install

# Test
forge test -vvv

# Deploy locally
anvil
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545

# Frontend
cd frontend && npm install && npm run dev
```

## Project Structure

```
src/                 - Solidity contracts
test/                - Foundry unit tests
echidna/             - Echidna invariant tests
script/              - Deployment scripts
frontend/            - React + Vite frontend
backend/             - Express API
```

## Stack

- Solidity 0.8.20
- Foundry (forge, anvil)
- Echidna
- React + Vite + Tailwind
- ethers.js

## License

MIT
