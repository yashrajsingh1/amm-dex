import { useState, useMemo } from 'react';
import { ethers } from 'ethers';
import { 
  HiPlus, 
  HiMinus, 
  HiArrowPath,
  HiSparkles,
  HiCheckCircle
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
  try { return ethers.formatUnits(value || 0n, decimals); } catch { return '0'; }
};

const parseUnits = (value, decimals = 18) => {
  try { return ethers.parseUnits(value || '0', decimals); } catch { return 0n; }
};

export default function LiquidityCard({ poolData, poolContract, signer, account, onSuccess }) {
  const [activeTab, setActiveTab] = useState('add');
  const [ethAmount, setEthAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { reserveETH, reserveToken, totalLiquidity, userLiquidity, tokenSymbol, userETHBalance, userTokenBalance, tokenAddress } = poolData;

  // Calculate required token when ETH changes
  const handleEthChange = (value) => {
    setEthAmount(value);
    if (!value || parseFloat(value) === 0 || !reserveETH || reserveETH === 0n) {
      setTokenAmount('');
      return;
    }
    const ethWei = parseUnits(value, 18);
    const required = (ethWei * reserveToken) / reserveETH;
    setTokenAmount(formatNumber(formatUnits(required, 18), 6));
  };

  // Pool share calculation
  const poolShare = useMemo(() => {
    if (!userLiquidity || !totalLiquidity || totalLiquidity === 0n) return 0;
    return Number(userLiquidity * 10000n / totalLiquidity) / 100;
  }, [userLiquidity, totalLiquidity]);

  // Removal amounts
  const removalAmounts = useMemo(() => {
    if (!liquidityAmount || parseFloat(liquidityAmount) === 0 || totalLiquidity === 0n) {
      return { eth: '0', token: '0' };
    }
    const liqWei = parseUnits(liquidityAmount, 18);
    return {
      eth: formatNumber(formatUnits(liqWei * reserveETH / totalLiquidity, 18), 6),
      token: formatNumber(formatUnits(liqWei * reserveToken / totalLiquidity, 18), 4)
    };
  }, [liquidityAmount, reserveETH, reserveToken, totalLiquidity]);

  const handleAddLiquidity = async () => {
    if (!signer || !poolContract || !ethAmount || !tokenAmount) return;

    setIsProcessing(true);
    const toastId = toast.loading('Adding liquidity...');

    try {
      const ethWei = parseUnits(ethAmount, 18);
      const tokenWei = parseUnits(tokenAmount, 18);

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(account, poolContract.target);

      if (allowance < tokenWei) {
        toast.loading('Approving tokens...', { id: toastId });
        const approveTx = await tokenContract.approve(poolContract.target, ethers.MaxUint256);
        await approveTx.wait();
      }

      toast.loading('Adding liquidity...', { id: toastId });
      const tx = await poolContract.addLiquidity(tokenWei, { value: ethWei });
      await tx.wait();

      toast.success(
        <div>
          <p className="font-semibold">Liquidity Added! 🎉</p>
          <p className="text-sm text-gray-400">{ethAmount} ETH + {tokenAmount} {tokenSymbol}</p>
        </div>,
        { id: toastId, duration: 5000 }
      );

      setEthAmount('');
      setTokenAmount('');
      onSuccess?.();
    } catch (err) {
      toast.error(err.reason || 'Failed to add liquidity', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!signer || !poolContract || !liquidityAmount) return;

    setIsProcessing(true);
    const toastId = toast.loading('Removing liquidity...');

    try {
      const liqWei = parseUnits(liquidityAmount, 18);
      const minEth = parseUnits(removalAmounts.eth, 18) * 99n / 100n;
      const minToken = parseUnits(removalAmounts.token, 18) * 99n / 100n;

      const tx = await poolContract.removeLiquidity(liqWei, minEth, minToken);
      await tx.wait();

      toast.success(
        <div>
          <p className="font-semibold">Liquidity Removed!</p>
          <p className="text-sm text-gray-400">Received {removalAmounts.eth} ETH + {removalAmounts.token} {tokenSymbol}</p>
        </div>,
        { id: toastId, duration: 5000 }
      );

      setLiquidityAmount('');
      onSuccess?.();
    } catch (err) {
      toast.error(err.reason || 'Failed to remove liquidity', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Liquidity</h2>
        <p className="text-sm text-gray-500">Add or remove liquidity to earn fees</p>
      </div>

      {/* Tabs */}
      <div className="flex p-1 rounded-xl bg-white/5 mb-6">
        {[
          { id: 'add', label: 'Add', icon: HiPlus },
          { id: 'remove', label: 'Remove', icon: HiMinus },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Position Card */}
      {userLiquidity > 0n && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HiSparkles className="text-indigo-400" />
              <span className="text-sm text-gray-400">Your Position</span>
            </div>
            <span className="text-sm font-medium text-indigo-400">{poolShare.toFixed(4)}% of pool</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">LP Tokens</p>
              <p className="text-lg font-bold text-white">{formatNumber(formatUnits(userLiquidity, 18), 4)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Value</p>
              <p className="text-lg font-bold text-white">
                {totalLiquidity > 0n ? formatNumber(formatUnits((userLiquidity * reserveETH * 2n) / totalLiquidity, 18), 4) : '0'} ETH
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'add' ? (
        <>
          {/* ETH Input */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-3">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-500">ETH Amount</span>
              <span className="text-sm text-gray-500">Balance: {formatNumber(formatUnits(userETHBalance, 18))}</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={ethAmount}
                onChange={(e) => handleEthChange(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl font-semibold text-white outline-none"
              />
              <button
                onClick={() => handleEthChange(formatUnits(userETHBalance * 99n / 100n, 18))}
                className="px-2 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded-lg"
              >
                MAX
              </button>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
                <div className="w-6 h-6 rounded-full token-icon-eth flex items-center justify-center">
                  <SiEthereum className="text-xs text-white" />
                </div>
                <span className="font-semibold text-white">ETH</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500">
              <HiPlus />
            </div>
          </div>

          {/* Token Input */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 mt-3">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-500">{tokenSymbol} Amount</span>
              <span className="text-sm text-gray-500">Balance: {formatNumber(formatUnits(userTokenBalance, 18))}</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={tokenAmount}
                readOnly
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl font-semibold text-white outline-none"
              />
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
                <div className="w-6 h-6 rounded-full token-icon-token flex items-center justify-center">
                  <span className="text-xs text-white">{tokenSymbol?.[0]}</span>
                </div>
                <span className="font-semibold text-white">{tokenSymbol}</span>
              </div>
            </div>
          </div>

          {ethAmount && tokenAmount && (
            <div className="mt-4 p-4 rounded-xl bg-white/5 space-y-2 text-sm animate-fade-in">
              <div className="flex justify-between">
                <span className="text-gray-500">Pool Rate</span>
                <span className="text-white">1 ETH = {reserveETH > 0n ? formatNumber(formatUnits(reserveToken * 10n**18n / reserveETH, 18), 2) : '0'} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Share of Pool</span>
                <span className="text-indigo-400">
                  {((parseFloat(ethAmount) / (parseFloat(ethAmount) + Number(formatUnits(reserveETH, 18)))) * 100).toFixed(4)}%
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleAddLiquidity}
            disabled={!account || !ethAmount || !tokenAmount || isProcessing}
            className="w-full mt-6 py-4 rounded-xl font-semibold btn-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-2">
              {isProcessing ? (
                <><HiArrowPath className="w-5 h-5 animate-spin" /> Processing...</>
              ) : !account ? (
                'Connect Wallet'
              ) : (
                <><HiCheckCircle className="w-5 h-5" /> Add Liquidity</>
              )}
            </span>
          </button>
        </>
      ) : (
        <>
          {/* LP Input */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-500">LP Tokens</span>
              <span className="text-sm text-gray-500">Balance: {formatNumber(formatUnits(userLiquidity, 18))}</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={liquidityAmount}
                onChange={(e) => setLiquidityAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl font-semibold text-white outline-none"
              />
              <button
                onClick={() => setLiquidityAmount(formatUnits(userLiquidity, 18))}
                className="px-2 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded-lg"
              >
                MAX
              </button>
              <span className="px-3 py-2 rounded-xl bg-white/10 font-semibold text-white">LP</span>
            </div>
          </div>

          {/* Percentage Buttons */}
          <div className="flex gap-2 mt-4">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => setLiquidityAmount(formatUnits(userLiquidity * BigInt(pct) / 100n, 18))}
                className="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition font-medium"
              >
                {pct}%
              </button>
            ))}
          </div>

          {liquidityAmount && parseFloat(liquidityAmount) > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-white/5 animate-fade-in">
              <p className="text-sm text-gray-400 mb-3">You will receive:</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full token-icon-eth flex items-center justify-center">
                      <SiEthereum className="text-xs" />
                    </div>
                    <span className="text-white font-medium">{removalAmounts.eth}</span>
                  </div>
                  <span className="text-gray-500">ETH</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full token-icon-token flex items-center justify-center">
                      <span className="text-xs">{tokenSymbol?.[0]}</span>
                    </div>
                    <span className="text-white font-medium">{removalAmounts.token}</span>
                  </div>
                  <span className="text-gray-500">{tokenSymbol}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleRemoveLiquidity}
            disabled={!account || !liquidityAmount || userLiquidity === 0n || isProcessing}
            className="w-full mt-6 py-4 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-orange-500 text-white hover:shadow-lg hover:shadow-red-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-2">
              {isProcessing ? (
                <><HiArrowPath className="w-5 h-5 animate-spin" /> Processing...</>
              ) : userLiquidity === 0n ? (
                'No Liquidity'
              ) : (
                <><HiMinus className="w-5 h-5" /> Remove Liquidity</>
              )}
            </span>
          </button>
        </>
      )}
    </div>
  );
}
