"""
Automated Recipient Notification Webhook Worker (Issue #11).
Monitors on-chain events and cliff unlock milestones to dispatch
real-time HTTP notifications to subscriber URLs.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.models import get_db_connection

logger = logging.getLogger("sorostream.webhook_worker")


class WebhookWorker:
    """Asynchronous background worker dispatching stream milestone webhooks."""

    def __init__(self, check_interval_seconds: float = 10.0):
        self.check_interval_seconds = check_interval_seconds
        self._running = False
        self._processed_cliff_streams: set[int] = set()

    async def start(self) -> None:
        """Starts the periodic webhook notification loop."""
        self._running = True
        logger.info("SoroStream Webhook Worker started.")
        while self._running:
            try:
                await self.poll_cliff_milestones()
            except Exception:
                logger.exception("Error in webhook worker loop")
            await asyncio.sleep(self.check_interval_seconds)

    def stop(self) -> None:
        """Stops the webhook worker."""
        self._running = False
        logger.info("SoroStream Webhook Worker stopped.")

    async def poll_cliff_milestones(self) -> None:
        """Checks if active streams have just reached or passed their cliff."""
        now = int(time.time())
        conn = get_db_connection()
        streams_to_notify = []
        with conn:
            cursor = conn.execute(
                """
                SELECT id, sender, recipient, token, total_amount, cliff_time, end_time
                FROM streams
                WHERE is_cancelled = 0 AND cliff_time <= ?
                """,
                (now,)
            )
            for row in cursor.fetchall():
                stream_id = row["id"]
                if stream_id not in self._processed_cliff_streams:
                    self._processed_cliff_streams.add(stream_id)
                    streams_to_notify.append(dict(row))
        conn.close()

        for stream in streams_to_notify:
            await self.dispatch_event(
                event_type="cliff_reached",
                stream_id=stream["id"],
                recipient=stream["recipient"],
                payload={
                    "event": "cliff_reached",
                    "stream_id": stream["id"],
                    "recipient": stream["recipient"],
                    "sender": stream["sender"],
                    "token": stream["token"],
                    "cliff_time": stream["cliff_time"],
                    "timestamp": now,
                    "message": f"Stream #{stream['id']} has reached its cliff threshold. Funds are now unlocked!",
                }
            )

    async def dispatch_event(
        self,
        event_type: str,
        stream_id: int,
        recipient: str,
        payload: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Sends HTTP POST notification to all matching webhook subscriptions."""
        conn = get_db_connection()
        subscribers = []
        with conn:
            cursor = conn.execute(
                """
                SELECT id, webhook_url, stream_id, recipient, events
                FROM webhooks
                WHERE is_active = 1
                """
            )
            for row in cursor.fetchall():
                # Filter by stream_id if set
                if row["stream_id"] is not None and row["stream_id"] != stream_id:
                    continue
                # Filter by recipient if set
                if row["recipient"] is not None and row["recipient"] != recipient:
                    continue
                # Filter by event type
                event_list = [e.strip() for e in row["events"].split(",")]
                if event_type in event_list or "*" in event_list:
                    subscribers.append(dict(row))
        conn.close()

        results = []
        async with httpx.AsyncClient(timeout=5.0) as client:
            for sub in subscribers:
                try:
                    resp = await client.post(sub["webhook_url"], json=payload)
                    results.append({
                        "webhook_id": sub["id"],
                        "url": sub["webhook_url"],
                        "status_code": resp.status_code,
                        "success": resp.is_success
                    })
                    logger.info(f"Webhook delivered to {sub['webhook_url']}: status {resp.status_code}")
                except Exception as ex:
                    results.append({
                        "webhook_id": sub["id"],
                        "url": sub["webhook_url"],
                        "error": str(ex),
                        "success": False
                    })
                    logger.warning(f"Webhook delivery failed for {sub['webhook_url']}: {ex}")

        return results
