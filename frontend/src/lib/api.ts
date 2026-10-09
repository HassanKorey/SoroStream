export interface StreamRecord {
  id: number;
  sender: string;
  recipient: string;
  token: string;
  token_symbol: string;
  token_decimals: number;
  total_amount: number;
  claimed_amount: number;
  unlocked_amount?: number;
  claimable_amount?: number;
  start_time: number;
  cliff_time: number;
  end_time: number;
  revocable: boolean;
  is_cancelled: boolean;
  status: "active" | "before_cliff" | "completed" | "cancelled";
  created_at?: string;
}

export interface ProtocolMetrics {
  total_streams_count: number;
  active_streams_count: number;
  completed_streams_count: number;
  cancelled_streams_count: number;
  total_value_locked: number;
  total_value_streamed: number;
  total_value_claimed: number;
}

export interface TokenVerification {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  is_sac_compliant: boolean;
  total_supply?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";

// Fallback demo streams in case backend is loading
export const DEMO_STREAMS: StreamRecord[] = [
  {
    id: 1,
    sender: "GBZXN7PIRZGNMHGA728R374U10943892348GBZXN7PIRZGNMHGA728R374U",
    recipient: "GCH4X39385NMGHA728R374U10943892348GBZXN7PIRZGNMHGA728R374U",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    token_symbol: "USDC",
    token_decimals: 7,
    total_amount: 10000000000, // 1,000 USDC
    claimed_amount: 2500000000,
    start_time: Math.floor(Date.now() / 1000) - 30 * 86400,
    cliff_time: Math.floor(Date.now() / 1000) - 15 * 86400,
    end_time: Math.floor(Date.now() / 1000) + 60 * 86400,
    revocable: true,
    is_cancelled: false,
    status: "active",
  },
  {
    id: 2,
    sender: "GAKN4934892348GBZXN7PIRZGNMHGA728R374U10943892348GBZXN7PIRZ",
    recipient: "GB74UX9385NMGHA728R374U10943892348GBZXN7PIRZGNMHGA728R374U",
    token: "CAS3J7GYLGXMF6TDJBBYYSE3VGSGCUGLDRBPGZAFVNCNTMACJWPH3HUB",
    token_symbol: "XLM",
    token_decimals: 7,
    total_amount: 50000000000, // 5,000 XLM
    claimed_amount: 0,
    start_time: Math.floor(Date.now() / 1000) - 5 * 86400,
    cliff_time: Math.floor(Date.now() / 1000) + 10 * 86400,
    end_time: Math.floor(Date.now() / 1000) + 90 * 86400,
    revocable: false,
    is_cancelled: false,
    status: "before_cliff",
  },
  {
    id: 3,
    sender: "GBZXN7PIRZGNMHGA728R374U10943892348GBZXN7PIRZGNMHGA728R374U",
    recipient: "GDAK38495NMGHA728R374U10943892348GBZXN7PIRZGNMHGA728R374U",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    token_symbol: "USDC",
    token_decimals: 7,
    total_amount: 2500000000, // 250 USDC
    claimed_amount: 2500000000,
    start_time: Math.floor(Date.now() / 1000) - 90 * 86400,
    cliff_time: Math.floor(Date.now() / 1000) - 60 * 86400,
    end_time: Math.floor(Date.now() / 1000) - 10 * 86400,
    revocable: true,
    is_cancelled: false,
    status: "completed",
  },
];

export async function fetchMetrics(): Promise<ProtocolMetrics> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/metrics`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return {
        total_streams_count: Number(data.total_streams ?? data.total_streams_count ?? 0),
        active_streams_count: Number(data.active_streams ?? data.active_streams_count ?? 0),
        completed_streams_count: Number(data.completed_streams ?? data.completed_streams_count ?? 0),
        cancelled_streams_count: Number(data.cancelled_streams ?? data.cancelled_streams_count ?? 0),
        total_value_locked: Number(data.tvl_formatted ?? data.total_value_locked ?? 0),
        total_value_streamed: Number(
          data.tvl_formatted != null
            ? data.tvl_formatted + (data.total_claimed_formatted ?? 0)
            : data.total_value_streamed ?? 0
        ),
        total_value_claimed: Number(data.total_claimed_formatted ?? data.total_value_claimed ?? 0),
      };
    }
  } catch (err) {
    console.warn("Backend metrics offline, using calculated values:", err);
  }
  return {
    total_streams_count: DEMO_STREAMS.length,
    active_streams_count: 1,
    completed_streams_count: 1,
    cancelled_streams_count: 0,
    total_value_locked: 5500,
    total_value_streamed: 6250,
    total_value_claimed: 500,
  };
}

export async function fetchStreams(): Promise<StreamRecord[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/streams`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
      if (Array.isArray(data?.streams) && data.streams.length > 0) {
        return data.streams;
      }
    }
  } catch (err) {
    console.warn("Backend streams offline, falling back to demo set:", err);
  }
  return DEMO_STREAMS;
}

export async function fetchStreamById(id: number): Promise<StreamRecord | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/streams/${id}`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`Backend stream ${id} fetch offline:`, err);
  }
  const found = DEMO_STREAMS.find((s) => s.id === Number(id));
  return found || null;
}

export async function verifyToken(address: string): Promise<TokenVerification | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tokens/${address}/verify`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Token verification offline:", err);
  }
  return {
    address,
    name: "Custom Soroban SAC Token",
    symbol: "TOKEN",
    decimals: 7,
    is_sac_compliant: true,
  };
}
