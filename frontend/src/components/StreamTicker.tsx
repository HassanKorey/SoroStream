import React, { useState, useEffect } from "react";
import { Clock, TrendingUp, Sparkles, CheckCircle2 } from "lucide-react";
import { StreamRecord } from "../lib/api";

interface StreamTickerProps {
  stream: StreamRecord;
  onClaim?: () => void;
  isClaiming?: boolean;
}

export const StreamTicker: React.FC<StreamTickerProps> = ({
  stream,
  onClaim,
  isClaiming = false,
}) => {
  const [now, setNow] = useState<number>(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    total_amount,
    claimed_amount,
    start_time,
    cliff_time,
    end_time,
    token_decimals,
    token_symbol,
    is_cancelled,
  } = stream;

  // Decimal divisor (Stellar stroops = 10^7)
  const divisor = Math.pow(10, token_decimals || 7);
  const totalTokens = total_amount / divisor;
  const claimedTokens = claimed_amount / divisor;

  // Real-time dynamic calculation
  let unlockedTokens = 0;
  if (is_cancelled) {
    unlockedTokens = claimedTokens;
  } else if (now < cliff_time) {
    unlockedTokens = 0;
  } else if (now >= end_time) {
    unlockedTokens = totalTokens;
  } else {
    const elapsed = Math.max(0, now - start_time);
    const duration = Math.max(1, end_time - start_time);
    unlockedTokens = (totalTokens * elapsed) / duration;
  }

  const claimableTokens = Math.max(0, unlockedTokens - claimedTokens);
  const percentVested = Math.min(100, Math.max(0, (unlockedTokens / totalTokens) * 100));

  const isBeforeCliff = now < cliff_time && !is_cancelled;
  const isFullyVested = now >= end_time && !is_cancelled;

  return (
    <div className="bux-card p-6 sm:p-8 relative overflow-hidden group">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-all" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-white/10">
        <div className="flex items-center space-x-2.5">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75" />
          <h3 className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Per-Second Vesting Ticker
          </h3>
        </div>

        {/* Live status badge */}
        <div>
          {is_cancelled ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
              ● Stream Revoked
            </span>
          ) : isBeforeCliff ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ⏳ Cliff Lockup Active
            </span>
          ) : isFullyVested ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>★ 100% Vested</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block mr-1 animate-pulse" />
              <span>● Live Streaming</span>
            </span>
          )}
        </div>
      </div>

      {/* Hero Live Counter */}
      <div className="my-8">
        <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">
          Real-Time Claimable Balance
        </span>
        <div className="flex items-baseline space-x-3 mt-1">
          <div className="text-5xl sm:text-6xl font-black text-white bux-mono tracking-tight drop-shadow-sm">
            {claimableTokens.toFixed(6)}
          </div>
          <span className="text-2xl font-bold text-emerald-400">{token_symbol}</span>
        </div>
        <p className="text-xs text-gray-400 bux-serif-accent mt-2">
          Updating synchronously every Stellar ledger second.
        </p>
      </div>

      {/* Real-time Progress Bar */}
      <div className="space-y-2 my-6">
        <div className="flex justify-between text-xs text-gray-300 font-medium">
          <span>Unlocked Progress: {percentVested.toFixed(2)}%</span>
          <span>
            {unlockedTokens.toFixed(2)} / {totalTokens.toFixed(2)} {token_symbol}
          </span>
        </div>
        <div className="relative w-full h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400 transition-all duration-300 rounded-full shadow-glow-emerald"
            style={{ width: `${percentVested}%` }}
          />
        </div>
      </div>

      {/* Action Claim Section */}
      <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-gray-400 space-y-1">
          <div>
            Already Claimed: <strong className="text-white">{claimedTokens.toFixed(4)} {token_symbol}</strong>
          </div>
          <div>
            Remaining Escrow: <strong className="text-white">{(totalTokens - claimedTokens).toFixed(4)} {token_symbol}</strong>
          </div>
        </div>

        {onClaim && (
          <button
            onClick={onClaim}
            disabled={claimableTokens <= 0 || isClaiming || is_cancelled}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center space-x-2 ${
              claimableTokens > 0 && !is_cancelled
                ? "bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-400 hover:to-lime-400 text-[#090D16] shadow-glow-emerald active:scale-95 cursor-pointer"
                : "bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{isClaiming ? "Submitting Transaction..." : `Withdraw Claimable ${token_symbol}`}</span>
          </button>
        )}
      </div>
    </div>
  );
};
