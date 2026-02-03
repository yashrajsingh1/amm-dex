#!/bin/bash
# Setup script for dex-amm-evm project

echo "Setting up AMM DEX project..."

# Check if Foundry is installed
if ! command -v forge &> /dev/null; then
    echo "Installing Foundry..."
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc
    foundryup
else
    echo "Foundry already installed"
fi

# Install dependencies
echo "Installing dependencies..."
forge install foundry-rs/forge-std --no-commit

# Build contracts
echo "Building contracts..."
forge build

# Run tests
echo "Running tests..."
forge test

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run tests: forge test -vvv"
echo "  2. Deploy locally: anvil (terminal 1) + forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545 (terminal 2)"
echo "  3. Run Echidna: echidna echidna/EchidnaLiquidityPool.sol --contract EchidnaLiquidityPool --config echidna/echidna.yaml"
