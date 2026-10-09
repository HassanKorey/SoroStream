import React from "react";
import Link from "next/link";
import { ArrowLeft, Layers, Users, Zap, ShieldCheck } from "lucide-react";
import { CsvBatchImporter } from "../components/CsvBatchImporter";

export default function BatchStreamPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top back link */}
      <Link
        href="/"
        className="inline-flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </Link>

      {/* Header */}
      <div>
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
          <Layers className="w-3.5 h-3.5" />
          <span>Atomic Batch Vesting (Issue #12)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Batch Stream Escrow Creation
        </h1>
        <p className="text-sm text-gray-400 bux-serif-accent mt-2 max-w-2xl">
          Upload multi-recipient CSV rosters to fund DAO contributor grants, employee token vesting, or community airdrops in a single trustless Soroban transaction.
        </p>
      </div>

      {/* Feature Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bux-card p-5">
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Zap className="w-4 h-4" />
            <span>Atomic Execution</span>
          </div>
          <p className="text-xs text-gray-300">
            All streams are validated and escrowed in a single smart contract execution, minimizing gas and transaction overhead.
          </p>
        </div>

        <div className="bux-card p-5">
          <div className="flex items-center space-x-2 text-lime-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Users className="w-4 h-4" />
            <span>Arbitrary Rosters</span>
          </div>
          <p className="text-xs text-gray-300">
            Define independent cliff periods, amounts, and revocability permissions for each recipient in the roster.
          </p>
        </div>

        <div className="bux-card p-5">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Pre-Flight Validation</span>
          </div>
          <p className="text-xs text-gray-300">
            Client-side parser verifies Stellar public key formats and math constraints before prompting Freighter signing.
          </p>
        </div>
      </div>

      {/* Main CSV Importer */}
      <CsvBatchImporter />
    </div>
  );
}
