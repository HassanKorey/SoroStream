import type { NextApiRequest, NextApiResponse } from "next";
import { withdrawFromStream } from "../../../../lib/serverStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Method not allowed" });
  }

  const { id } = req.query;
  const numId = Number(id);

  const result = withdrawFromStream(numId);
  if (!result) {
    return res.status(400).json({ detail: "Nothing to withdraw or stream was not found" });
  }

  return res.status(200).json({
    status: "withdrawn",
    stream_id: numId,
    withdrawn_amount: result.withdrawn_amount,
    stream: result.stream,
  });
}
