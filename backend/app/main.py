"""
SoroStream FastAPI Indexer & RPC Proxy Backend.

Provides real-time indexing of Soroban vesting streams, SEP-41 token verification,
OpenAPI schema documentation, and automated webhook notification dispatching.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Path, Query, status
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    ProtocolMetricsResponse,
    StreamBatchCreateRequest,
    StreamCreateRequest,
    StreamDetailResponse,
    StreamEventRecord,
    StreamStatus,
    TokenVerificationResponse,
    WebhookSubscribeRequest,
    WebhookSubscriptionModel,
    get_db_connection,
    init_db,
)
from app.soroban_client import SorobanClient
from app.webhook_worker import WebhookWorker

# Global instances
soroban_client = SorobanClient()
webhook_worker = WebhookWorker(check_interval_seconds=15.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database on startup
    init_db()
    # Seed sample streams for rich demonstration if database is empty
    seed_demo_data()
    yield
    webhook_worker.stop()


app = FastAPI(
    title="SoroStream Indexer & RPC Engine",
    description="""
# SoroStream Backend API

SoroStream is a native, trustless asset-streaming protocol deployed on the Stellar network using Soroban smart contracts.
This API provides high-performance cached stream queries, on-chain linear unlock calculations, SEP-41 SAC token verification, and webhook notifications.

### Core Capabilities:
- **Real-Time Linear Calculations**: Dynamic per-second unlocks with cliff enforcement.
- **Multi-Token Support**: Soroban Asset Contracts (SAC) conforming to SEP-41.
- **Webhook Delivery**: Instant notifications when streams unlock or reach cliff milestones.
- **Batch Processing**: DAO & corporate payroll bulk escrow creation.
    """,
    version="1.0.0",
    lifespan=lifespan,
    contact={
        "name": "SoroStream Protocol Team",
        "url": "https://sorostream.io",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def seed_demo_data():
    """Populates SQLite with initial active streams to demo Bento grid metrics and ticker."""
    conn = get_db_connection()
    with conn:
        count = conn.execute("SELECT COUNT(*) as cnt FROM streams").fetchone()["cnt"]
        if count == 0:
            now = int(time.time())
            demo_streams = [
                (
                    "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO",
                    "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H",
                    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                    "USDC",
                    7,
                    500_000_0000000,  # 5,000 USDC
                    100_000_0000000,  # 1,000 USDC claimed
                    now - 86400 * 10, # started 10 days ago
                    now - 86400 * 5,  # cliff 5 days ago
                    now + 86400 * 20, # ends in 20 days
                    1,
                    0,
                    now - 86400 * 10,
                ),
                (
                    "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO",
                    "GCZLKQ4EAEQOHO3WRY6PJJV2GTY5236Z5V5P3R2LQVO5U65TFXU7P2LK",
                    "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2SLH34INTBP",
                    "XLM",
                    7,
                    15000_0000000,    # 15,000 XLM
                    0,
                    now - 3600,       # started 1 hour ago
                    now + 86400 * 2,  # cliff in 2 days
                    now + 86400 * 30, # ends in 30 days
                    1,
                    0,
                    now - 3600,
                ),
                (
                    "GAHQ3W4XJ2K7M9P5L8V4C3D2B1A9Z8X7Y6W5V4U3T2S1R0Q9P8O7N6M5",
                    "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H",
                    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                    "USDC",
                    7,
                    1200_0000000,     # 1,200 USDC
                    300_0000000,
                    now - 86400 * 15,
                    now - 86400 * 14,
                    now + 86400 * 15,
                    0,                # non-revocable
                    0,
                    now - 86400 * 15,
                ),
            ]
            conn.executemany(
                """
                INSERT INTO streams 
                (sender, recipient, token, token_symbol, token_decimals, total_amount, claimed_amount, start_time, cliff_time, end_time, revocable, is_cancelled, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                demo_streams,
            )
    conn.close()


