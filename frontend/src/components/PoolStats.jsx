import { useMemo } from 'react';
import { ethers } from 'ethers';
import { 
  HiChartBar, 
  HiCurrencyDollar,
  HiArrowTrendingUp,
  HiBeaker,
  HiCube,
  HiShieldCheck
} from 'react-icons/hi2';
import { SiEthereum } from 'react-icons/si';

const formatNumber = (num, decimals = 4) => {
  if (!num || isNaN(num)) return '0';
  const n = parseFloat(num);
  if (n === 0) return '0';
  if (n < 0.0001) return '< 0.0001';
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
};

const formatUnits = (value, decimals = 18) => {
  try { return ethers.formatUnits(value || 0n, decimals); } catch { return '0'; }
};

export default function PoolStats({ poolData }) {
  const { reserveETH, reserveToken, totalLiquidity, tokenSymbol, tokenName, isLoading } = poolData;

  const stats = useMemo(() => {
    const price = reserveETH > 0n 
      ? formatNumber(formatUnits(reserveToken * 10n**18n / reserveETH, 18), 4)
      : '0';
    const tvl = Number(formatUnits(reserveETH * 2n, 18));

    return { price, tvl };
  }, [reserveETH, reserveToken]);

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-32 skeleton rounded" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 skeleton rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: SiEthereum,
      label: 'ETH Reserve',
      value: formatNumber(formatUnits(reserveETH, 18), 4),
      unit: 'ETH',
      color: 'from-blue-500 to-cyan-500',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400'
    },
    {
      icon: HiCube,
      label: `${tokenSymbol} Reserve`,
      value: formatNumber(formatUnits(reserveToken, 18), 2),
      unit: tokenSymbol,
      color: 'from-purple-500 to-pink-500',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400'
    },
    {
      icon: HiBeaker,
      label: 'Total Liquidity',
      value: formatNumber(formatUnits(totalLiquidity, 18), 4),
      unit: 'LP',
      color: 'from-cyan-500 to-teal-500',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400'
    },
    {
      icon: HiArrowTrendingUp,
      label: 'Price',
      value: stats.price,
      unit: `${tokenSymbol}/ETH`,
      color: 'from-green-500 to-emerald-500',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400'
    }
  ];

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Pool Analytics</h2>
          <p className="text-sm text-gray-500">Real-time pool statistics</p>
        </div>
        <div className="badge badge-success">
          <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
          Live
        </div>
      </div>

      {/* Pool Pair */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            <div className="w-12 h-12 rounded-full token-icon-eth flex items-center justify-center border-2 border-[#1a1b23] z-10">
              <SiEthereum className="text-lg text-white" />
            </div>
            <div className="w-12 h-12 rounded-full token-icon-token flex items-center justify-center border-2 border-[#1a1b23]">
              <span className="text-sm font-bold text-white">{tokenSymbol?.[0]}</span>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">ETH / {tokenSymbol}</h3>
            <p className="text-sm text-gray-400">{tokenName || 'Token'}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition">
              <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-white">
                {stat.value}
                <span className="text-sm text-gray-500 ml-1 font-normal">{stat.unit}</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* TVL Card */}
      <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <HiCurrencyDollar className="w-4 h-4" />
              Total Value Locked
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              {formatNumber(stats.tvl, 4)}
              <span className="text-lg text-gray-400 ml-2">ETH</span>
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <HiChartBar className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-6 space-y-3">
        <div className="flex justify-between items-center py-3 border-b border-white/5">
          <span className="text-gray-400 flex items-center gap-2">
            <HiShieldCheck className="w-4 h-4 text-green-400" />
            Swap Fee
          </span>
          <span className="text-white font-medium">0.3%</span>
        </div>
        <div className="flex justify-between items-center py-3 border-b border-white/5">
          <span className="text-gray-400">AMM Type</span>
          <span className="text-indigo-400 font-medium">Constant Product (x·y=k)</span>
        </div>
        <div className="flex justify-between items-center py-3">
          <span className="text-gray-400">Protocol</span>
          <span className="text-white font-medium">AMM DEX v1</span>
        </div>
      </div>

      {/* Security Badge */}
      <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <HiShieldCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-400">Security Features</p>
            <p className="text-xs text-gray-500">Reentrancy Guard • Slippage Protection • Audited</p>
          </div>
        </div>
      </div>
    </div>
  );
}
