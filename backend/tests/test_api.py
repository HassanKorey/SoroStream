"""
API unit tests for SoroStream backend indexer.
"""

import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models import init_db


@pytest.fixture(autouse=True)
def setup_database():
    init_db()


@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "soroban_rpc" in data


@pytest.mark.asyncio
async def test_openapi_schema_metadata():
    """Validates Issue #1: OpenAPI schema and documentation completeness."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert schema["info"]["title"] == "SoroStream Indexer & RPC Engine"
        assert "paths" in schema
        assert "/api/streams" in schema["paths"]
        assert "/api/metrics" in schema["paths"]
        assert "/api/tokens/verify" in schema["paths"]
        assert "/api/webhooks/subscribe" in schema["paths"]


@pytest.mark.asyncio
async def test_metrics_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "tvl_stroops" in data
        assert "total_streams" in data
        assert "active_streams" in data


@pytest.mark.asyncio
async def test_create_and_query_stream():
    now = int(time.time())
    payload = {
        "sender": "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO",
        "recipient": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H",
        "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        "amount": 10000000,
        "start_time": now - 100,
        "cliff_time": now - 50,
        "end_time": now + 100,
        "revocable": True,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create stream
        res_post = await ac.post("/api/streams", json=payload)
        assert res_post.status_code == 201
        created = res_post.json()
        stream_id = created["id"]
        assert stream_id > 0

        # Query stream
        res_get = await ac.get(f"/api/streams/{stream_id}")
        assert res_get.status_code == 200
        stream = res_get.json()
        assert stream["total_amount"] == 10000000
        assert stream["unlocked_amount"] > 0
        assert stream["claimable_amount"] > 0

        # Withdraw tokens
        res_withdraw = await ac.post(f"/api/streams/{stream_id}/withdraw")
        assert res_withdraw.status_code == 200
        updated = res_withdraw.json()
        assert updated["claimed_amount"] >= stream["unlocked_amount"]


@pytest.mark.asyncio
async def test_batch_stream_creation():
    """Validates Issue #12: Batch stream creation endpoint."""
    now = int(time.time())
    payload = {
        "sender": "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO",
        "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        "items": [
            {
                "recipient": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H",
                "amount": 5000000,
                "start_time": now,
                "cliff_time": now + 10,
                "end_time": now + 100,
                "revocable": True,
            },
            {
                "recipient": "GCZLKQ4EAEQOHO3WRY6PJJV2GTY5236Z5V5P3R2LQVO5U65TFXU7P2LK",
                "amount": 8000000,
                "start_time": now,
                "cliff_time": now + 20,
                "end_time": now + 200,
                "revocable": False,
            },
        ],
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/streams/batch", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert len(data) == 2


@pytest.mark.asyncio
async def test_token_verification_and_webhooks():
    """Validates Issues #8 & #11."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Token list
        res_tokens = await ac.get("/api/tokens")
        assert res_tokens.status_code == 200
        tokens = res_tokens.json()
        assert len(tokens) >= 2

        # Verify token
        res_ver = await ac.post("/api/tokens/verify?address=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC")
        assert res_ver.status_code == 200
        assert res_ver.json()["is_sep41_compliant"] is True

        # Webhook subscribe
        wh_payload = {
            "webhook_url": "https://example.com/stream-hook",
            "events": ["created", "withdraw", "cancelled"],
        }
        res_wh = await ac.post("/api/webhooks/subscribe", json=wh_payload)
        assert res_wh.status_code == 201
        assert res_wh.json()["webhook_url"] == "https://example.com/stream-hook"


@pytest.mark.asyncio
async def test_event_listener_tracks_stream_cancelled():
    """
    Validates Issue #6: Event listener tracking StreamCancelled events.
    Verifies that on-chain StreamCancelled events update the SQLite database state,
    mark is_cancelled = 1, record an audit event, and update stream view.
    """
    now = int(time.time())
    payload = {
        "sender": "GASENDERTESTEVENTLISTENER111111111111111111111111111111111",
        "recipient": "GARECIPIENTTESTEVENTLISTENER222222222222222222222222222222",
        "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        "amount": 25_000_000,
        "start_time": now - 100,
        "cliff_time": now - 50,
        "end_time": now + 200,
        "revocable": True,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create stream
        res = await ac.post("/api/streams", json=payload)
        assert res.status_code == 201
        stream_id = res.json()["id"]

        # Ingest a StreamCancelled contract event via listener API
        event_payload = {
            "event_type": "StreamCancelled",
            "stream_id": stream_id,
            "actor": "GASENDERTESTEVENTLISTENER111111111111111111111111111111111",
            "amount": 5_000_000,
            "claimable_to_recipient": 5_000_000,
            "refund_to_sender": 20_000_000,
            "timestamp": now,
            "tx_hash": "tx_test_hash_cancellation_123456",
        }
        res_event = await ac.post("/api/events/ingest", json=event_payload)
        assert res_event.status_code == 200
        event_res = res_event.json()
        assert event_res["status"] == "success"
        assert event_res["event_type"] == "StreamCancelled"

        # Verify stream is now cancelled in storage and query view
        res_get = await ac.get(f"/api/streams/{stream_id}")
        assert res_get.status_code == 200
        stream = res_get.json()
        assert stream["is_cancelled"] is True
        assert stream["status"] == "cancelled"

        # Verify event audit trail recorded the StreamCancelled event
        res_audit = await ac.get(f"/api/events?stream_id={stream_id}")
        assert res_audit.status_code == 200
        events = res_audit.json()
        event_names = [e["event_type"] for e in events]
        assert "StreamCancelled" in event_names
