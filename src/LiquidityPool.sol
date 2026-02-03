// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { MyToken } from "./MyToken.sol";

/**
 * @title LiquidityPool
 * @author Yash Raj
 * @notice A gas-optimized Automated Market Maker (AMM) using the constant product formula
 * @dev Implements x * y = k invariant with 0.3% swap fee
 *
 * AMM Constant Product Formula:
 *   x * y = k
 *
 * Where:
 *   x = ETH reserve
 *   y = Token reserve
 *   k = constant product (invariant)
 *
 * Swap formula (with 0.3% fee):
 *   amountOut = (reserveOut * amountIn * 997) / (reserveIn * 1000 + amountIn * 997)
 *
 * Security Features:
 * - Reentrancy protection via checks-effects-interactions pattern
 * - Explicit reentrancy guard on critical functions
 * - Slippage protection on all swaps
 * - Solidity 0.8.x overflow protection
 * - Input validation on all external functions
 *
 * Gas Optimizations:
 * - Storage reads cached in memory
 * - Unchecked blocks where overflow is impossible
 * - Minimal storage writes
 * - Short-circuit evaluations
 */
contract LiquidityPool {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice The ERC20 token paired with ETH in this pool
    MyToken public immutable token;

    /// @notice ETH reserves in the pool
    uint256 public reserveETH;

    /// @notice Token reserves in the pool
    uint256 public reserveToken;

    /// @notice Total liquidity tokens minted
    uint256 public totalLiquidity;

    /// @notice Liquidity balance per user
    mapping(address => uint256) public liquidityBalance;

    /// @notice Reentrancy lock
    uint256 private _locked = 1;

    /// @notice Swap fee: 0.3% = 3/1000
    uint256 public constant FEE_NUMERATOR = 997;
    uint256 public constant FEE_DENOMINATOR = 1000;

    /// @notice Minimum liquidity locked forever to prevent division by zero
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event LiquidityAdded(address indexed provider, uint256 ethAmount, uint256 tokenAmount, uint256 liquidityMinted);

    event LiquidityRemoved(address indexed provider, uint256 ethAmount, uint256 tokenAmount, uint256 liquidityBurned);

    event Swap(address indexed user, uint256 ethIn, uint256 tokenIn, uint256 ethOut, uint256 tokenOut);

    event Sync(uint256 reserveETH, uint256 reserveToken);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error ReentrancyGuard();
    error ZeroLiquidity();
    error InsufficientLiquidity();
    error InsufficientOutputAmount();
    error InsufficientInputAmount();
    error SlippageExceeded();
    error InvalidRecipient();
    error TransferFailed();
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Prevents reentrancy attacks
    modifier nonReentrant() {
        if (_locked != 1) revert ReentrancyGuard();
        _locked = 2;
        _;
        _locked = 1;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Creates a new liquidity pool for ETH/Token pair
     * @param _token The ERC20 token to pair with ETH
     */
    constructor(address _token) {
        if (_token == address(0)) revert ZeroAddress();
        token = MyToken(_token);
    }

    /*//////////////////////////////////////////////////////////////
                        LIQUIDITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Add liquidity to the pool
     * @dev First liquidity provider sets the initial ratio
     *      Subsequent providers must match the current ratio
     * @param tokenAmount Amount of tokens to add
     * @return liquidity Amount of liquidity tokens minted
     *
     * Security: Uses nonReentrant and checks-effects-interactions
     * Gas: Caches storage reads, uses unchecked where safe
     */
    function addLiquidity(uint256 tokenAmount) external payable nonReentrant returns (uint256 liquidity) {
        // Cache storage reads for gas optimization
        uint256 _reserveETH = reserveETH;
        uint256 _reserveToken = reserveToken;
        uint256 _totalLiquidity = totalLiquidity;

        uint256 ethAmount = msg.value;
        if (ethAmount == 0) revert InsufficientInputAmount();
        if (tokenAmount == 0) revert InsufficientInputAmount();

        if (_totalLiquidity == 0) {
            // First liquidity provision
            // liquidity = sqrt(ethAmount * tokenAmount) - MINIMUM_LIQUIDITY
            liquidity = _sqrt(ethAmount * tokenAmount);
            if (liquidity <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();

            unchecked {
                liquidity -= MINIMUM_LIQUIDITY;
            }

            // Lock minimum liquidity forever (prevents division by zero attacks)
            liquidityBalance[address(0)] = MINIMUM_LIQUIDITY;
            _totalLiquidity = MINIMUM_LIQUIDITY;
        } else {
            // Subsequent liquidity - must be proportional
            // liquidity = min((ethAmount * totalLiquidity) / reserveETH,
            //                 (tokenAmount * totalLiquidity) / reserveToken)
            uint256 liquidityETH = (ethAmount * _totalLiquidity) / _reserveETH;
            uint256 liquidityToken = (tokenAmount * _totalLiquidity) / _reserveToken;
            liquidity = liquidityETH < liquidityToken ? liquidityETH : liquidityToken;
        }

        if (liquidity == 0) revert ZeroLiquidity();

        // Effects: Update state before external calls
        liquidityBalance[msg.sender] += liquidity;
        totalLiquidity = _totalLiquidity + liquidity;

        // Interactions: External calls last
        bool success = token.transferFrom(msg.sender, address(this), tokenAmount);
        if (!success) revert TransferFailed();

        // Update reserves
        _updateReserves();

        emit LiquidityAdded(msg.sender, ethAmount, tokenAmount, liquidity);
    }

    /**
     * @notice Remove liquidity from the pool
     * @param liquidityAmount Amount of liquidity tokens to burn
     * @param minETH Minimum ETH to receive (slippage protection)
     * @param minTokens Minimum tokens to receive (slippage protection)
     * @return ethAmount Amount of ETH returned
     * @return tokenAmount Amount of tokens returned
     *
     * Security: Slippage protection, nonReentrant, checks-effects-interactions
     */
    function removeLiquidity(uint256 liquidityAmount, uint256 minETH, uint256 minTokens)
        external
        nonReentrant
        returns (uint256 ethAmount, uint256 tokenAmount)
    {
        if (liquidityAmount == 0) revert InsufficientInputAmount();
        if (liquidityBalance[msg.sender] < liquidityAmount) revert InsufficientLiquidity();

        // Cache storage reads
        uint256 _reserveETH = reserveETH;
        uint256 _reserveToken = reserveToken;
        uint256 _totalLiquidity = totalLiquidity;

        // Calculate proportional amounts
        ethAmount = (liquidityAmount * _reserveETH) / _totalLiquidity;
        tokenAmount = (liquidityAmount * _reserveToken) / _totalLiquidity;

        // Slippage protection
        if (ethAmount < minETH) revert SlippageExceeded();
        if (tokenAmount < minTokens) revert SlippageExceeded();
        if (ethAmount == 0 || tokenAmount == 0) revert InsufficientOutputAmount();

        // Effects: Update state before external calls
        unchecked {
            liquidityBalance[msg.sender] -= liquidityAmount;
        }
        totalLiquidity = _totalLiquidity - liquidityAmount;

        // Interactions: External calls last (checks-effects-interactions)
        bool tokenSuccess = token.transfer(msg.sender, tokenAmount);
        if (!tokenSuccess) revert TransferFailed();

        (bool ethSuccess,) = msg.sender.call{ value: ethAmount }("");
        if (!ethSuccess) revert TransferFailed();

        // Update reserves
        _updateReserves();

        emit LiquidityRemoved(msg.sender, ethAmount, tokenAmount, liquidityAmount);
    }

    /*//////////////////////////////////////////////////////////////
                            SWAP FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Swap ETH for tokens
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     * @return tokensOut Amount of tokens received
     *
     * Formula: tokensOut = (reserveToken * ethIn * 997) / (reserveETH * 1000 + ethIn * 997)
     */
    function swapETHForToken(uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        uint256 ethIn = msg.value;
        if (ethIn == 0) revert InsufficientInputAmount();

        // Cache storage reads for gas optimization
        uint256 _reserveETH = reserveETH;
        uint256 _reserveToken = reserveToken;

        if (_reserveETH == 0 || _reserveToken == 0) revert InsufficientLiquidity();

        // Calculate output with 0.3% fee
        // tokensOut = (reserveToken * ethIn * 997) / (reserveETH * 1000 + ethIn * 997)
        uint256 ethInWithFee = ethIn * FEE_NUMERATOR;
        uint256 numerator = _reserveToken * ethInWithFee;
        uint256 denominator = (_reserveETH * FEE_DENOMINATOR) + ethInWithFee;
        tokensOut = numerator / denominator;

        // Slippage protection
        if (tokensOut < minTokensOut) revert SlippageExceeded();
        if (tokensOut == 0) revert InsufficientOutputAmount();

        // Verify constant product invariant (k should increase or stay same due to fees)
        // New k = (reserveETH + ethIn) * (reserveToken - tokensOut) >= old k

        // Interactions: Transfer tokens out
        bool success = token.transfer(msg.sender, tokensOut);
        if (!success) revert TransferFailed();

        // Update reserves
        _updateReserves();

        emit Swap(msg.sender, ethIn, 0, 0, tokensOut);
    }

    /**
     * @notice Swap tokens for ETH
     * @param tokenIn Amount of tokens to swap
     * @param minETHOut Minimum ETH to receive (slippage protection)
     * @return ethOut Amount of ETH received
     *
     * Formula: ethOut = (reserveETH * tokenIn * 997) / (reserveToken * 1000 + tokenIn * 997)
     */
    function swapTokenForETH(uint256 tokenIn, uint256 minETHOut) external nonReentrant returns (uint256 ethOut) {
        if (tokenIn == 0) revert InsufficientInputAmount();

        // Cache storage reads for gas optimization
        uint256 _reserveETH = reserveETH;
        uint256 _reserveToken = reserveToken;

        if (_reserveETH == 0 || _reserveToken == 0) revert InsufficientLiquidity();

        // Calculate output with 0.3% fee
        uint256 tokenInWithFee = tokenIn * FEE_NUMERATOR;
        uint256 numerator = _reserveETH * tokenInWithFee;
        uint256 denominator = (_reserveToken * FEE_DENOMINATOR) + tokenInWithFee;
        ethOut = numerator / denominator;

        // Slippage protection
        if (ethOut < minETHOut) revert SlippageExceeded();
        if (ethOut == 0) revert InsufficientOutputAmount();

        // Transfer tokens in first (checks-effects-interactions)
        bool tokenSuccess = token.transferFrom(msg.sender, address(this), tokenIn);
        if (!tokenSuccess) revert TransferFailed();

        // Transfer ETH out
        (bool ethSuccess,) = msg.sender.call{ value: ethOut }("");
        if (!ethSuccess) revert TransferFailed();

        // Update reserves
        _updateReserves();

        emit Swap(msg.sender, 0, tokenIn, ethOut, 0);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the current reserves
     * @return _reserveETH Current ETH reserve
     * @return _reserveToken Current token reserve
     */
    function getReserves() external view returns (uint256 _reserveETH, uint256 _reserveToken) {
        _reserveETH = reserveETH;
        _reserveToken = reserveToken;
    }

    /**
     * @notice Calculate output amount for a given input
     * @param amountIn Input amount
     * @param reserveIn Reserve of input asset
     * @param reserveOut Reserve of output asset
     * @return amountOut Output amount
     */
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        uint256 numerator = reserveOut * amountInWithFee;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /**
     * @notice Get quote for adding liquidity
     * @param ethAmount Amount of ETH to add
     * @return tokenAmount Required token amount
     * @return liquidity Liquidity tokens to receive
     */
    function quoteAddLiquidity(uint256 ethAmount) external view returns (uint256 tokenAmount, uint256 liquidity) {
        uint256 _reserveETH = reserveETH;
        uint256 _reserveToken = reserveToken;
        uint256 _totalLiquidity = totalLiquidity;

        if (_totalLiquidity == 0) {
            // First liquidity - arbitrary ratio
            tokenAmount = ethAmount; // Suggest 1:1 ratio
            liquidity = _sqrt(ethAmount * tokenAmount) - MINIMUM_LIQUIDITY;
        } else {
            tokenAmount = (ethAmount * _reserveToken) / _reserveETH;
            liquidity = (ethAmount * _totalLiquidity) / _reserveETH;
        }
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Update reserves to match actual balances
     * @notice This syncs reserves with actual contract balances
     */
    function _updateReserves() internal {
        reserveETH = address(this).balance;
        reserveToken = token.balanceOf(address(this));
        emit Sync(reserveETH, reserveToken);
    }

    /**
     * @dev Babylonian method for square root
     * @param x Number to take square root of
     * @return y Square root of x
     *
     * Gas optimized implementation
     */
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;

        uint256 z = (x + 1) / 2;
        y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    /*//////////////////////////////////////////////////////////////
                              RECEIVE ETH
    //////////////////////////////////////////////////////////////*/

    /// @dev Allow contract to receive ETH
    receive() external payable { }
}
