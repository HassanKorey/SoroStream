import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Wallet, ExternalLink, Activity, PlusCircle, Layers, CheckCircle2 } from "lucide-react";
import { connectFreighter } from "../lib/freighter";

export const Navbar: React.FC = () => {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const pubKey = await connectFreighter();
      if (pubKey) {
        setWalletAddress(pubKey);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const navLinks = [
    { label: "Dashboard", href: "/", icon: Activity },
    { label: "Create Stream", href: "/create", icon: PlusCircle },
    { label: "Batch Escrows", href: "/batch", icon: Layers },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#090D16]/80 border-b border-white/10 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-lime-400 p-[1px] shadow-glow-emerald">
            <div className="w-full h-full bg-[#090D16] rounded-[11px] flex items-center justify-center">
              <span className="text-xl">🌊</span>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                SoroStream
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Soroban Testnet
              </span>
            </div>
            <p className="text-xs text-gray-400 bux-serif-accent hidden sm:block">
              Continuous cashflow. Zero friction.
            </p>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/10 text-emerald-400 border border-white/10 shadow-inner"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Wallet Connection */}
        <div className="flex items-center space-x-3">
          {walletAddress ? (
            <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bux-glass border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs bux-mono font-medium">
                {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
              </span>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="relative group overflow-hidden rounded-xl p-[1px] font-semibold text-sm transition-transform active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-300 group-hover:opacity-100 opacity-80" />
              <div className="relative px-5 py-2.5 bg-[#090D16] rounded-[11px] flex items-center space-x-2 text-white group-hover:bg-opacity-80 transition-colors">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>{isConnecting ? "Connecting..." : "Connect Freighter"}</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
