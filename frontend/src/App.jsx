import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import SwapCard from './components/SwapCard';
import LiquidityCard from './components/LiquidityCard';
import PoolStats from './components/PoolStats';
import Footer from './components/Footer';
import { useWeb3, usePoolData } from './hooks/useWeb3';
import { CONTRACTS } from './contracts/abis';
import { HiArrowsRightLeft, HiBeaker, HiChartBar, HiSparkles } from 'react-icons/hi2';

function App() {
  const [activeTab, setActiveTab] = useState('swap');
  const { provider, signer, account, isConnecting, error, connect, disconnect, chainId } = useWeb3();
  const { poolData, poolContract, tokenContract, refetch } = usePoolData(provider, signer, account);

  const isWrongNetwork = account && chainId !== 31337 && chainId !== 11155111;
  const handleSuccess = () => refetch();

  const tabs = [
    { id: 'swap', label: 'Swap', icon: HiArrowsRightLeft },
    { id: 'liquidity', label: 'Liquidity', icon: HiBeaker },
    { id: 'stats', label: 'Analytics', icon: HiChartBar },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-animated" />
      <div className="bg-grid" />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(18, 19, 26, 0.95)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            padding: '16px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      <Header
        account={account}
        chainId={chainId}
        isConnecting={isConnecting}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        {/* Hero */}
        <div className="text-center mb-12 md:mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <HiSparkles className="text-indigo-400" />
            <span className="text-sm text-indigo-300">Decentralized Trading Protocol</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6">
            <span className="gradient-text">Trade Tokens</span>
            <br />
            <span className="text-white">Instantly</span>
          </h1>
          
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Swap tokens, provide liquidity, and earn fees with our secure 
            <span className="text-indigo-400"> automated market maker</span> protocol.
          </p>

          <div className="flex flex-wrap justify-center gap-6 md:gap-12 mt-10">
            {[
              { value: '0.3%', label: 'Swap Fee' },
              { value: 'x·y=k', label: 'AMM Formula', gradient: true },
              { value: '100%', label: 'On-Chain' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className={`text-2xl md:text-3xl font-bold ${stat.gradient ? 'gradient-text' : 'text-white'}`}>
                  {stat.value}
                </p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {isWrongNetwork && (
          <div className="max-w-md mx-auto mb-8 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 animate-scale-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl text-yellow-400 font-bold">!</span>
              <div>
                <p className="font-medium text-yellow-400">Wrong Network</p>
                <p className="text-sm text-yellow-400/70">Switch to Localhost or Sepolia</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex justify-center mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="inline-flex p-1.5 rounded-2xl glass-strong">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 md:px-8 py-3 rounded-xl font-medium transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-lg mx-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {activeTab === 'swap' && (
            <SwapCard
              poolData={poolData}
              poolContract={poolContract}
              tokenContract={tokenContract}
              signer={signer}
              account={account}
              onSuccess={handleSuccess}
            />
          )}
          {activeTab === 'liquidity' && (
            <LiquidityCard
              poolData={poolData}
              poolContract={poolContract}
              signer={signer}
              account={account}
              onSuccess={handleSuccess}
            />
          )}
          {activeTab === 'stats' && <PoolStats poolData={poolData} />}
        </div>

        {/* Contracts */}
        <div className="max-w-2xl mx-auto mt-16">
          <details className="group">
            <summary className="flex items-center justify-center gap-2 cursor-pointer text-gray-500 hover:text-gray-300 transition">
              <span className="text-sm">View Contract Addresses</span>
              <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-4 p-6 rounded-2xl glass-strong">
              <div className="space-y-3 font-mono text-sm">
                {[
                  { label: 'Factory', address: CONTRACTS.local.factory },
                  { label: 'Token', address: CONTRACTS.local.token },
                  { label: 'Pool', address: CONTRACTS.local.pool },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-xl bg-white/5">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-indigo-400 break-all text-xs">{item.address}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