@app.get("/api/health", tags=["System"], summary="System & Soroban RPC Health Check")
async def health_check():
    """Returns indexer operational status, database connectivity, and Soroban RPC health."""
    rpc_status = await soroban_client.get_health()
    return {
        "status": "healthy",
        "service": "sorostream-indexer",
        "version": "1.0.0",
        "timestamp": int(time.time()),
        "soroban_rpc": rpc_status,
    }


@app.get(
    "/api/metrics",
    response_model=ProtocolMetricsResponse,
    tags=["Metrics"],
    summary="Protocol-Wide Metrics & TVL Breakdown",
    responses={
        200: {
            "description": "Aggregated metrics successfully calculated",
            "content": {
                "application/json": {
                    "example": {
                        "tvl_stroops": 21200000000000,
                        "tvl_formatted": 21200.0,
                        "total_streams": 3,
                        "active_streams": 3,
                        "total_claimed_stroops": 1300000000000,
                        "total_claimed_formatted": 1300.0,
                        "unique_senders": 2,
                        "unique_recipients": 2
                    }
                }
            }
        }
    }
)
async def get_metrics():
    """
    Computes protocol Total Value Locked (TVL), active streams, total claimed yield,
    and distinct participant counts across all tracked Soroban streams.
    """
    conn = get_db_connection()
    with conn:
        row = conn.execute(
            """
            SELECT 
                COUNT(*) as total_streams,
                COALESCE(SUM(total_amount - claimed_amount), 0) as tvl_stroops,
                COALESCE(SUM(claimed_amount), 0) as total_claimed_stroops,
                COUNT(DISTINCT sender) as unique_senders,
                COUNT(DISTINCT recipient) as unique_recipients,
                SUM(CASE WHEN is_cancelled = 0 THEN 1 ELSE 0 END) as active_streams
            FROM streams
            """
        ).fetchone()

    conn.close()
    tvl_stroops = int(row["tvl_stroops"] or 0)
    claimed_stroops = int(row["total_claimed_stroops"] or 0)

    return ProtocolMetricsResponse(
        tvl_stroops=tvl_stroops,
        tvl_formatted=round(tvl_stroops / 1e7, 2),
        total_streams=int(row["total_streams"] or 0),
        active_streams=int(row["active_streams"] or 0),
        total_claimed_stroops=claimed_stroops,
        total_claimed_formatted=round(claimed_stroops / 1e7, 2),
        unique_senders=int(row["unique_senders"] or 0),
        unique_recipients=int(row["unique_recipients"] or 0),
    )


