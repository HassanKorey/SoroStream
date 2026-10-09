import React, { useState } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, Layers, Download } from "lucide-react";

interface BatchItem {
  recipient: string;
  token: string;
  amount: number;
  start: number;
  cliff: number;
  end: number;
  revocable: boolean;
  isValid: boolean;
  error?: string;
}

export const CsvBatchImporter: React.FC = () => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTx, setSuccessTx] = useState<string | null>(null);

  const downloadSampleCsv = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "recipient,token,amount,start_offset_days,cliff_offset_days,end_offset_days,revocable\n" +
      "GBZXN7PIRZGNMHGA728R374U10943892348GBZXN7PIRZGNMHGA728R374U,CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC,500,0,30,365,true\n" +
      "GCH4X39385NMGHA728R374U10943892348GBZXN7PIRZGNMHGA728R374U,CAS3J7GYLGXMF6TDJBBYYSE3VGSGCUGLDRBPGZAFVNCNTMACJWPH3HUB,1250,0,15,180,false\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sorostream_batch_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCsv(text);
    };
    reader.readAsText(file);
  };

  const parseCsv = (csvText: string) => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) return;

    const parsed: BatchItem[] = [];
    const now = Math.floor(Date.now() / 1000);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 7) continue;

      const [recipient, token, amountStr, startOffStr, cliffOffStr, endOffStr, revocableStr] = parts;
      const amount = parseFloat(amountStr);
      const startOff = parseInt(startOffStr, 10) || 0;
      const cliffOff = parseInt(cliffOffStr, 10) || 0;
      const endOff = parseInt(endOffStr, 10) || 30;

      const start = now + startOff * 86400;
      const cliff = now + cliffOff * 86400;
      const end = now + endOff * 86400;
      const revocable = revocableStr.toLowerCase() === "true";

      let isValid = true;
      let error = "";

      if (!recipient.startsWith("G") || recipient.length !== 56) {
        isValid = false;
        error = "Invalid Stellar recipient public key";
      } else if (isNaN(amount) || amount <= 0) {
        isValid = false;
        error = "Amount must be greater than 0";
      } else if (!(start <= cliff && cliff < end)) {
        isValid = false;
        error = "Invalid timeline: start <= cliff < end required";
      }

      parsed.push({
        recipient,
        token,
        amount,
        start,
        cliff,
        end,
        revocable,
        isValid,
        error,
      });
    }

    setItems(parsed);
  };

  const handleExecuteBatch = async () => {
    setIsSubmitting(true);
    try {
      // Simulate / execute batch call via contract / backend
      await new Promise((r) => setTimeout(r, 1800));
      setSuccessTx("0x74a9b91e...c90234");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalValidAmount = items.filter((i) => i.isValid).reduce((acc, curr) => acc + curr.amount, 0);
  const validCount = items.filter((i) => i.isValid).length;

  return (
    <div className="bux-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">
              Batch Stream Creation & CSV Importer
            </h2>
          </div>
          <p className="text-xs text-gray-400 bux-serif-accent mt-1">
            Bulk-deploy vesting escrows for DAO grants, team payroll, or token contributor distributions.
          </p>
        </div>

        <button
          onClick={downloadSampleCsv}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bux-glass hover:bg-white/10 text-xs font-semibold text-emerald-400 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download Sample CSV</span>
        </button>
      </div>

      {/* Upload Zone */}
      <div className="my-6 border-2 border-dashed border-white/10 hover:border-emerald-500/40 rounded-2xl p-8 text-center transition-colors">
        <Upload className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-white">Upload Roster CSV</h4>
        <p className="text-xs text-gray-400 mt-1">
          Select or drag and drop a formatted `.csv` recipient spreadsheet.
        </p>

        <label className="mt-4 inline-block cursor-pointer px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white border border-white/10 transition-colors">
          Browse File
          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
        </label>
        {fileName && <p className="text-xs text-emerald-400 mt-2">Loaded: {fileName}</p>}
      </div>

      {/* Summary Banner */}
      {items.length > 0 && (
        <div className="my-6 p-4 rounded-xl bux-glass border border-emerald-500/20 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-gray-400">Total Valid Recipients</span>
            <p className="text-lg font-bold text-white">
              {validCount} / {items.length} Recipients
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-400">Total Escrow Required</span>
            <p className="text-lg font-bold text-emerald-400">
              {totalValidAmount.toLocaleString()} Tokens
            </p>
          </div>
          <div>
            <button
              onClick={handleExecuteBatch}
              disabled={validCount === 0 || isSubmitting}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-400 hover:to-lime-400 text-[#090D16] shadow-glow-emerald disabled:opacity-50"
            >
              {isSubmitting ? "Submitting Atomic Batch..." : `Execute Batch (${validCount} Streams)`}
            </button>
          </div>
        </div>
      )}

      {/* Table Preview */}
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="p-3">Status</th>
                <th className="p-3">Recipient Address</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Revocable</th>
                <th className="p-3">Details / Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="p-3">
                    {item.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                  </td>
                  <td className="p-3 bux-mono">
                    {item.recipient.slice(0, 8)}...{item.recipient.slice(-8)}
                  </td>
                  <td className="p-3 font-semibold text-white">{item.amount.toLocaleString()}</td>
                  <td className="p-3">{item.revocable ? "Yes" : "No"}</td>
                  <td className="p-3 text-[11px]">
                    {item.isValid ? (
                      <span className="text-emerald-400">Valid Record</span>
                    ) : (
                      <span className="text-red-400">{item.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {successTx && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
          <strong>Batch Streams Successfully Escrowed!</strong> Transaction hash: {successTx}
        </div>
      )}
    </div>
  );
};
