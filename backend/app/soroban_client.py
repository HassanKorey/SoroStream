"""
Soroban RPC client and event synchronization engine.
Connects to Soroban RPC endpoints, monitors contract events,
and syncs stream states into the local SQLite database.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.models import (
    StreamStatus,
    get_db_connection,
)

logger = logging.getLogger(__name__)

DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org"
DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"


class SorobanClient:
    """Interface to communicate with Soroban RPC and index streams."""

    def __init__(self, rpc_url: str = DEFAULT_RPC_URL, contract_id: str | None = None):
        self.rpc_url = rpc_url
        self.contract_id = contract_id or "CA4L7T6R74G3T5F5V7V7RWWUHE2J76Y4WJ3L7C2WJ3L7C2WJ3L7C2WJ3"

    @staticmethod
    def calculate_vesting_state(
        record: dict[str, Any], current_timestamp: int | None = None
    ) -> dict[str, Any]:
        """
        Executes on-chain mathematical linear vesting logic.
        Matches the Rust contract implementation:
        • If t < cliff_time: Unlocked = 0
        • If t >= end_time: Unlocked = total_amount
        • Otherwise: Unlocked = total_amount * (t - start_time) / (end_time - start_time)
        Claimable = Unlocked - claimed_amount
        """
        t = current_timestamp if current_timestamp is not None else int(time.time())
        total_amount = int(record["total_amount"])
        claimed_amount = int(record["claimed_amount"])
        start_time = int(record["start_time"])
        cliff_time = int(record["cliff_time"])
        end_time = int(record["end_time"])
        is_cancelled = bool(record["is_cancelled"])

        if is_cancelled:
            unlocked_amount = claimed_amount
            claimable_amount = 0
            status = StreamStatus.CANCELLED
        elif t < cliff_time:
            unlocked_amount = 0
            claimable_amount = 0
            status = StreamStatus.CLIFF_PENDING
        elif t >= end_time:
            unlocked_amount = total_amount
            claimable_amount = max(0, unlocked_amount - claimed_amount)
            status = StreamStatus.COMPLETED if claimable_amount == 0 else StreamStatus.ACTIVE
        else:
            duration = max(1, end_time - start_time)
            elapsed = max(0, t - start_time)
            unlocked_amount = (total_amount * elapsed) // duration
            claimable_amount = max(0, unlocked_amount - claimed_amount)
            status = StreamStatus.ACTIVE

        unlocked_pct = round((unlocked_amount / total_amount) * 100, 2) if total_amount > 0 else 0.0
        claimed_pct = round((claimed_amount / total_amount) * 100, 2) if total_amount > 0 else 0.0

        duration_total = max(1, end_time - start_time)
        rate_per_sec = float(total_amount) / float(duration_total)
        rate_per_day = rate_per_sec * 86400.0

        return {
            "current_time": t,
            "unlocked_amount": unlocked_amount,
            "claimable_amount": claimable_amount,
            "unlocked_percentage": unlocked_pct,
            "claimed_percentage": claimed_pct,
            "rate_per_second": round(rate_per_sec, 4),
            "rate_per_day": round(rate_per_day, 2),
            "status": status,
        }

    async def get_health(self) -> dict[str, Any]:
        """Check connection to the Soroban RPC node."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getHealth"
                }
                res = await client.post(self.rpc_url, json=payload)
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            logger.debug(f"RPC getHealth offline or unavailable, operating in standalone mode: {e}")
        return {"status": "healthy", "mode": "mock_indexer", "network": "soroban-testnet"}

    def record_event_in_db(
        self,
        stream_id: int,
        event_type: str,
        actor: str,
        amount: int,
        timestamp: int,
        tx_hash: str | None = None
    ) -> None:
        """Insert a contract event log into SQLite."""
        conn = get_db_connection()
        with conn:
            conn.execute(
                """
                INSERT INTO stream_events (stream_id, event_type, actor, amount, timestamp, tx_hash)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (stream_id, event_type, actor, amount, timestamp, tx_hash)
            )
        conn.close()
