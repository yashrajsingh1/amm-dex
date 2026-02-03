// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MyToken
 * @author Yash Raj
 * @notice A simple ERC20 token for testing the AMM DEX
 * @dev Implements standard ERC20 with initial mint to deployer
 *
 * Security Considerations:
 * - Uses Solidity 0.8.x for built-in overflow protection
 * - Follows ERC20 standard exactly
 * - No external dependencies for minimized attack surface
 */
contract MyToken {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Creates a new ERC20 token and mints initial supply to deployer
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _initialSupply Initial supply to mint (in wei)
     */
    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        _mint(msg.sender, _initialSupply);
    }

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Transfer tokens to a recipient
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return success True if transfer succeeded
     */
    function transfer(address to, uint256 amount) external returns (bool success) {
        return _transfer(msg.sender, to, amount);
    }

    /**
     * @notice Approve spender to transfer tokens on behalf of caller
     * @param spender Address to approve
     * @param amount Amount to approve
     * @return success True if approval succeeded
     */
    function approve(address spender, uint256 amount) external returns (bool success) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Transfer tokens from one address to another (requires approval)
     * @param from Source address
     * @param to Destination address
     * @param amount Amount to transfer
     * @return success True if transfer succeeded
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool success) {
        uint256 currentAllowance = allowance[from][msg.sender];

        // Gas optimization: skip allowance update if set to max
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                allowance[from][msg.sender] = currentAllowance - amount;
            }
        }

        return _transfer(from, to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Internal transfer logic with all checks
     * @param from Source address
     * @param to Destination address
     * @param amount Amount to transfer
     */
    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(from != address(0), "ERC20: transfer from zero address");
        require(to != address(0), "ERC20: transfer to zero address");
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");

        unchecked {
            balanceOf[from] -= amount;
            // Cannot overflow because sum of all balances <= totalSupply
            balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
        return true;
    }

    /**
     * @dev Internal mint function
     * @param to Recipient of minted tokens
     * @param amount Amount to mint
     */
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ERC20: mint to zero address");

        totalSupply += amount;
        unchecked {
            // Cannot overflow because balanceOf[to] <= totalSupply
            balanceOf[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }
}
