import type { NextApiRequest, NextApiResponse } from "next";
import { getAllStreams, addStream } from "../../../lib/serverStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const streams = getAllStreams();
    return res.status(200).json(streams);
  }

  if (req.method === "POST") {
    const { sender, recipient, token, amount, start, cliff, end, revocable } = req.body;
    if (!recipient || !amount || !token) {
      return res.status(400).json({ detail: "Missing required stream escrow parameters" });
    }

    const tokenSymbol = token.includes("CAS3J7") ? "XLM" : "USDC";
    const newStream = addStream({
      sender: sender || "GBZXN7PIRZGNMHGA728R374U10943892348GBZXN7PIRZGNMHGA728R374U",
      recipient,
      token,
      token_symbol: tokenSymbol,
      token_decimals: 7,
      total_amount: Number(amount),
      start_time: Number(start),
      cliff_time: Number(cliff),
      end_time: Number(end),
      revocable: Boolean(revocable),
    });

    return res.status(201).json({
      status: "created",
      stream_id: newStream.id,
      stream: newStream,
    });
  }

  return res.status(405).json({ detail: "Method not allowed" });
}
