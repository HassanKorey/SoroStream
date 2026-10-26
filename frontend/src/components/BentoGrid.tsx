import React from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, ShieldCheck, Zap, Coins, Clock, Sparkles } from "lucide-react";
import { ProtocolMetrics } from "../lib/api";

interface BentoGridProps {
  metrics: ProtocolMetrics;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ metrics }) => {
  const tvl = metrics?.total_value_locked ?? 0;
  const activeStreams = metrics?.active_streams_count ?? 0;
  const totalStreams = metrics?.total_streams_count ?? 0;
  const totalClaimed = metrics?.total_value_claimed ?? 0;
  const totalStreamed = metrics?.total_value_streamed ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 my-8">
      {/* 1. Large Hero Metric: Total Value Locked (TVL) */}
      <div className="bux-card p-6 md:col-span-2 flex flex-col justify-between relative overflow-hidden group border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/25 transition-all duration-500" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold bux-mono">
              01 / PROTOCOL TVL
            </span>
          </div>
          <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1.5 shadow-sm">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Soroban Live Escrows</span>
          </span>
        </div>

        <div className="my-6">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight flex items-baseline space-x-3">
            <span className="bux-mono">{tvl.toLocaleString()}</span>
            <span className="text-xl sm:text-2xl text-emerald-400 font-semibold">USDC / XLM</span>
          </h2>
          <p className="text-sm text-gray-400 mt-2 bux-serif-accent">
            Total capital secured in non-custodial linear vesting contracts on Stellar.
          </p>
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Active Escrow Streams:</span>
            <strong className="text-white bux-mono text-sm">{activeStreams}</strong>
          </div>
          <span className="flex items-center text-emerald-400 font-medium bux-mono">
            Finality &lt; 5s <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </span>
        </div>
      </div>

      {/* 2. Active Streams Metric Card */}
      <div className="bux-card p-6 flex flex-col justify-between group border border-white/10 hover:border-emerald-500/30 transition-all duration-300 relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold bux-mono">
              02 / ACTIVE STREAMS
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white bux-mono flex items-baseline space-x-2">
              <span>{activeStreams}</span>
              <span className="text-sm font-normal text-gray-400">/ {totalStreams} total</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Streams continuously emitting tokens to authorized Stellar accounts second-by-second.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-white/5">
          <Link
            href="/create"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-400 group-hover:text-lime-300 transition-colors"
          >
            <span>Launch New Stream</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 3. Total Claimed Yield / Beneficiary Payouts */}
      <div className="bux-card p-6 flex flex-col justify-between group border border-white/10 hover:border-lime-500/30 transition-all duration-300 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-lime-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-lime-500/20 transition-all duration-500" />
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold bux-mono">
              03 / TOTAL CLAIMED YIELD
            </span>
            <div className="w-8 h-8 rounded-lg bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-lime-400 bux-mono">
              {totalClaimed.toLocaleString()}
            </div>
            <span className="text-xs text-gray-400 font-medium">Claimed by Beneficiaries</span>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Withdrawn with zero unvested leakage directly to recipient wallet accounts.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-white/5">
          <Link
            href="/batch"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-lime-400 group-hover:text-emerald-300 transition-colors"
          >
            <span>Batch CSV Roster</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4. Stream Metrics Summary Banner */}
      <div className="bux-card p-6 md:col-span-2 lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gradient-to-r from-surface-card to-[#0e1626] border border-white/10">
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold bux-mono">Total Streams</span>
          <p className="text-2xl font-bold text-white mt-1 bux-mono">{totalStreams}</p>
          <span className="text-[11px] text-emerald-400 flex items-center space-x-1 mt-0.5">
            <Sparkles className="w-3 h-3" />
            <span>On-Chain Registered</span>
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold bux-mono">Total Streamed</span>
          <p className="text-2xl font-bold text-white mt-1 bux-mono">{totalStreamed.toLocaleString()}</p>
          <span className="text-[11px] text-gray-400">Cumulative Volume</span>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold bux-mono">Total Claimed</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1 bux-mono">{totalClaimed.toLocaleString()}</p>
          <span className="text-[11px] text-emerald-500/80">Withdrawn To Date</span>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold bux-mono">Security State</span>
          <p className="text-2xl font-bold text-white mt-1 flex items-center space-x-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-xl">Audited</span>
          </p>
          <span className="text-[11px] text-gray-400">Soroban Vector Verified</span>
        </div>
      </div>
    </div>
  );
};
