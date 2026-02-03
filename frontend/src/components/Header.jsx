import { useState } from 'react';
import { HiWallet, HiBars3, HiXMark, HiArrowRightOnRectangle } from 'react-icons/hi2';
import { SiEthereum } from 'react-icons/si';

const formatAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

const chainNames = {
  1: { name: 'Ethereum', color: 'bg-blue-500' },
  11155111: { name: 'Sepolia', color: 'bg-purple-500' },
  31337: { name: 'Localhost', color: 'bg-green-500' },
};

export default function Header({ account, chainId, isConnecting, onConnect, onDisconnect }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const chain = chainNames[chainId] || { name: `Chain ${chainId}`, color: 'bg-gray-500' };

  return (
    <header className="sticky top-0 z-50 glass-strong">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 p-[2px]">
                <div className="w-full h-full rounded-2xl bg-[#12131a] flex items-center justify-center">
                  <SiEthereum className="text-2xl text-white" />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-[#12131a]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AMM DEX</h1>
              <p className="text-xs text-gray-500">Decentralized Exchange</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {['Swap', 'Pool', 'Docs'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-gray-400 hover:text-white transition-colors font-medium"
              >
                {item}
              </a>
            ))}
          </nav>

          {/* Wallet Section */}
          <div className="flex items-center gap-3">
            {/* Chain Badge */}
            {chainId && (
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <div className={`w-2 h-2 rounded-full ${chain.color}`} />
                <span className="text-sm text-gray-300">{chain.name}</span>
              </div>
            )}

            {/* Connect Button */}
            {account ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                  <div className="connected-dot" />
                  <span className="font-medium text-white">{formatAddress(account)}</span>
                </div>
                <button
                  onClick={onDisconnect}
                  className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition"
                >
                  <HiArrowRightOnRectangle className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className="btn-primary px-6 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <HiWallet className="w-5 h-5" />
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-white/5 text-gray-400"
            >
              {mobileMenuOpen ? <HiXMark className="w-6 h-6" /> : <HiBars3 className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/5 animate-fade-in">
          <div className="container mx-auto px-4 py-4 space-y-2">
            {['Swap', 'Pool', 'Docs'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="block px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
