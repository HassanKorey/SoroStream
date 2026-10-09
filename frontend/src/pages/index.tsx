import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BentoGrid } from "../components/BentoGrid";
import { fetchMetrics, fetchStreams, ProtocolMetrics, StreamRecord, DEMO_STREAMS } from "../lib/api";
import { Search, Filter, ArrowUpRight, Plus, ExternalLink, ShieldAlert, Sparkles } from "lucide-react";

export default function Dashboard() {
  const [metrics, setMetrics] = useState<ProtocolMetrics>({
    total_streams_count: 3,
    active_streams_count: 1,
    completed_streams_count: 1,
    cancelled_streams_count: 0,
    total_value_locked: 5500,
    total_value_streamed: 6250,
    total_value_claimed: 500,
  });
  const [streams, setStreams] = useState<StreamRecord[]>(DEMO_STREAMS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [m, s] = await Promise.all([fetchMetrics(), fetchStreams()]);
        setMetrics(m);
        setStreams(s);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredStreams = streams.filter((st) => {
    const matchesSearch =
      st.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.token_symbol.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && st.status === statusFilter;
  });

  return (
    <div className="space-y-8">
      {/* Hero Title Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/10">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Soroban Smart Contract Linear Streaming</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            Continuous cashflow.{" "}
            <span className="bux-serif-accent text-emerald-400 font-normal">Zero friction.</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-400 mt-2 max-w-2xl leading-relaxed">
            Lock SAC tokens and stream them second-by-second to contributors, team members, and grantees on the Stellar network with mathematically guaranteed precision.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/create"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-400 hover:to-lime-400 text-[#090D16] font-bold text-xs shadow-glow-emerald flex items-center space-x-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Stream</span>
          </Link>
          <Link
            href="/batch"
            className="px-4 py-2.5 rounded-xl bux-glass hover:bg-white/10 text-white font-semibold text-xs border border-white/10 transition-colors"
          >
            <span>Batch CSV</span>
          </Link>
        </div>
      </div>

      {/* Bento Grid Metrics */}
      <BentoGrid metrics={metrics} />

      {/* Streams Explorer Section */}
      <div className="bux-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Active Escrows & Streams</h2>
            <p className="text-xs text-gray-400 bux-serif-accent mt-0.5">
              Live indexed streaming contracts on Soroban ledger.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by address or token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 w-56 sm:w-64"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="all" className="bg-[#111827]">All Status</option>
              <option value="active" className="bg-[#111827]">Active</option>
              <option value="before_cliff" className="bg-[#111827]">Cliff Lock</option>
              <option value="completed" className="bg-[#111827]">100% Vested</option>
              <option value="cancelled" className="bg-[#111827]">Revoked</option>
            </select>
          </div>
        </div>

        {/* Streams Table */}
        <div className="overflow-x-auto mt-6">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-400 uppercase tracking-wider bg-white/5 rounded-lg">
              <tr>
                <th className="p-3.5">Stream ID</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Recipient</th>
                <th className="p-3.5">Asset</th>
                <th className="p-3.5">Total Escrow</th>
                <th className="p-3.5">Claimed</th>
                <th className="p-3.5">Revocable</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {filteredStreams.map((s) => {
                const divisor = Math.pow(10, s.token_decimals || 7);
                const total = s.total_amount / divisor;
                const claimed = s.claimed_amount / divisor;

                return (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-3.5 bux-mono font-bold text-white">#{s.id}</td>
                    <td className="p-3.5">
                      {s.is_cancelled ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                          Revoked
                        </span>
                      ) : s.status === "before_cliff" ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Pre-Cliff
                        </span>
                      ) : s.status === "completed" ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ★ 100% Vested
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>● Live Stream</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 bux-mono text-gray-400">
                      {s.recipient.slice(0, 6)}...{s.recipient.slice(-6)}
                    </td>
                    <td className="p-3.5 font-semibold text-white">{s.token_symbol}</td>
                    <td className="p-3.5 text-white font-medium">
                      {total.toLocaleString()} {s.token_symbol}
                    </td>
                    <td className="p-3.5 text-emerald-400">
                      {claimed.toLocaleString()} {s.token_symbol}
                    </td>
                    <td className="p-3.5">
                      {s.revocable ? (
                        <span className="text-gray-400">Yes</span>
                      ) : (
                        <span className="text-emerald-400 font-medium">Immutable</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/streams/${s.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-gray-300 font-semibold transition-colors"
                      >
                        <span>View Ticker</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
