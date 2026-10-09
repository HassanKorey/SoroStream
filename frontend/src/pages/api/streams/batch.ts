import type { NextApiRequest, NextApiResponse } from "next";
import { addStream } from "../../../lib/serverStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Method not allowed" });
  }

  const { streams, sender } = req.body;
  if (!Array.isArray(streams) || streams.length === 0) {
    return res.status(400).json({ detail: "Batch items array is required and cannot be empty" });
  }

  const createdIds: number[] = [];
  for (const s of streams) {
    const created = addStream({
      sender: sender || "GBZXN7PIRZGNMHGA728R374U10943892348GBZXN7PIRZGNMHGA728R374U",
      recipient: s.recipient,
      token: s.token,
      token_symbol: s.token?.includes("CAS3J7") ? "XLM" : "USDC",
      token_decimals: 7,
      total_amount: Number(s.amount),
      start_time: Number(s.start),
      cliff_time: Number(s.cliff),
      end_time: Number(s.end),
      revocable: Boolean(s.revocable),
    });
    createdIds.push(created.id);
  }

  return res.status(201).json({
    status: "batch_created",
    total_created: createdIds.length,
    stream_ids: createdIds,
  });
}
