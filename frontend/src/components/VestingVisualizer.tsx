import React from "react";
import { StreamRecord } from "../lib/api";
import { Calendar, AlertCircle } from "lucide-react";

interface VestingVisualizerProps {
  stream: StreamRecord;
}

export const VestingVisualizer: React.FC<VestingVisualizerProps> = ({ stream }) => {
  const { start_time, cliff_time, end_time, total_amount, token_symbol, token_decimals } = stream;
  const now = Math.floor(Date.now() / 1000);

  const divisor = Math.pow(10, token_decimals || 7);
  const totalTokens = total_amount / divisor;

  const duration = Math.max(1, end_time - start_time);
  const cliffPercent = Math.min(100, Math.max(0, ((cliff_time - start_time) / duration) * 100));
  const currentPercent = Math.min(100, Math.max(0, ((now - start_time) / duration) * 100));

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // SVG coordinates: viewBox 0 0 600 200
  // Left: x=50, Right: x=550. Bottom: y=160, Top: y=40
  const xStart = 50;
  const xEnd = 550;
  const yBottom = 160;
  const yTop = 40;

  const xCliff = xStart + ((xEnd - xStart) * cliffPercent) / 100;
  const xNow = xStart + ((xEnd - xStart) * currentPercent) / 100;
  const yNow = yBottom - ((yBottom - yTop) * currentPercent) / 100;

  return (
    <div className="bux-card p-6 sm:p-8 my-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">
            Linear Vesting Curve & Cliff Schedule
          </h3>
          <p className="text-xs text-gray-400 bux-serif-accent mt-0.5">
            Mathematical representation of token emission on Soroban.
          </p>
        </div>
        <span className="text-xs bux-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
          Duration: {Math.round(duration / 86400)} days
        </span>
      </div>

      {/* SVG Curve Visualizer */}
      <div className="w-full overflow-x-auto py-4">
        <svg viewBox="0 0 600 200" className="w-full h-auto min-w-[500px]">
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#84CC16" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={xStart} y1={yBottom} x2={xEnd} y2={yBottom} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1={xStart} y1={yTop} x2={xEnd} y2={yTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" strokeWidth="1" />

          {/* Cliff lockup zone */}
          {cliffPercent > 0 && (
            <rect
              x={xStart}
              y={yTop}
              width={xCliff - xStart}
              height={yBottom - yTop}
              fill="rgba(239, 68, 68, 0.05)"
            />
          )}

          {/* Linear vesting curve fill */}
          <polygon
            points={`${xCliff},${yBottom} ${xCliff},${yBottom - ((yBottom - yTop) * cliffPercent) / 100} ${xEnd},${yTop} ${xEnd},${yBottom}`}
            fill="url(#curveGradient)"
          />

          {/* Pre-cliff flat zero line */}
          {xCliff > xStart && (
            <line
              x1={xStart}
              y1={yBottom}
              x2={xCliff}
              y2={yBottom}
              stroke="#EF4444"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
          )}

          {/* Main linear slope line */}
          <line
            x1={xCliff}
            y1={yBottom - ((yBottom - yTop) * cliffPercent) / 100}
            x2={xEnd}
            y2={yTop}
            stroke="url(#lineGradient)"
            strokeWidth="3"
          />

          {/* Cliff milestone marker */}
          <line
            x1={xCliff}
            y1={yTop - 10}
            x2={xCliff}
            y2={yBottom}
            stroke="#F59E0B"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <circle cx={xCliff} cy={yBottom - ((yBottom - yTop) * cliffPercent) / 100} r="5" fill="#F59E0B" />
          <text x={xCliff} y={yTop - 15} fill="#F59E0B" fontSize="10" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">
            Cliff Milestone
          </text>

          {/* Current time indicator marker */}
          {now >= start_time && now <= end_time && (
            <>
              <line
                x1={xNow}
                y1={yTop}
                x2={xNow}
                y2={yBottom}
                stroke="#10B981"
                strokeWidth="1.5"
              />
              <circle cx={xNow} cy={yNow} r="6" fill="#10B981" />
              <circle cx={xNow} cy={yNow} r="10" fill="#10B981" fillOpacity="0.3" />
              <text x={xNow} y={yBottom + 20} fill="#10B981" fontSize="11" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">
                ▲ Now
              </text>
            </>
          )}

          {/* Max Cap text */}
          <text x={xEnd + 8} y={yTop + 4} fill="#9CA3AF" fontSize="10" fontFamily="sans-serif">
            100% ({totalTokens} {token_symbol})
          </text>
        </svg>
      </div>

      {/* Timeline Milestones Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/10 text-xs">
        <div className="bux-glass p-3 rounded-lg">
          <div className="flex items-center space-x-1.5 text-gray-400">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Stream Start</span>
          </div>
          <p className="font-semibold text-white mt-1">{formatDate(start_time)}</p>
          <span className="text-[10px] text-gray-500">Escrow Initiated</span>
        </div>

        <div className="bux-glass p-3 rounded-lg">
          <div className="flex items-center space-x-1.5 text-gray-400">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Cliff Unlock Date</span>
          </div>
          <p className="font-semibold text-white mt-1">{formatDate(cliff_time)}</p>
          <span className="text-[10px] text-amber-500/80">0 tokens prior to cliff</span>
        </div>

        <div className="bux-glass p-3 rounded-lg">
          <div className="flex items-center space-x-1.5 text-gray-400">
            <Calendar className="w-3.5 h-3.5 text-lime-400" />
            <span>100% Fully Vested</span>
          </div>
          <p className="font-semibold text-white mt-1">{formatDate(end_time)}</p>
          <span className="text-[10px] text-lime-500/80">100% tokens claimable</span>
        </div>
      </div>
    </div>
  );
};
