import type { NextApiRequest, NextApiResponse } from "next";
import { getProtocolMetrics } from "../../lib/serverStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ detail: "Method not allowed" });
  }
  const metrics = getProtocolMetrics();
  return res.status(200).json(metrics);
}
