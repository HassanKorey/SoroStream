export interface ServerStreamRecord {
  id: number;
  sender: string;
  recipient: string;
  token: string;
  token_symbol: string;
  token_decimals: number;
  total_amount: number;
  claimed_amount: number;
  start_time: number;
  cliff_time: number;
  end_time: number;
  revocable: boolean;
  is_cancelled: boolean;
  created_at: number;
  status: "active" | "before_cliff" | "completed" | "cancelled";
  unlocked_amount?: number;
  claimable_amount?: number;
}

// Initial seed data for live Vercel demonstration
const initialStreams: ServerStreamRecord[] = [
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
    created_at: Math.floor(Date.now() / 1000) - 30 * 86400,
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
    created_at: Math.floor(Date.now() / 1000) - 5 * 86400,
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
    created_at: Math.floor(Date.now() / 1000) - 90 * 86400,
    status: "completed",
  },
];

// Global in-memory persistence across serverless invocations
declare global {
  // eslint-disable-next-line no-var
  var __sorostream_db: ServerStreamRecord[] | undefined;
}

if (!global.__sorostream_db) {
  global.__sorostream_db = [...initialStreams];
}

export function computeStreamMath(s: ServerStreamRecord, now = Math.floor(Date.now() / 1000)): ServerStreamRecord {
  let unlocked = 0;
  let status = s.status;

  if (s.is_cancelled) {
    unlocked = s.claimed_amount;
    status = "cancelled";
  } else if (now < s.cliff_time) {
    unlocked = 0;
    status = "before_cliff";
  } else if (now >= s.end_time) {
    unlocked = s.total_amount;
    status = unlocked <= s.claimed_amount ? "completed" : "active";
  } else {
    const elapsed = now - s.start_time;
    const duration = Math.max(1, s.end_time - s.start_time);
    unlocked = Math.floor((s.total_amount * elapsed) / duration);
    status = "active";
  }

  const claimable = Math.max(0, unlocked - s.claimed_amount);

  return {
    ...s,
    status,
    unlocked_amount: unlocked,
    claimable_amount: claimable,
  };
}

export function getAllStreams(): ServerStreamRecord[] {
  const list = global.__sorostream_db || initialStreams;
  return list.map((s) => computeStreamMath(s));
}

export function getStreamById(id: number): ServerStreamRecord | null {
  const list = global.__sorostream_db || initialStreams;
  const s = list.find((item) => item.id === id);
  if (!s) return null;
  return computeStreamMath(s);
}

export function addStream(data: Omit<ServerStreamRecord, "id" | "claimed_amount" | "is_cancelled" | "created_at" | "status">): ServerStreamRecord {
  const list = global.__sorostream_db || initialStreams;
  const nextId = (list.reduce((max, s) => Math.max(max, s.id), 0) || 0) + 1;
  const record: ServerStreamRecord = {
    ...data,
    id: nextId,
    claimed_amount: 0,
    is_cancelled: false,
    created_at: Math.floor(Date.now() / 1000),
    status: Math.floor(Date.now() / 1000) < data.cliff_time ? "before_cliff" : "active",
  };
  list.unshift(record);
  return computeStreamMath(record);
}

export function withdrawFromStream(id: number): { withdrawn_amount: number; stream: ServerStreamRecord } | null {
  const list = global.__sorostream_db || initialStreams;
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  const current = computeStreamMath(list[idx]);
  const claimable = current.claimable_amount || 0;
  if (claimable <= 0) return null;

  list[idx].claimed_amount += claimable;
  return {
    withdrawn_amount: claimable,
    stream: computeStreamMath(list[idx]),
  };
}

export function cancelStreamRecord(id: number): ServerStreamRecord | null {
  const list = global.__sorostream_db || initialStreams;
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  const current = computeStreamMath(list[idx]);
  list[idx].claimed_amount = current.unlocked_amount || 0;
  list[idx].is_cancelled = true;
  list[idx].status = "cancelled";

  return computeStreamMath(list[idx]);
}

export function getProtocolMetrics() {
  const streams = getAllStreams();
  let tvlStroops = 0;
  let claimedStroops = 0;
  let active = 0;
  let completed = 0;
  let cancelled = 0;

  for (const s of streams) {
    if (s.is_cancelled) {
      cancelled++;
    } else if (s.status === "completed") {
      completed++;
    } else {
      active++;
    }
    const remaining = s.is_cancelled ? 0 : s.total_amount - s.claimed_amount;
    tvlStroops += remaining;
    claimedStroops += s.claimed_amount;
  }

  return {
    tvl_stroops: tvlStroops,
    tvl_formatted: Number((tvlStroops / 10000000).toFixed(2)),
    total_streams: streams.length,
    active_streams: active,
    completed_streams: completed,
    cancelled_streams: cancelled,
    total_claimed_stroops: claimedStroops,
    total_claimed_formatted: Number((claimedStroops / 10000000).toFixed(2)),
  };
}
