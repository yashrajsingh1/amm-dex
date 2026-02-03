import { HiHeart, HiCodeBracket, HiShieldCheck, HiDocumentText, HiGlobeAlt } from 'react-icons/hi2';
import { SiGithub, SiDiscord } from 'react-icons/si';

export default function Footer() {
  const links = [
    { label: 'Documentation', href: '#', icon: HiDocumentText },
    { label: 'Security', href: '#', icon: HiShieldCheck },
    { label: 'GitHub', href: '#', icon: SiGithub },
  ];

  const socials = [
    { icon: SiGithub, href: '#', label: 'GitHub' },
    { icon: HiGlobeAlt, href: '#', label: 'Website' },
    { icon: SiDiscord, href: '#', label: 'Discord' },
  ];

  return (
    <footer className="border-t border-white/5 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <HiCodeBracket className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">AMM DEX</p>
              <p className="text-xs text-gray-500">Decentralized Trading</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            {links.map((link, i) => {
              const Icon = link.icon;
              return (
                <a
                  key={i}
                  href={link.href}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </a>
              );
            })}
          </div>

          {/* Socials */}
          <div className="flex items-center gap-3">
            {socials.map((social, i) => {
              const Icon = social.icon;
              return (
                <a
                  key={i}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition"
                >
                  <Icon className="w-5 h-5" />
                </a>
              );
            })}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p className="flex items-center gap-1">
              Built with <HiHeart className="text-red-400 w-4 h-4" /> using Solidity & React
            </p>
            <p>© 2024 AMM DEX. All rights reserved.</p>
          </div>
        </div>

        {/* Protocol Info */}
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-gray-600">
          <span>0.3% Swap Fee</span>
          <span>•</span>
          <span>Constant Product AMM</span>
          <span>•</span>
          <span>Non-Custodial</span>
          <span>•</span>
          <span>100% On-Chain</span>
        </div>
      </div>
    </footer>
  );
}
