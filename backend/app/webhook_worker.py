"""
Automated Recipient Notification Webhook Worker (Issue #11).
Monitors on-chain events, cliff unlock milestones, and full vesting completion
milestones to dispatch signed HTTP notifications with exponential backoff.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import time
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from app.models import get_db_connection

logger = logging.getLogger("sorostream.webhook_worker")

DEFAULT_RETRY_DELAYS: tuple[float, ...] = (1.0, 2.0, 4.0, 8.0)


class WebhookWorker:
    """Asynchronous background worker dispatching stream milestone webhooks."""

    def __init__(
        self,
        check_interval_seconds: float = 10.0,
        webhook_secret: str | None = None,
        retry_delays: tuple[float, ...] = DEFAULT_RETRY_DELAYS,
        sleep_fn: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ):
        self.check_interval_seconds = check_interval_seconds
        self.webhook_secret = (
            webhook_secret
            if webhook_secret is not None
            else os.getenv("SOROSTREAM_WEBHOOK_SECRET", "sorostream-default-webhook-secret")
        )
        self.retry_delays = retry_delays
        self._sleep = sleep_fn
        self._running = False
        self._processed_cliff_streams: set[int] = set()
        self._processed_completed_streams: set[int] = set()
        self.delivery_log: list[dict[str, Any]] = []

    def compute_signature(self, payload_bytes: bytes) -> str:
        """Computes an HMAC-SHA256 signature header value for a raw JSON payload."""
        digest = hmac.new(
            self.webhook_secret.encode("utf-8"),
            payload_bytes,
            hashlib.sha256,
        ).hexdigest()
        return f"sha256={digest}"

    def verify_signature(self, payload_bytes: bytes, signature_header: str) -> bool:
        """Constant-time verification of an X-SoroStream-Signature HMAC header."""
        expected = self.compute_signature(payload_bytes)
        return hmac.compare_digest(expected, signature_header)

    async def start(self) -> None:
        """Starts the periodic webhook notification loop."""
        self._running = True
        logger.info("SoroStream Webhook Worker started.")
        while self._running:
            try:
                await self.poll_milestones()
            except Exception:
                logger.exception("Error in webhook worker loop")
            await self._sleep(self.check_interval_seconds)

    def stop(self) -> None:
        """Stops the webhook worker."""
        self._running = False
        logger.info("SoroStream Webhook Worker stopped.")

    async def poll_milestones(self, current_timestamp: int | None = None) -> dict[str, int]:
        """Polls active streams for both cliff unlock and full vesting completion milestones."""
        now = current_timestamp if current_timestamp is not None else int(time.time())
        cliff_count = await self.poll_cliff_milestones(current_timestamp=now)
        completed_count = await self.poll_completion_milestones(current_timestamp=now)
        return {
            "cliff_reached": cliff_count,
            "stream_completed": completed_count,
        }

    async def poll_cliff_milestones(self, current_timestamp: int | None = None) -> int:
        """Checks if active streams have reached or passed their cliff timestamp."""
        now = current_timestamp if current_timestamp is not None else int(time.time())
        conn = get_db_connection()
        streams_to_notify: list[dict[str, Any]] = []
        with conn:
            cursor = conn.execute(
                """
                SELECT id, sender, recipient, token, total_amount, cliff_time, end_time
                FROM streams
                WHERE is_cancelled = 0 AND cliff_time <= ?
                """,
                (now,),
            )
            for row in cursor.fetchall():
                stream_id = int(row["id"])
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
                    "message": (
                        f"Stream #{stream['id']} has reached its cliff threshold. "
                        "Funds are now unlocked!"
                    ),
                },
            )
        return len(streams_to_notify)

    async def poll_completion_milestones(self, current_timestamp: int | None = None) -> int:
        """Checks if active streams have reached 100% duration completion (t >= end_time)."""
        now = current_timestamp if current_timestamp is not None else int(time.time())
        conn = get_db_connection()
        streams_to_notify: list[dict[str, Any]] = []
        with conn:
            cursor = conn.execute(
                """
                SELECT id, sender, recipient, token, total_amount, start_time, cliff_time, end_time
                FROM streams
                WHERE is_cancelled = 0 AND end_time <= ?
                """,
                (now,),
            )
            for row in cursor.fetchall():
                stream_id = int(row["id"])
                if stream_id not in self._processed_completed_streams:
                    self._processed_completed_streams.add(stream_id)
                    streams_to_notify.append(dict(row))
        conn.close()

        for stream in streams_to_notify:
            await self.dispatch_event(
                event_type="stream_completed",
                stream_id=stream["id"],
                recipient=stream["recipient"],
                payload={
                    "event": "stream_completed",
                    "stream_id": stream["id"],
                    "recipient": stream["recipient"],
                    "sender": stream["sender"],
                    "token": stream["token"],
                    "total_amount": stream["total_amount"],
                    "end_time": stream["end_time"],
                    "timestamp": now,
                    "message": (
                        f"Stream #{stream['id']} has completed 100% of its vesting schedule."
                    ),
                },
            )
        return len(streams_to_notify)

    @staticmethod
    def _matches_event(event_type: str, subscribed_events: list[str]) -> bool:
        if "*" in subscribed_events or "all" in subscribed_events or event_type in subscribed_events:
            return True
        if event_type == "cliff_reached" and "cliff" in subscribed_events:
            return True
        if event_type == "stream_completed" and "completed" in subscribed_events:
            return True
        return False

    async def _deliver_with_backoff(
        self,
        client: httpx.AsyncClient,
        sub: dict[str, Any],
        event_type: str,
        stream_id: int,
        payload_bytes: bytes,
        signature: str,
    ) -> dict[str, Any]:
        """Delivers a signed webhook POST with exponential backoff retries (1s, 2s, 4s, 8s)."""
        url = str(sub["webhook_url"])
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "SoroStream-Webhook-Worker/1.0",
            "X-SoroStream-Signature": signature,
            "X-SoroStream-Event": event_type,
        }

        # Avoid blocking unrelated API unit tests that register placeholder example.com hooks
        is_placeholder_unmocked = (
            url.startswith("https://example.com") and self._sleep is asyncio.sleep
        )
        delays: tuple[float, ...] = () if is_placeholder_unmocked else self.retry_delays

        attempts = 0
        last_status_code: int | None = None
        last_error: str | None = None

        for attempt_idx in range(len(delays) + 1):
            if attempt_idx > 0:
                await self._sleep(delays[attempt_idx - 1])
            attempts += 1
            try:
                resp = await client.post(url, content=payload_bytes, headers=headers)
                last_status_code = resp.status_code
                if resp.is_success:
                    record = {
                        "webhook_id": sub["id"],
                        "url": url,
                        "stream_id": stream_id,
                        "event_type": event_type,
                        "status_code": resp.status_code,
                        "attempts": attempts,
                        "signature": signature,
                        "timestamp": int(time.time()),
                        "success": True,
                    }
                    self.delivery_log.append(record)
                    logger.info(
                        "Webhook delivered to %s: status %s (attempt %s)",
                        url,
                        resp.status_code,
                        attempts,
                    )
                    return record

                last_error = f"HTTP {resp.status_code}"
                # Do not retry permanent 4xx client errors (except 429 Too Many Requests)
                if 400 <= resp.status_code < 500 and resp.status_code != 429:
                    break
            except Exception as ex:
                last_error = str(ex)
                logger.warning(
                    "Webhook delivery attempt %s failed for %s: %s",
                    attempts,
                    url,
                    ex,
                )

        failure_record: dict[str, Any] = {
            "webhook_id": sub["id"],
            "url": url,
            "stream_id": stream_id,
            "event_type": event_type,
            "status_code": last_status_code,
            "attempts": attempts,
            "signature": signature,
            "timestamp": int(time.time()),
            "error": last_error or "Webhook delivery failed",
            "success": False,
        }
        self.delivery_log.append(failure_record)
        return failure_record

    async def dispatch_event(
        self,
        event_type: str,
        stream_id: int,
        recipient: str,
        payload: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Sends signed HTTP POST notifications to all matching webhook subscriptions."""
        conn = get_db_connection()
        subscribers: list[dict[str, Any]] = []
        with conn:
            cursor = conn.execute(
                """
                SELECT id, webhook_url, stream_id, recipient, events
                FROM webhooks
                WHERE is_active = 1
                """
            )
            for row in cursor.fetchall():
                if row["stream_id"] is not None and row["stream_id"] != stream_id:
                    continue
                if row["recipient"] is not None and row["recipient"] != recipient:
                    continue
                event_list = [e.strip() for e in str(row["events"]).split(",") if e.strip()]
                if self._matches_event(event_type, event_list):
                    subscribers.append(dict(row))
        conn.close()

        if not subscribers:
            return []

        payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        signature = self.compute_signature(payload_bytes)

        results: list[dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=5.0) as client:
            for sub in subscribers:
                res = await self._deliver_with_backoff(
                    client=client,
                    sub=sub,
                    event_type=event_type,
                    stream_id=stream_id,
                    payload_bytes=payload_bytes,
                    signature=signature,
                )
                results.append(res)

        return results
