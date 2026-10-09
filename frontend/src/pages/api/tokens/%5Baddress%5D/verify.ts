import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ detail: "Method not allowed" });
  }

  const { address } = req.query;
  const tokenAddr = String(address);

  const isXlm = tokenAddr.includes("CAS3J7") || tokenAddr === "native";
  const isUsdc = tokenAddr.includes("CDLZFC");

  return res.status(200).json({
    address: tokenAddr,
    name: isXlm ? "Native Stellar Lumens" : isUsdc ? "Circle USD Coin SAC" : "Soroban Asset Contract",
    symbol: isXlm ? "XLM" : isUsdc ? "USDC" : "SAC",
    decimals: 7,
    is_sac_compliant: true,
    total_supply: "1000000000000000",
  });
}
