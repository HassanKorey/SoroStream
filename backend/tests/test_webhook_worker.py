"""
Unit tests for Automated Recipient Notification Webhook Worker & Event Dispatcher (Issue #11).
"""

from __future__ import annotations

import json
import time
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.models import get_db_connection, init_db
from app.webhook_worker import DEFAULT_RETRY_DELAYS, WebhookWorker


@pytest.fixture(autouse=True)
def clean_webhook_tables():
    init_db()
    conn = get_db_connection()
    with conn:
        conn.execute("DELETE FROM webhooks")
    conn.close()


def _insert_stream(
    sender: str,
    recipient: str,
    start_time: int,
    cliff_time: int,
    end_time: int,
    total_amount: int = 10_000_000,
) -> int:
    conn = get_db_connection()
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO streams
            (sender, recipient, token, token_symbol, token_decimals, total_amount, claimed_amount,
             start_time, cliff_time, end_time, revocable, is_cancelled, created_at)
            VALUES (?, ?, ?, 'USDC', 7, ?, 0, ?, ?, ?, 1, 0, ?)
            """,
            (
                sender,
                recipient,
                "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                total_amount,
                start_time,
                cliff_time,
                end_time,
                start_time,
            ),
        )
        stream_id = int(cursor.lastrowid or 0)
    conn.close()
    return stream_id


def _insert_webhook(
    webhook_url: str,
    events: str = "cliff_reached,stream_completed",
    stream_id: int | None = None,
    recipient: str | None = None,
) -> int:
    conn = get_db_connection()
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO webhooks (webhook_url, stream_id, recipient, events, created_at, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (webhook_url, stream_id, recipient, events, int(time.time())),
        )
        wh_id = int(cursor.lastrowid or 0)
    conn.close()
    return wh_id


@pytest.mark.asyncio
async def test_hmac_sha256_signature_header_and_verification():
    """Verifies X-SoroStream-Signature HMAC-SHA256 generation and constant-time verification."""
    secret = "super-secret-sorostream-key"
    worker = WebhookWorker(webhook_secret=secret)

    _insert_webhook("https://receiver.sorostream.io/webhook", events="created")

    captured_headers: dict[str, str] = {}
    captured_body: bytes = b""

    async def fake_post(url: str, content: bytes, headers: dict[str, str]):
        nonlocal captured_headers, captured_body
        captured_headers = headers
        captured_body = content
        request = httpx.Request("POST", url)
        return httpx.Response(200, request=request, json={"received": True})

    payload = {
        "event": "created",
        "stream_id": 42,
        "recipient": "GBRECIPIENT111111111111111111111111111111111111111111111",
        "amount": 50_000_000,
    }

    with patch.object(httpx.AsyncClient, "post", side_effect=fake_post):
        results = await worker.dispatch_event(
            event_type="created",
            stream_id=42,
            recipient=payload["recipient"],
            payload=payload,
        )

    assert len(results) == 1
    assert results[0]["success"] is True
    assert results[0]["status_code"] == 200
    assert "X-SoroStream-Signature" in captured_headers
    sig_header = captured_headers["X-SoroStream-Signature"]
    assert sig_header.startswith("sha256=")

    # Verify authentic payload passes HMAC check
    assert worker.verify_signature(captured_body, sig_header) is True
    assert json.loads(captured_body.decode("utf-8"))["stream_id"] == 42

    # Tampered payload or wrong signature must fail verification
    assert worker.verify_signature(captured_body + b" ", sig_header) is False
    assert worker.verify_signature(captured_body, "sha256=deadbeef") is False


@pytest.mark.asyncio
async def test_milestone_polling_cliff_and_full_completion():
    """Verifies milestone events are emitted on cliff unlock and 100% stream completion."""
    now = 10_000
    sender = "GASENDER111111111111111111111111111111111111111111111111"
    recipient = "GBRECIPIENT222222222222222222222222222222222222222222222"

    stream_id = _insert_stream(
        sender=sender,
        recipient=recipient,
        start_time=1_000,
        cliff_time=5_000,
        end_time=9_000,
    )
    _insert_webhook(
        "https://receiver.sorostream.io/milestones",
        events="cliff_reached,stream_completed",
        stream_id=stream_id,
        recipient=recipient,
    )

    worker = WebhookWorker(webhook_secret="milestone-test-secret")
    delivered_events: list[dict] = []

    async def fake_post(url: str, content: bytes, headers: dict[str, str]):
        body = json.loads(content.decode("utf-8"))
        assert worker.verify_signature(content, headers["X-SoroStream-Signature"])
        delivered_events.append(body)
        return httpx.Response(200, request=httpx.Request("POST", url))

    with patch.object(httpx.AsyncClient, "post", side_effect=fake_post):
        # Poll at t = 6,000: cliff reached (5,000 <= 6,000), but not completed (9,000 > 6,000)
        counts_at_cliff = await worker.poll_milestones(current_timestamp=6_000)
        assert counts_at_cliff == {"cliff_reached": 1, "stream_completed": 0}
        assert len(delivered_events) == 1
        assert delivered_events[0]["event"] == "cliff_reached"
        assert delivered_events[0]["stream_id"] == stream_id

        # Poll at t = 10,000: cliff already notified, now stream_completed (9,000 <= 10,000) fires
        counts_at_end = await worker.poll_milestones(current_timestamp=now)
        assert counts_at_end == {"cliff_reached": 0, "stream_completed": 1}
        assert len(delivered_events) == 2
        assert delivered_events[1]["event"] == "stream_completed"
        assert delivered_events[1]["stream_id"] == stream_id

        # Subsequent poll at t = 11,000 does not re-emit duplicate milestone notifications
        counts_repeat = await worker.poll_milestones(current_timestamp=11_000)
        assert counts_repeat == {"cliff_reached": 0, "stream_completed": 0}


@pytest.mark.asyncio
async def test_exponential_backoff_retries_and_delivery_log():
    """Verifies exponential backoff (1s, 2s, 4s, 8s) on transient failures and delivery log tracking."""
    recorded_sleeps: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        recorded_sleeps.append(seconds)

    worker = WebhookWorker(
        webhook_secret="backoff-secret",
        retry_delays=DEFAULT_RETRY_DELAYS,
        sleep_fn=fake_sleep,
    )
    assert worker.retry_delays == (1.0, 2.0, 4.0, 8.0)

    _insert_webhook("https://receiver.sorostream.io/flaky", events="withdraw")

    call_count = 0

    async def flaky_post(url: str, content: bytes, headers: dict[str, str]):
        nonlocal call_count
        call_count += 1
        req = httpx.Request("POST", url)
        if call_count == 1:
            raise httpx.ConnectError("Connection reset by peer", request=req)
        if call_count in (2, 3):
            return httpx.Response(503, request=req)
        return httpx.Response(202, request=req)

    with patch.object(httpx.AsyncClient, "post", side_effect=flaky_post):
        results = await worker.dispatch_event(
            event_type="withdraw",
            stream_id=7,
            recipient="GBRECIPIENT",
            payload={"event": "withdraw", "stream_id": 7},
        )

    assert len(results) == 1
    assert results[0]["success"] is True
    assert results[0]["status_code"] == 202
    assert results[0]["attempts"] == 4
    # 3 retries before the 4th attempt succeeded -> slept 1s, 2s, 4s
    assert recorded_sleeps == [1.0, 2.0, 4.0]
    assert len(worker.delivery_log) == 1
    assert worker.delivery_log[0]["status_code"] == 202
    assert worker.delivery_log[0]["timestamp"] > 0


@pytest.mark.asyncio
async def test_exhausted_retries_logged_as_failed():
    """Verifies all 4 backoff intervals (1s, 2s, 4s, 8s) execute when all 5 attempts fail."""
    recorded_sleeps: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        recorded_sleeps.append(seconds)

    worker = WebhookWorker(sleep_fn=fake_sleep)
    _insert_webhook("https://receiver.sorostream.io/down", events="*")

    async def always_fail(url: str, content: bytes, headers: dict[str, str]):
        raise httpx.ConnectTimeout("Timed out", request=httpx.Request("POST", url))

    with patch.object(httpx.AsyncClient, "post", side_effect=always_fail):
        results = await worker.dispatch_event(
            event_type="cancelled",
            stream_id=9,
            recipient="GBRECIPIENT",
            payload={"event": "cancelled", "stream_id": 9},
        )

    assert len(results) == 1
    assert results[0]["success"] is False
    assert results[0]["attempts"] == 5
    assert recorded_sleeps == [1.0, 2.0, 4.0, 8.0]
    assert worker.delivery_log[-1]["success"] is False


@pytest.mark.asyncio
async def test_worker_start_and_stop_loop():
    """Verifies background polling loop runs at configured interval and stops cleanly."""
    worker = WebhookWorker(check_interval_seconds=2.5)
    worker.poll_milestones = AsyncMock(return_value={"cliff_reached": 0, "stream_completed": 0})  # type: ignore[method-assign]

    async def stop_after_one_tick(delay: float) -> None:
        assert delay == 2.5
        worker.stop()

    worker._sleep = stop_after_one_tick
    await worker.start()
    worker.poll_milestones.assert_awaited_once()
