import { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { 
  HiArrowsUpDown, 
  HiCog6Tooth, 
  HiArrowPath,
  HiExclamationTriangle,
  HiCheckCircle,
  HiInformationCircle
} from 'react-icons/hi2';
import { SiEthereum } from 'react-icons/si';
import { ERC20_ABI } from '../contracts/abis';
import toast from 'react-hot-toast';

const formatNumber = (num, decimals = 4) => {
  if (!num || isNaN(num)) return '0';
  const n = parseFloat(num);
  if (n === 0) return '0';
  if (n < 0.0001) return '< 0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
};

const formatUnits = (value, decimals = 18) => {
  try {
    return ethers.formatUnits(value || 0n, decimals);
  } catch {
    return '0';
  }
};

const parseUnits = (value, decimals = 18) => {
  try {
    return ethers.parseUnits(value || '0', decimals);
  } catch {
    return 0n;
  }
};

export default function SwapCard({ poolData, poolContract, signer, account, onSuccess }) {
  const [direction, setDirection] = useState('ethToToken');
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const { reserveETH, reserveToken, tokenSymbol, userETHBalance, userTokenBalance, tokenAddress } = poolData;

  // Calculate output
  const outputAmount = useMemo(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0 || !reserveETH || !reserveToken) return '0';
    
    try {
      const inputWei = parseUnits(inputAmount, 18);
      const [reserveIn, reserveOut] = direction === 'ethToToken' 
        ? [reserveETH, reserveToken] 
        : [reserveToken, reserveETH];

      if (reserveIn === 0n) return '0';

      const inputWithFee = inputWei * 997n;
      const numerator = inputWithFee * reserveOut;
      const denominator = reserveIn * 1000n + inputWithFee;
      const output = numerator / denominator;

      return formatUnits(output, 18);
    } catch {
      return '0';
    }
  }, [inputAmount, direction, reserveETH, reserveToken]);

  // Price impact
  const priceImpact = useMemo(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0 || !reserveETH || !reserveToken) return 0;

    try {
      const inputWei = parseUnits(inputAmount, 18);
      const [reserveIn, reserveOut] = direction === 'ethToToken' 
        ? [reserveETH, reserveToken] 
        : [reserveToken, reserveETH];

      if (reserveIn === 0n) return 0;

      const idealOutput = (inputWei * reserveOut) / reserveIn;
      const actualOutput = parseUnits(outputAmount, 18);

      if (idealOutput === 0n) return 0;
      return Number((idealOutput - actualOutput) * 10000n / idealOutput) / 100;
    } catch {
      return 0;
    }
  }, [inputAmount, outputAmount, direction, reserveETH, reserveToken]);

  // Exchange rate
  const rate = useMemo(() => {
    if (!reserveETH || !reserveToken || reserveETH === 0n) return '0';
    return direction === 'ethToToken'
      ? formatNumber(formatUnits(reserveToken * 10n**18n / reserveETH, 18), 4)
      : formatNumber(formatUnits(reserveETH * 10n**18n / reserveToken, 18), 6);
  }, [reserveETH, reserveToken, direction]);

  const handleSwap = async () => {
    if (!signer || !poolContract || !inputAmount) return;

    setIsSwapping(true);
    const toastId = toast.loading('Preparing swap...');

    try {
      const inputWei = parseUnits(inputAmount, 18);
      const minOutput = parseUnits(outputAmount, 18) * BigInt(Math.floor((100 - slippage) * 10)) / 1000n;

      let tx;
      if (direction === 'ethToToken') {
        toast.loading('Swapping ETH for tokens...', { id: toastId });
        tx = await poolContract.swapETHForToken(minOutput, { value: inputWei });
      } else {
        // Approve first
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(account, poolContract.target);
        
        if (allowance < inputWei) {
          setIsApproving(true);
          toast.loading('Approving tokens...', { id: toastId });
          const approveTx = await tokenContract.approve(poolContract.target, ethers.MaxUint256);
          await approveTx.wait();
          setIsApproving(false);
        }

        toast.loading('Swapping tokens for ETH...', { id: toastId });
        tx = await poolContract.swapTokenForETH(inputWei, minOutput);
      }

      toast.loading('Confirming transaction...', { id: toastId });
      await tx.wait();

      toast.success(
        <div>
          <p className="font-semibold">Swap Successful!</p>
          <p className="text-sm text-gray-400">
            {inputAmount} {direction === 'ethToToken' ? 'ETH' : tokenSymbol} → {formatNumber(outputAmount)} {direction === 'ethToToken' ? tokenSymbol : 'ETH'}
          </p>
        </div>,
        { id: toastId, duration: 5000 }
      );

      setInputAmount('');
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error(err.reason || 'Swap failed', { id: toastId });
    } finally {
      setIsSwapping(false);
      setIsApproving(false);
    }
  };

  const switchDirection = () => {
    setDirection(d => d === 'ethToToken' ? 'tokenToETH' : 'ethToToken');
    setInputAmount('');
  };

  const inputToken = direction === 'ethToToken' ? { symbol: 'ETH', balance: userETHBalance, isEth: true } : { symbol: tokenSymbol, balance: userTokenBalance, isEth: false };
  const outputToken = direction === 'ethToToken' ? { symbol: tokenSymbol, balance: userTokenBalance, isEth: false } : { symbol: 'ETH', balance: userETHBalance, isEth: true };

  const impactClass = priceImpact < 1 ? 'impact-low' : priceImpact < 3 ? 'impact-medium' : 'impact-high';
  const isHighImpact = priceImpact >= 5;

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Swap</h2>
          <p className="text-sm text-gray-500">Trade tokens instantly</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-3 rounded-xl transition ${showSettings ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}
        >
          <HiCog6Tooth className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 animate-scale-in">
          <p className="text-sm text-gray-400 mb-3">Slippage Tolerance</p>
          <div className="flex gap-2">
            {[0.1, 0.5, 1.0].map((val) => (
              <button
                key={val}
                onClick={() => setSlippage(val)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  slippage === val
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {val}%
              </button>
            ))}
            <div className="flex-1 relative">
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                className="w-full py-2 px-3 rounded-lg bg-white/5 text-white text-sm text-center input-field"
                placeholder="Custom"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
            </div>
          </div>
        </div>
      )}

      {/* Input Token */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-2">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-500">You pay</span>
          <span className="text-sm text-gray-500">
            Balance: {formatNumber(formatUnits(inputToken.balance, 18))}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl md:text-3xl font-semibold text-white outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInputAmount(formatUnits(inputToken.balance * 99n / 100n, 18))}
              className="px-2 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition"
            >
              MAX
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${inputToken.isEth ? 'token-icon-eth' : 'token-icon-token'}`}>
                {inputToken.isEth ? <SiEthereum className="text-xs" /> : <span className="text-xs">{inputToken.symbol[0]}</span>}
              </div>
              <span className="font-semibold text-white">{inputToken.symbol}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Switch Button */}
      <div className="relative h-0 flex justify-center z-10">
        <button
          onClick={switchDirection}
          className="absolute -translate-y-1/2 w-12 h-12 rounded-xl bg-[#1a1b23] border border-white/10 flex items-center justify-center text-gray-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all hover:rotate-180 duration-300"
        >
          <HiArrowsUpDown className="w-5 h-5" />
        </button>
      </div>

      {/* Output Token */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mt-2">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-500">You receive</span>
          <span className="text-sm text-gray-500">
            Balance: {formatNumber(formatUnits(outputToken.balance, 18))}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-2xl md:text-3xl font-semibold text-white">
            {parseFloat(outputAmount) > 0 ? formatNumber(outputAmount, 6) : '0.0'}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${outputToken.isEth ? 'token-icon-eth' : 'token-icon-token'}`}>
              {outputToken.isEth ? <SiEthereum className="text-xs" /> : <span className="text-xs">{outputToken.symbol[0]}</span>}
            </div>
            <span className="font-semibold text-white">{outputToken.symbol}</span>
          </div>
        </div>
      </div>

      {/* Trade Info */}
      {inputAmount && parseFloat(inputAmount) > 0 && (
        <div className="mt-4 p-4 rounded-xl bg-white/5 space-y-3 animate-fade-in">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1">
              <HiInformationCircle className="w-4 h-4" />
              Rate
            </span>
            <span className="text-white">
              1 {direction === 'ethToToken' ? 'ETH' : tokenSymbol} = {rate} {direction === 'ethToToken' ? tokenSymbol : 'ETH'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Price Impact</span>
            <span className={impactClass}>{priceImpact.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Min. Received</span>
            <span className="text-white">
              {formatNumber(parseFloat(outputAmount) * (1 - slippage / 100), 6)} {outputToken.symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Network Fee</span>
            <span className="text-white">~0.001 ETH</span>
          </div>
        </div>
      )}

      {/* High Impact Warning */}
      {isHighImpact && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 animate-scale-in">
          <HiExclamationTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">High price impact! Consider trading smaller amounts.</p>
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!account || !inputAmount || parseFloat(inputAmount) <= 0 || isSwapping}
        className={`w-full mt-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
          !account
            ? 'bg-white/5 text-gray-500 cursor-not-allowed'
            : isHighImpact
            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:shadow-lg hover:shadow-red-500/25'
            : 'btn-primary text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
      >
        <span className="flex items-center justify-center gap-2">
          {isSwapping ? (
            <>
              <HiArrowPath className="w-5 h-5 animate-spin" />
              {isApproving ? 'Approving...' : 'Swapping...'}
            </>
          ) : !account ? (
            'Connect Wallet'
          ) : !inputAmount || parseFloat(inputAmount) <= 0 ? (
            'Enter Amount'
          ) : isHighImpact ? (
            'Swap Anyway'
          ) : (
            <>
              <HiCheckCircle className="w-5 h-5" />
              Swap
            </>
          )}
        </span>
      </button>
    </div>
  );
}
