import type { NextApiRequest, NextApiResponse } from "next";
import { getStreamById } from "../../../../lib/serverStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const numId = Number(id);

  if (isNaN(numId)) {
    return res.status(400).json({ detail: "Invalid stream identifier" });
  }

  const stream = getStreamById(numId);
  if (!stream) {
    return res.status(404).json({ detail: `Stream with ID ${numId} was not found` });
  }

  return res.status(200).json(stream);
}
