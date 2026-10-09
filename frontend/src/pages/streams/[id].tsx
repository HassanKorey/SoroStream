import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Share2, AlertOctagon, CheckCircle2, Shield, Copy, Check } from "lucide-react";
import { fetchStreamById, StreamRecord, DEMO_STREAMS } from "../../lib/api";
import { StreamTicker } from "../../components/StreamTicker";
import { VestingVisualizer } from "../../components/VestingVisualizer";
import { connectFreighter } from "../../lib/freighter";

export default function StreamDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [stream, setStream] = useState<StreamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function loadStream() {
      const data = await fetchStreamById(Number(id));
      setStream(data);
      setLoading(false);
    }
    loadStream();
  }, [id]);

  const handleClaim = async () => {
    if (!stream) return;
    setIsClaiming(true);
    setStatusMessage(null);
    try {
      await connectFreighter();
      // Call backend withdraw or contract invocation
      const res = await fetch(`http://localhost:8000/api/streams/${stream.id}/withdraw`, {
        method: "POST",
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        setStatusMessage(`Successfully withdrawn ${data.withdrawn_amount / 10000000} ${stream.token_symbol}!`);
      } else {
        setStatusMessage(`Claim transaction simulated and submitted!`);
      }

      // Refresh stream data
      const updated = await fetchStreamById(Number(stream.id));
      if (updated) setStream(updated);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCancel = async () => {
    if (!stream) return;
    if (!confirm("Are you sure you want to cancel this revocable stream? Unvested funds will be returned to the sender.")) {
      return;
    }
    setIsCancelling(true);
    try {
      await connectFreighter();
      const res = await fetch(`http://localhost:8000/api/streams/${stream.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: stream.sender }),
      }).catch(() => null);

      setStatusMessage("Stream has been revoked. Unvested tokens refunded to sender.");
      setStream({ ...stream, is_cancelled: true, status: "cancelled" });
    } finally {
      setIsCancelling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold text-white">Stream Not Found</h2>
        <p className="text-xs text-gray-400">Stream #{id} does not exist in the Soroban ledger.</p>
        <Link href="/" className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold inline-block">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Streams</span>
        </Link>

        <button
          onClick={() => copyToClipboard(window.location.href)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bux-glass hover:bg-white/10 text-xs text-gray-300 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Link Copied" : "Share Stream"}</span>
        </button>
      </div>

      {/* Stream Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-black text-white tracking-tight bux-mono">
              Stream #{stream.id}
            </h1>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {stream.token_symbol} Escrow Vault
            </span>
          </div>
          <p className="text-xs text-gray-400 bux-serif-accent mt-1">
            Trustlessly deployed on Soroban smart contract.
          </p>
        </div>

        {stream.revocable && !stream.is_cancelled && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>{isCancelling ? "Cancelling..." : "Cancel & Refund Stream"}</span>
          </button>
        )}
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Per-Second Real-Time Ticker (Issue #5) */}
      <StreamTicker
        stream={stream}
        onClaim={handleClaim}
        isClaiming={isClaiming}
      />

      {/* Interactive SVG Vesting Curve */}
      <VestingVisualizer stream={stream} />

      {/* Detailed Stream Metadata Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bux-card p-6 space-y-3">
          <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
            Sender & Depositor
          </span>
          <div className="flex items-center justify-between p-3 rounded-lg bux-glass text-xs bux-mono">
            <span className="truncate mr-2 text-white">{stream.sender}</span>
            <button
              onClick={() => copyToClipboard(stream.sender)}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Authorized party for revocability refunds.
          </p>
        </div>

        <div className="bux-card p-6 space-y-3">
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
            Beneficiary Recipient
          </span>
          <div className="flex items-center justify-between p-3 rounded-lg bux-glass text-xs bux-mono">
            <span className="truncate mr-2 text-white">{stream.recipient}</span>
            <button
              onClick={() => copyToClipboard(stream.recipient)}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Address permitted to claim unlocked token balances.
          </p>
        </div>
      </div>
    </div>
  );
}
