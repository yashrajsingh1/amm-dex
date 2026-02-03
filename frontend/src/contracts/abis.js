// Contract ABIs for frontend interaction
export const FACTORY_ABI = [
  "function createPool(address token) external returns (address pool)",
  "function getPool(address token) external view returns (address)",
  "function allPools(uint256) external view returns (address)",
  "function allPoolsLength() external view returns (uint256)",
  "function getAllPools() external view returns (address[])",
  "event PoolCreated(address indexed token, address indexed pool, uint256 poolIndex)"
];

export const LIQUIDITY_POOL_ABI = [
  "function token() external view returns (address)",
  "function reserveETH() external view returns (uint256)",
  "function reserveToken() external view returns (uint256)",
  "function totalLiquidity() external view returns (uint256)",
  "function liquidityBalance(address) external view returns (uint256)",
  "function MINIMUM_LIQUIDITY() external view returns (uint256)",
  "function FEE_NUMERATOR() external view returns (uint256)",
  "function FEE_DENOMINATOR() external view returns (uint256)",
  "function addLiquidity(uint256 tokenAmount) external payable returns (uint256 liquidity)",
  "function removeLiquidity(uint256 liquidityAmount, uint256 minETH, uint256 minTokens) external returns (uint256 ethAmount, uint256 tokenAmount)",
  "function swapETHForToken(uint256 minTokensOut) external payable returns (uint256 tokensOut)",
  "function swapTokenForETH(uint256 tokenIn, uint256 minETHOut) external returns (uint256 ethOut)",
  "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256 amountOut)",
  "function getReserves() external view returns (uint256 _reserveETH, uint256 _reserveToken)",
  "function quoteAddLiquidity(uint256 ethAmount) external view returns (uint256 tokenAmount, uint256 liquidity)",
  "event LiquidityAdded(address indexed provider, uint256 ethAmount, uint256 tokenAmount, uint256 liquidityMinted)",
  "event LiquidityRemoved(address indexed provider, uint256 ethAmount, uint256 tokenAmount, uint256 liquidityBurned)",
  "event Swap(address indexed user, uint256 ethIn, uint256 tokenIn, uint256 ethOut, uint256 tokenOut)",
  "event Sync(uint256 reserveETH, uint256 reserveToken)"
];

export const ERC20_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// Deployed contract addresses (update after deployment)
export const CONTRACTS = {
  // Local Anvil addresses
  local: {
    factory: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    token: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    pool: "0x61c36a8d610163660E21a8b7359e1Cac0C9133e1"
  },
  // Sepolia testnet addresses (update after deploying to Sepolia)
  sepolia: {
    factory: "",
    token: "",
    pool: ""
  }
};

// Chain configurations
export const CHAINS = {
  31337: {
    name: "Anvil Local",
    rpcUrl: "http://127.0.0.1:8545",
    contracts: CONTRACTS.local
  },
  11155111: {
    name: "Sepolia Testnet",
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
    contracts: CONTRACTS.sepolia,
    blockExplorer: "https://sepolia.etherscan.io"
  }
};
