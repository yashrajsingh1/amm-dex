import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { LIQUIDITY_POOL_ABI, ERC20_ABI, CHAINS } from '../contracts/abis';

export function useWeb3() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize provider
  useEffect(() => {
    if (window.ethereum) {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
          setSigner(null);
        }
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', (chainId) => {
        setChainId(parseInt(chainId, 16));
        window.location.reload();
      });

      // Check if already connected
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          web3Provider.getSigner().then(setSigner);
        }
      });

      // Get current chain
      window.ethereum.request({ method: 'eth_chainId' }).then((chainId) => {
        setChainId(parseInt(chainId, 16));
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask!');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const web3Signer = await web3Provider.getSigner();
        setSigner(web3Signer);
        setProvider(web3Provider);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setSigner(null);
  }, []);

  const switchChain = useCallback(async (targetChainId) => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }]
      });
    } catch (err) {
      // Chain not added, try to add it
      if (err.code === 4902 && targetChainId === 31337) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x7a69',
            chainName: 'Anvil Local',
            rpcUrls: ['http://127.0.0.1:8545'],
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18
            }
          }]
        });
      }
    }
  }, []);

  const getChainConfig = useCallback(() => {
    return CHAINS[chainId] || null;
  }, [chainId]);

  return {
    provider,
    signer,
    account,
    chainId,
    isConnecting,
    error,
    connect,
    disconnect,
    switchChain,
    getChainConfig,
    isConnected: !!account
  };
}

export function useContract(address, abi, signerOrProvider) {
  const [contract, setContract] = useState(null);

  useEffect(() => {
    if (address && abi && signerOrProvider) {
      try {
        const contractInstance = new ethers.Contract(address, abi, signerOrProvider);
        setContract(contractInstance);
      } catch (err) {
        console.error('Error creating contract:', err);
      }
    }
  }, [address, abi, signerOrProvider]);

  return contract;
}

export function usePool(poolAddress, signer, provider) {
  const [poolData, setPoolData] = useState({
    reserveETH: 0n,
    reserveToken: 0n,
    totalLiquidity: 0n,
    userLiquidity: 0n,
    tokenAddress: null,
    tokenSymbol: '',
    tokenName: '',
    userTokenBalance: 0n,
    userETHBalance: 0n,
    isLoading: true
  });

  const poolContract = useContract(poolAddress, LIQUIDITY_POOL_ABI, signer || provider);

  const fetchPoolData = useCallback(async () => {
    if (!poolContract || !provider) return;

    try {
      const [reserveETH, reserveToken, totalLiquidity, tokenAddress] = await Promise.all([
        poolContract.reserveETH(),
        poolContract.reserveToken(),
        poolContract.totalLiquidity(),
        poolContract.token()
      ]);

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [tokenSymbol, tokenName] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name()
      ]);

      let userLiquidity = 0n;
      let userTokenBalance = 0n;
      let userETHBalance = 0n;

      if (signer) {
        const userAddress = await signer.getAddress();
        [userLiquidity, userTokenBalance, userETHBalance] = await Promise.all([
          poolContract.liquidityBalance(userAddress),
          tokenContract.balanceOf(userAddress),
          provider.getBalance(userAddress)
        ]);
      }

      setPoolData({
        reserveETH,
        reserveToken,
        totalLiquidity,
        userLiquidity,
        tokenAddress,
        tokenSymbol,
        tokenName,
        userTokenBalance,
        userETHBalance,
        isLoading: false
      });
    } catch (err) {
      console.error('Error fetching pool data:', err);
      setPoolData(prev => ({ ...prev, isLoading: false }));
    }
  }, [poolContract, provider, signer]);

  useEffect(() => {
    fetchPoolData();
    
    // Set up polling
    const interval = setInterval(fetchPoolData, 10000);
    return () => clearInterval(interval);
  }, [fetchPoolData]);

  return { ...poolData, refetch: fetchPoolData, poolContract };
}

// Hook that auto-selects pool address based on chain
export function usePoolData(provider, signer, account) {
  const [chainId, setChainId] = useState(31337);
  const [poolData, setPoolData] = useState({
    reserveETH: 0n,
    reserveToken: 0n,
    totalLiquidity: 0n,
    userLiquidity: 0n,
    tokenAddress: null,
    tokenSymbol: 'MTK',
    tokenName: 'MyToken',
    userTokenBalance: 0n,
    userETHBalance: 0n,
    isLoading: true
  });
  const [poolContract, setPoolContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);

  // Get chain ID
  useEffect(() => {
    if (provider) {
      provider.getNetwork().then(network => {
        setChainId(Number(network.chainId));
      });
    }
  }, [provider]);

  // Get contract addresses based on chain
  const getContracts = useCallback(() => {
    const chain = CHAINS[chainId];
    if (!chain) return null;
    return chain.contracts;
  }, [chainId]);

  // Create contract instances
  useEffect(() => {
    const contracts = getContracts();
    if (!contracts || !provider) return;

    const signerOrProvider = signer || provider;
    const pool = new ethers.Contract(contracts.pool, LIQUIDITY_POOL_ABI, signerOrProvider);
    const token = new ethers.Contract(contracts.token, ERC20_ABI, signerOrProvider);
    
    setPoolContract(pool);
    setTokenContract(token);
  }, [provider, signer, getContracts]);

  // Fetch pool data
  const fetchPoolData = useCallback(async () => {
    if (!poolContract || !provider) return;

    try {
      const [reserveETH, reserveToken, totalLiquidity, tokenAddress] = await Promise.all([
        poolContract.reserveETH(),
        poolContract.reserveToken(),
        poolContract.totalLiquidity(),
        poolContract.token()
      ]);

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [tokenSymbol, tokenName] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name()
      ]);

      let userLiquidity = 0n;
      let userTokenBalance = 0n;
      let userETHBalance = 0n;

      if (account) {
        [userLiquidity, userTokenBalance, userETHBalance] = await Promise.all([
          poolContract.liquidityBalance(account),
          tokenContract.balanceOf(account),
          provider.getBalance(account)
        ]);
      }

      setPoolData({
        reserveETH,
        reserveToken,
        totalLiquidity,
        userLiquidity,
        tokenAddress,
        tokenSymbol,
        tokenName,
        userTokenBalance,
        userETHBalance,
        isLoading: false
      });
    } catch (err) {
      console.error('Error fetching pool data:', err);
      setPoolData(prev => ({ ...prev, isLoading: false }));
    }
  }, [poolContract, provider, account]);

  useEffect(() => {
    fetchPoolData();
    
    // Set up polling
    const interval = setInterval(fetchPoolData, 10000);
    return () => clearInterval(interval);
  }, [fetchPoolData]);

  return { poolData, poolContract, tokenContract, refetch: fetchPoolData, isLoading: poolData.isLoading };
}
