@echo off
REM Setup script for dex-amm-evm project (Windows)

echo Setting up AMM DEX project...

REM Check if Foundry is installed
where forge >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Please install Foundry first:
    echo    Run in PowerShell: curl -L https://foundry.paradigm.xyz ^| bash
    echo    Then: foundryup
    exit /b 1
)

echo Foundry found

REM Install dependencies
echo Installing dependencies...
forge install foundry-rs/forge-std --no-commit

REM Build contracts
echo Building contracts...
forge build

REM Run tests
echo Running tests...
forge test

echo.
echo Setup complete!
echo.
echo Next steps:
echo   1. Run tests: forge test -vvv
echo   2. Deploy locally: Start anvil in one terminal, then:
echo      forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
echo   3. Run Echidna: echidna echidna/EchidnaLiquidityPool.sol --contract EchidnaLiquidityPool --config echidna/echidna.yaml
