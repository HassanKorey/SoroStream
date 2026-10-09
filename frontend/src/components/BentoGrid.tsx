import React from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, ShieldCheck, Zap, Coins } from "lucide-react";
import { ProtocolMetrics } from "../lib/api";

interface BentoGridProps {
  metrics: ProtocolMetrics;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 my-8">
      {/* 1. Large Hero Metric: Total Value Locked */}
      <div className="bux-card p-6 md:col-span-2 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute -right-8 -top-8 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">
              01 / PROTOCOL TVL
            </span>
          </div>
          <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Real-Time Indexer</span>
          </span>
        </div>

        <div className="my-6">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight flex items-baseline space-x-2">
            <span>{(metrics?.total_value_locked ?? 0).toLocaleString()}</span>
            <span className="text-xl sm:text-2xl text-emerald-400 font-medium">USDC / XLM</span>
          </h2>
          <p className="text-sm text-gray-400 mt-2 bux-serif-accent">
            Total capital securely locked in trustless Soroban escrow vaults.
          </p>
        </div>

        <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
          <span>Active Escrow Streams: <strong className="text-white">{metrics?.active_streams_count ?? 0}</strong></span>
          <span className="flex items-center text-emerald-400 font-medium">
            Sub-cent Stellar Fees <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </span>
        </div>
      </div>

      {/* 2. Step Card: 01 / SENDER */}
      <div className="bux-card p-6 flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
              01 / SENDER
            </span>
            <Coins className="w-5 h-5 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mt-4 tracking-tight">Deposit & Escrow</h3>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Lock any Soroban SAC asset with custom cliffs and optional revocability parameters.
          </p>
        </div>

        <div className="mt-6">
          <Link
            href="/create"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-emerald-400 group-hover:text-lime-300 transition-colors"
          >
            <span>Launch New Stream</span>
            <ArrowUpRight className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 3. Step Card: 02 / RECIPIENT */}
      <div className="bux-card p-6 flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
              02 / RECIPIENT
            </span>
            <Zap className="w-5 h-5 text-lime-400" />
          </div>
          <h3 className="text-xl font-bold text-white mt-4 tracking-tight">Per-Second Flow</h3>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Tokens continuously vest second-by-second. Claim anytime with zero unvested leakage.
          </p>
        </div>

        <div className="mt-6">
          <Link
            href="/batch"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-lime-400 group-hover:text-emerald-300 transition-colors"
          >
            <span>Batch CSV Roster</span>
            <ArrowUpRight className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 4. Stream Metrics Summary */}
      <div className="bux-card p-6 md:col-span-2 lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gradient-to-r from-surface-card to-[#0e1626]">
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">Total Streams</span>
          <p className="text-2xl font-bold text-white mt-1">{metrics?.total_streams_count ?? 0}</p>
          <span className="text-[11px] text-emerald-400">On-Chain Registered</span>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">Total Streamed</span>
          <p className="text-2xl font-bold text-white mt-1">{(metrics?.total_value_streamed ?? 0).toLocaleString()}</p>
          <span className="text-[11px] text-gray-400">Tokens In Flight</span>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">Total Claimed</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{(metrics?.total_value_claimed ?? 0).toLocaleString()}</p>
          <span className="text-[11px] text-emerald-500/80">Withdrawn by Beneficiaries</span>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">Security State</span>
          <p className="text-2xl font-bold text-white mt-1 flex items-center space-x-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Audited</span>
          </p>
          <span className="text-[11px] text-gray-400">100% Vector Verified</span>
        </div>
      </div>
    </div>
  );
};