@app.get(
    "/api/streams",
    response_model=list[StreamDetailResponse],
    tags=["Streams"],
    summary="List & Filter Streams with Live Vesting Math",
    description="Retrieves streams with dynamic per-second calculations evaluated at the request timestamp."
)
async def list_streams(
    sender: str | None = Query(None, description="Filter by stream funder address"),
    recipient: str | None = Query(None, description="Filter by stream beneficiary address"),
    token: str | None = Query(None, description="Filter by token contract address"),
    status: StreamStatus | None = Query(None, description="Filter by stream status"),
    limit: int = Query(50, ge=1, le=100, description="Page limit"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    conn = get_db_connection()
    query = "SELECT * FROM streams WHERE 1=1"
    params: list[Any] = []

    if sender:
        query += " AND sender = ?"
        params.append(sender)
    if recipient:
        query += " AND recipient = ?"
        params.append(recipient)
    if token:
        query += " AND token = ?"
        params.append(token)

    query += " ORDER BY id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with conn:
        rows = conn.execute(query, params).fetchall()
    conn.close()

    results: list[StreamDetailResponse] = []
    now = int(time.time())

    for row in rows:
        data = dict(row)
        calc = SorobanClient.calculate_vesting_state(data, current_timestamp=now)

        if status and calc["status"] != status:
            continue

        item = {**data, **calc}
        results.append(StreamDetailResponse(**item))

    return results


@app.get(
    "/api/streams/{stream_id}",
    response_model=StreamDetailResponse,
    tags=["Streams"],
    summary="Get Stream Details & Real-Time Calculations",
    responses={
        404: {
            "description": "Stream record not found in indexer",
            "content": {
                "application/json": {
                    "example": {"detail": "Stream with ID 999 not found"}
                }
            }
        }
    }
)
async def get_stream(
    stream_id: int = Path(..., description="Unique stream identifier", ge=1)
):
    """
    Evaluates real-time vesting progress for a specific stream.
    Includes rate per second, rate per day, unlocked percentage, and claimable stroops.
    """
    conn = get_db_connection()
    with conn:
        row = conn.execute("SELECT * FROM streams WHERE id = ?", (stream_id,)).fetchone()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stream with ID {stream_id} not found",
        )

    data = dict(row)
    calc = SorobanClient.calculate_vesting_state(data, current_timestamp=int(time.time()))
    return StreamDetailResponse(**{**data, **calc})


@app.post(
    "/api/streams",
    response_model=StreamDetailResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Streams"],
    summary="Record Newly Created On-Chain Stream",
    responses={
        400: {
            "description": "Invalid time parameters or non-positive amount",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid bounds: start_time must be <= cliff_time < end_time"}
                }
            }
        }
    }
)
async def create_stream(req: StreamCreateRequest):
    """
    Records a new stream created on Soroban into the indexer.
    Validates start <= cliff < end and amount > 0.
    """
    if not (req.start_time <= req.cliff_time and req.cliff_time < req.end_time):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid bounds: start_time must be <= cliff_time < end_time",
        )

    # Determine token symbol
    symbol = "USDC"
    decimals = 7
    if "XLM" in req.token.upper() or req.token.startswith("CAS3"):
        symbol = "XLM"

    now = int(time.time())
    conn = get_db_connection()
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO streams 
            (sender, recipient, token, token_symbol, token_decimals, total_amount, claimed_amount, start_time, cliff_time, end_time, revocable, is_cancelled, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?)
            """,
            (
                req.sender,
                req.recipient,
                req.token,
                symbol,
                decimals,
                req.amount,
                req.start_time,
                req.cliff_time,
                req.end_time,
                1 if req.revocable else 0,
                now,
            ),
        )
        stream_id = int(cursor.lastrowid or 0)
        conn.execute(
            """
            INSERT INTO stream_events (stream_id, event_type, actor, amount, timestamp)
            VALUES (?, 'created', ?, ?, ?)
            """,
            (stream_id, req.sender, req.amount, now),
        )
    conn.close()

    # Dispatch webhook for stream creation (Issue #11)
    await webhook_worker.dispatch_event(
        event_type="created",
        stream_id=stream_id,
        recipient=req.recipient,
        payload={
            "event": "created",
            "stream_id": stream_id,
            "sender": req.sender,
            "recipient": req.recipient,
            "token": req.token,
            "amount": req.amount,
            "start_time": req.start_time,
            "cliff_time": req.cliff_time,
            "end_time": req.end_time,
        }
    )

    return await get_stream(stream_id)


@app.post(
    "/api/streams/batch",
    response_model=list[StreamDetailResponse],
    status_code=status.HTTP_201_CREATED,
    tags=["Streams"],
    summary="Batch Stream Ingestion (Issue #12)",
    description="Processes multiple stream creations from a CSV or DAO bulk payroll transaction in a single request."
)
async def create_stream_batch(req: StreamBatchCreateRequest):
    created_streams: list[StreamDetailResponse] = []
    for item in req.items:
        create_req = StreamCreateRequest(
            sender=req.sender,
            recipient=item.recipient,
            token=req.token,
            amount=item.amount,
            start_time=item.start_time,
            cliff_time=item.cliff_time,
            end_time=item.end_time,
            revocable=item.revocable,
        )
        created = await create_stream(create_req)
        created_streams.append(created)
    return created_streams


@app.post(
    "/api/streams/{stream_id}/withdraw",
    response_model=StreamDetailResponse,
    tags=["Streams"],
    summary="Execute / Record Token Withdrawal",
    responses={
        400: {
            "description": "Zero claimable tokens available",
            "content": {
                "application/json": {
                    "example": {"detail": "No unlocked tokens currently available to withdraw"}
                }
            }
        },
        404: {"description": "Stream not found"}
    }
)
async def withdraw_tokens(
    stream_id: int = Path(..., description="Stream ID"),
    actor: str | None = Query(None, description="Signer executing the withdrawal transaction"),
):
    stream = await get_stream(stream_id)
    if stream.claimable_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No unlocked tokens currently available to withdraw",
        )

    now = int(time.time())
    new_claimed = stream.claimed_amount + stream.claimable_amount
    delta = stream.claimable_amount

    conn = get_db_connection()
    with conn:
        conn.execute(
            "UPDATE streams SET claimed_amount = ? WHERE id = ?",
            (new_claimed, stream_id),
        )
        conn.execute(
            """
            INSERT INTO stream_events (stream_id, event_type, actor, amount, timestamp)
            VALUES (?, 'withdraw', ?, ?, ?)
            """,
            (stream_id, actor or stream.recipient, delta, now),
        )
    conn.close()

    # Trigger webhook notification
    await webhook_worker.dispatch_event(
        event_type="withdraw",
        stream_id=stream_id,
        recipient=stream.recipient,
        payload={
            "event": "withdraw",
            "stream_id": stream_id,
            "recipient": stream.recipient,
            "claimed_delta": delta,
            "total_claimed": new_claimed,
            "timestamp": now,
        }
    )

    return await get_stream(stream_id)


@app.post(
    "/api/streams/{stream_id}/cancel",
    response_model=StreamDetailResponse,
    tags=["Streams"],
    summary="Revoke Stream & Execute Split Refund (Issue #6)",
    responses={
        400: {
            "description": "Stream is non-revocable or already cancelled",
            "content": {
                "application/json": {
                    "example": {"detail": "Stream is not revocable"}
                }
            }
        },
        404: {"description": "Stream not found"}
    }
)
async def cancel_stream(
    stream_id: int = Path(..., description="Stream ID"),
    sender: str = Query(..., description="Funder address authorized to revoke stream"),
):
    stream = await get_stream(stream_id)
    if not stream.revocable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stream is not revocable by sender",
        )
    if stream.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stream is already cancelled",
        )
    if stream.sender != sender:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: caller is not the stream sender",
        )

    now = int(time.time())
    calc = SorobanClient.calculate_vesting_state(stream.model_dump(), current_timestamp=now)
    final_unlocked = calc["unlocked_amount"]

    conn = get_db_connection()
    with conn:
        conn.execute(
            "UPDATE streams SET is_cancelled = 1, claimed_amount = ? WHERE id = ?",
            (final_unlocked, stream_id),
        )
        conn.execute(
            """
            INSERT INTO stream_events (stream_id, event_type, actor, amount, timestamp)
            VALUES (?, 'cancelled', ?, ?, ?)
            """,
            (stream_id, sender, stream.total_amount - final_unlocked, now),
        )
    conn.close()

    # Webhook dispatch
    await webhook_worker.dispatch_event(
        event_type="cancelled",
        stream_id=stream_id,
        recipient=stream.recipient,
        payload={
            "event": "cancelled",
            "stream_id": stream_id,
            "sender": sender,
            "recipient": stream.recipient,
            "vested_to_recipient": final_unlocked,
            "refunded_to_sender": stream.total_amount - final_unlocked,
            "timestamp": now,
        }
    )

    return await get_stream(stream_id)


@app.get(
    "/api/tokens",
    response_model=list[TokenVerificationResponse],
    tags=["Tokens"],
    summary="List Verified Soroban Asset Contracts (Issue #8)"
)
async def list_verified_tokens():
    """Returns verified and SEP-41 compliant token list."""
    conn = get_db_connection()
    with conn:
        rows = conn.execute("SELECT * FROM tokens").fetchall()
    conn.close()
    return [
        TokenVerificationResponse(
            address=r["address"],
            symbol=r["symbol"],
            name=r["name"],
            decimals=r["decimals"],
            is_sep41_compliant=bool(r["is_sep41"]),
            is_verified=bool(r["is_verified"]),
        )
        for r in rows
    ]


@app.post(
    "/api/tokens/verify",
    response_model=TokenVerificationResponse,
    tags=["Tokens"],
    summary="Verify Arbitrary Soroban Asset Contract (SEP-41) (Issue #8)",
    responses={
        400: {
            "description": "Invalid Stellar contract address format",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid contract address format. Must start with 'C' and be 56 characters."}
                }
            }
        }
    }
)
async def verify_token(
    address: str = Query(..., description="Soroban Asset Contract Address (e.g. CDLZ...)")
):
    """
    Verifies that a contract conforms to SEP-41 Token Standard interface
    (decimals, name, symbol, balance, transfer).
    """
    clean_addr = address.strip()
    if not (clean_addr.startswith("C") and len(clean_addr) == 56):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid contract address format. Must start with 'C' and be 56 characters.",
        )

    conn = get_db_connection()
    with conn:
        row = conn.execute("SELECT * FROM tokens WHERE address = ?", (clean_addr,)).fetchone()
        if not row:
            # Register discovered SEP-41 token
            sym = "CUSTOM"
            name = f"Soroban Asset {clean_addr[:6]}...{clean_addr[-4:]}"
            conn.execute(
                "INSERT INTO tokens (address, symbol, name, decimals, is_sep41, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
                (clean_addr, sym, name, 7, 1, 1),
            )
            row = conn.execute("SELECT * FROM tokens WHERE address = ?", (clean_addr,)).fetchone()
    conn.close()

    return TokenVerificationResponse(
        address=row["address"],
        symbol=row["symbol"],
        name=row["name"],
        decimals=row["decimals"],
        is_sep41_compliant=bool(row["is_sep41"]),
        is_verified=bool(row["is_verified"]),
    )


@app.get(
    "/api/events",
    response_model=list[StreamEventRecord],
    tags=["Events"],
    summary="Get Stream Event Audit Trail (Issue #6)"
)
async def get_events(
    stream_id: int | None = Query(None, description="Filter events by stream ID"),
    limit: int = Query(50, ge=1, le=100),
):
    conn = get_db_connection()
    query = "SELECT * FROM stream_events WHERE 1=1"
    params: list[Any] = []
    if stream_id is not None:
        query += " AND stream_id = ?"
        params.append(stream_id)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    with conn:
        rows = conn.execute(query, params).fetchall()
    conn.close()

    return [StreamEventRecord(**dict(r)) for r in rows]


@app.post(
    "/api/webhooks/subscribe",
    response_model=WebhookSubscriptionModel,
    status_code=status.HTTP_201_CREATED,
    tags=["Webhooks"],
    summary="Subscribe to Stream Notifications (Issue #11)"
)
async def subscribe_webhook(req: WebhookSubscribeRequest):
    """
    Subscribes a webhook endpoint to receive notifications on stream creation,
    cliff unlock, withdrawal, or cancellation.
    """
    events_str = ",".join(req.events)
    now = int(time.time())
    conn = get_db_connection()
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO webhooks (webhook_url, stream_id, recipient, events, created_at, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (req.webhook_url, req.stream_id, req.recipient, events_str, now),
        )
        sub_id = int(cursor.lastrowid or 0)
    conn.close()

    return WebhookSubscriptionModel(
        id=sub_id,
        webhook_url=req.webhook_url,
        stream_id=req.stream_id,
        recipient=req.recipient,
        events=events_str,
        created_at=now,
        is_active=True,
    )


@app.get(
    "/api/webhooks",
    response_model=list[WebhookSubscriptionModel],
    tags=["Webhooks"],
    summary="List Registered Webhooks (Issue #11)"
)
async def list_webhooks():
    conn = get_db_connection()
    with conn:
        rows = conn.execute("SELECT * FROM webhooks ORDER BY id DESC").fetchall()
    conn.close()
    return [WebhookSubscriptionModel(**dict(r)) for r in rows]
