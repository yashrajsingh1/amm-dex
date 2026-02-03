// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LiquidityPool} from "../src/LiquidityPool.sol";
import {MyToken} from "../src/MyToken.sol";

/**
 * @title EchidnaLiquidityPool
 * @notice Echidna property-based fuzzing contract for LiquidityPool
 * 
 * Invariant Testing - these properties must ALWAYS hold regardless of input sequence:
 * 
 * 1. Constant Product: k should never decrease (only increase from fees)
 * 2. No Negative Reserves: Reserves must always be >= 0
 * 3. Pool Solvency: Pool always has enough tokens to cover reserves
 * 4. Total Liquidity Consistency: Sum of user balances <= totalLiquidity
 * 5. Minimum Liquidity Lock: Address(0) always holds MINIMUM_LIQUIDITY
 * 6. Reserve Sync: Reserves match actual balances
 * 
 * How to run:
 * echidna echidna/EchidnaLiquidityPool.sol --contract EchidnaLiquidityPool --config echidna/echidna.yaml
 */
contract EchidnaLiquidityPool {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    
    LiquidityPool public pool;
    MyToken public token;
    
    // Track initial k after first liquidity add
    uint256 public initialK;
    bool public initialLiquidityAdded;
    
    // Track all liquidity providers for invariant checking
    address[] public liquidityProviders;
    mapping(address => bool) public isProvider;
    
    // Constants
    uint256 constant INITIAL_TOKEN_SUPPLY = 10_000_000 ether;
    uint256 constant INITIAL_USER_TOKENS = 1_000_000 ether;
    uint256 constant INITIAL_USER_ETH = 1000 ether;
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor() {
        // Deploy token with large supply
        token = new MyToken("Echidna Token", "ECHD", INITIAL_TOKEN_SUPPLY);
        
        // Deploy pool
        pool = new LiquidityPool(address(token));
        
        // Give this contract tokens and ETH for testing
        // Echidna will call functions from this contract
        token.transfer(address(this), INITIAL_USER_TOKENS);
    }
    
    /*//////////////////////////////////////////////////////////////
                        ECHIDNA TEST FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Add liquidity (called by Echidna)
     * @param ethAmount Amount of ETH to add
     * @param tokenAmount Amount of tokens to add
     */
    function echidna_addLiquidity(uint256 ethAmount, uint256 tokenAmount) public {
        // Bound inputs to reasonable values
        ethAmount = _bound(ethAmount, 0.001 ether, 100 ether);
        tokenAmount = _bound(tokenAmount, 1 ether, 100_000 ether);
        
        // Ensure we have enough balance
        if (address(this).balance < ethAmount) return;
        if (token.balanceOf(address(this)) < tokenAmount) return;
        
        // Approve tokens
        token.approve(address(pool), tokenAmount);
        
        // Try to add liquidity
        try pool.addLiquidity{value: ethAmount}(tokenAmount) returns (uint256 liquidity) {
            // Track initial k
            if (!initialLiquidityAdded && liquidity > 0) {
                initialK = pool.reserveETH() * pool.reserveToken();
                initialLiquidityAdded = true;
            }
            
            // Track provider
            if (!isProvider[address(this)]) {
                liquidityProviders.push(address(this));
                isProvider[address(this)] = true;
            }
        } catch {
            // Expected to fail sometimes (e.g., zero amounts)
        }
    }
    
    /**
     * @notice Remove liquidity (called by Echidna)
     * @param liquidityAmount Amount of liquidity to remove
     */
    function echidna_removeLiquidity(uint256 liquidityAmount) public {
        uint256 userLiquidity = pool.liquidityBalance(address(this));
        if (userLiquidity == 0) return;
        
        // Bound to available liquidity
        liquidityAmount = _bound(liquidityAmount, 1, userLiquidity);
        
        try pool.removeLiquidity(liquidityAmount, 0, 0) {
            // Success
        } catch {
            // Expected to fail sometimes
        }
    }
    
    /**
     * @notice Swap ETH for tokens (called by Echidna)
     * @param ethAmount Amount of ETH to swap
     */
    function echidna_swapETHForToken(uint256 ethAmount) public {
        ethAmount = _bound(ethAmount, 0.001 ether, 10 ether);
        
        if (address(this).balance < ethAmount) return;
        if (pool.reserveETH() == 0) return;
        
        try pool.swapETHForToken{value: ethAmount}(0) {
            // Success
        } catch {
            // Expected to fail sometimes
        }
    }
    
    /**
     * @notice Swap tokens for ETH (called by Echidna)
     * @param tokenAmount Amount of tokens to swap
     */
    function echidna_swapTokenForETH(uint256 tokenAmount) public {
        tokenAmount = _bound(tokenAmount, 1 ether, 10_000 ether);
        
        if (token.balanceOf(address(this)) < tokenAmount) return;
        if (pool.reserveToken() == 0) return;
        
        token.approve(address(pool), tokenAmount);
        
        try pool.swapTokenForETH(tokenAmount, 0) {
            // Success
        } catch {
            // Expected to fail sometimes
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                     INVARIANT PROPERTIES (MUST HOLD)
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice INVARIANT 1: Constant product k must never decrease
     * @dev k can only increase due to fees collected
     * 
     * Why this matters:
     * If k decreases, it means tokens are being extracted from the pool
     * without proper payment - a critical exploit!
     */
    function echidna_constantProductNeverDecreases() public view returns (bool) {
        if (!initialLiquidityAdded) return true;
        
        uint256 currentK = pool.reserveETH() * pool.reserveToken();
        
        // k should never decrease (only increase from fees)
        // Allow for some rounding tolerance
        return currentK >= initialK - 1000;
    }
    
    /**
     * @notice INVARIANT 2: Reserves must always be non-negative
     * @dev Solidity uint256 can't be negative, but we verify they're not 0 unexpectedly
     * 
     * Why this matters:
     * Zero reserves after having liquidity indicates fund extraction
     */
    function echidna_reservesNonNegative() public view returns (bool) {
        // This is always true for uint256, but we check the logic is sound
        // Reserves should either both be 0 (no liquidity) or both be > 0
        uint256 reserveETH = pool.reserveETH();
        uint256 reserveToken = pool.reserveToken();
        
        // Both zero or both non-zero
        if (reserveETH == 0) return reserveToken == 0;
        if (reserveToken == 0) return reserveETH == 0;
        return true;
    }
    
    /**
     * @notice INVARIANT 3: Pool is always solvent
     * @dev Actual balances must be >= reserves
     * 
     * Why this matters:
     * If pool promises X reserves but only has Y < X tokens,
     * users can't withdraw what they're owed
     */
    function echidna_poolIsSolvent() public view returns (bool) {
        uint256 actualETH = address(pool).balance;
        uint256 actualTokens = token.balanceOf(address(pool));
        
        uint256 reserveETH = pool.reserveETH();
        uint256 reserveToken = pool.reserveToken();
        
        // Actual balances must be at least what reserves claim
        return actualETH >= reserveETH && actualTokens >= reserveToken;
    }
    
    /**
     * @notice INVARIANT 4: Total liquidity consistency
     * @dev Sum of all user liquidity <= totalLiquidity
     * 
     * Why this matters:
     * If users have more liquidity tokens than exist,
     * they can drain the pool
     */
    function echidna_liquidityConsistency() public view returns (bool) {
        uint256 totalTracked = pool.liquidityBalance(address(0)); // Minimum locked
        
        for (uint256 i = 0; i < liquidityProviders.length; i++) {
            totalTracked += pool.liquidityBalance(liquidityProviders[i]);
        }
        
        // Tracked liquidity should not exceed total
        return totalTracked <= pool.totalLiquidity();
    }
    
    /**
     * @notice INVARIANT 5: Minimum liquidity is always locked
     * @dev Address(0) should always have MINIMUM_LIQUIDITY after first deposit
     * 
     * Why this matters:
     * Prevents inflation attacks and division by zero
     */
    function echidna_minimumLiquidityLocked() public view returns (bool) {
        if (!initialLiquidityAdded) return true;
        
        return pool.liquidityBalance(address(0)) == pool.MINIMUM_LIQUIDITY();
    }
    
    /**
     * @notice INVARIANT 6: Reserves match actual balances
     * @dev After any operation, reserves should equal actual balances
     * 
     * Why this matters:
     * Desync between reserves and balances can lead to price manipulation
     */
    function echidna_reservesSynced() public view returns (bool) {
        uint256 actualETH = address(pool).balance;
        uint256 actualTokens = token.balanceOf(address(pool));
        
        // Allow small tolerance for direct transfers
        return pool.reserveETH() == actualETH && pool.reserveToken() == actualTokens;
    }
    
    /**
     * @notice INVARIANT 7: Swap output is always less than reserve
     * @dev You can never extract more than the pool has
     * 
     * Why this matters:
     * Prevents draining the pool with a single swap
     */
    function echidna_swapOutputLessThanReserve() public view returns (bool) {
        if (pool.reserveETH() == 0 || pool.reserveToken() == 0) return true;
        
        // Test a large swap
        uint256 largeETHIn = pool.reserveETH();
        uint256 tokensOut = pool.getAmountOut(largeETHIn, pool.reserveETH(), pool.reserveToken());
        
        // Output must be less than reserve
        return tokensOut < pool.reserveToken();
    }
    
    /**
     * @notice INVARIANT 8: Fee is always collected
     * @dev Output should always be less than no-fee output
     */
    function echidna_feeAlwaysCollected() public view returns (bool) {
        if (pool.reserveETH() == 0 || pool.reserveToken() == 0) return true;
        
        uint256 ethIn = 1 ether;
        uint256 reserveETH = pool.reserveETH();
        uint256 reserveToken = pool.reserveToken();
        
        // Calculate with fee
        uint256 withFee = pool.getAmountOut(ethIn, reserveETH, reserveToken);
        
        // Calculate without fee (x * y = k formula)
        uint256 noFee = (reserveToken * ethIn) / (reserveETH + ethIn);
        
        // With fee should be strictly less
        return withFee < noFee;
    }
    
    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function _bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}
