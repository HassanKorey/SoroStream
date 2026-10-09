import type { NextApiRequest, NextApiResponse } from "next";
import { cancelStreamRecord } from "../../../../lib/serverStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Method not allowed" });
  }

  const { id } = req.query;
  const numId = Number(id);

  const updated = cancelStreamRecord(numId);
  if (!updated) {
    return res.status(404).json({ detail: "Stream not found or already cancelled" });
  }

  return res.status(200).json({
    status: "cancelled",
    stream_id: numId,
    stream: updated,
  });
}
