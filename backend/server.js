require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Contract ABIs (simplified)
const POOL_ABI = [
  "function reserveETH() view returns (uint256)",
  "function reserveToken() view returns (uint256)",
  "function totalLiquidity() view returns (uint256)",
  "function token() view returns (address)"
];

const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

// Provider setup
const getProvider = (chainId) => {
  const rpcUrls = {
    31337: 'http://127.0.0.1:8545',
    11155111: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY'
  };
  return new ethers.JsonRpcProvider(rpcUrls[chainId] || rpcUrls[31337]);
};

// Contract addresses
const CONTRACTS = {
  31337: {
    pool: '0x61c36a8d610163660E21a8b7359e1Cac0C9133e1',
    token: '0x0165878A594ca255338adfa4d48449f69242Eb8F'
  },
  11155111: {
    pool: '', // Update after Sepolia deployment
    token: ''
  }
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get pool info
app.get('/api/pool/:chainId', async (req, res) => {
  try {
    const chainId = parseInt(req.params.chainId);
    const contracts = CONTRACTS[chainId];
    
    if (!contracts || !contracts.pool) {
      return res.status(400).json({ error: 'Chain not supported' });
    }

    const provider = getProvider(chainId);
    const poolContract = new ethers.Contract(contracts.pool, POOL_ABI, provider);
    const tokenAddress = await poolContract.token();
    const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);

    const [reserveETH, reserveToken, totalLiquidity, tokenSymbol, tokenName] = await Promise.all([
      poolContract.reserveETH(),
      poolContract.reserveToken(),
      poolContract.totalLiquidity(),
      tokenContract.symbol(),
      tokenContract.name()
    ]);

    res.json({
      chainId,
      poolAddress: contracts.pool,
      tokenAddress,
      tokenSymbol,
      tokenName,
      reserveETH: reserveETH.toString(),
      reserveToken: reserveToken.toString(),
      totalLiquidity: totalLiquidity.toString(),
      price: reserveETH > 0n ? (Number(reserveToken) / Number(reserveETH)).toString() : '0',
      tvl: (Number(reserveETH) * 2 / 1e18).toFixed(4)
    });
  } catch (err) {
    console.error('Error fetching pool:', err);
    res.status(500).json({ error: 'Failed to fetch pool data' });
  }
});

// Calculate swap output
app.get('/api/quote', (req, res) => {
  try {
    const { amountIn, reserveIn, reserveOut } = req.query;
    
    if (!amountIn || !reserveIn || !reserveOut) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const amountInBN = BigInt(amountIn);
    const reserveInBN = BigInt(reserveIn);
    const reserveOutBN = BigInt(reserveOut);

    // Calculate with 0.3% fee
    const amountInWithFee = amountInBN * 997n;
    const numerator = amountInWithFee * reserveOutBN;
    const denominator = reserveInBN * 1000n + amountInWithFee;
    const amountOut = numerator / denominator;

    // Calculate price impact
    const idealOutput = (amountInBN * reserveOutBN) / reserveInBN;
    const priceImpact = idealOutput > 0n 
      ? ((idealOutput - amountOut) * 10000n / idealOutput).toString()
      : '0';

    res.json({
      amountIn: amountIn,
      amountOut: amountOut.toString(),
      priceImpact: (Number(priceImpact) / 100).toFixed(2) + '%',
      fee: '0.3%'
    });
  } catch (err) {
    res.status(500).json({ error: 'Calculation failed' });
  }
});

// Get swap history (mock - would need indexer in production)
app.get('/api/swaps/:chainId', (req, res) => {
  // In production, this would query events from the blockchain or an indexer
  res.json({
    chainId: req.params.chainId,
    swaps: [],
    message: 'Swap history requires an event indexer (e.g., The Graph)'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`AMM DEX Backend running on port ${PORT}`);
  console.log(`API endpoints:`);
  console.log(`   GET /health`);
  console.log(`   GET /api/pool/:chainId`);
  console.log(`   GET /api/quote?amountIn=X&reserveIn=Y&reserveOut=Z`);
});
