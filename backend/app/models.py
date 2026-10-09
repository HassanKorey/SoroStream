"""
Data models and SQLite storage engine for SoroStream backend indexer.
"""

from __future__ import annotations

import sqlite3
from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, Field

DB_PATH = Path(__file__).resolve().parent.parent / "sorostream.db"


class StreamStatus(StrEnum):
    ACTIVE = "active"
    CLIFF_PENDING = "cliff_pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class StreamCreateRequest(BaseModel):
    sender: str = Field(..., description="Stellar public key / contract address of the stream creator", json_schema_extra={"example": "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO"})
    recipient: str = Field(..., description="Stellar public key of beneficiary", json_schema_extra={"example": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H"})
    token: str = Field(..., description="SAC / Soroban Token contract address", json_schema_extra={"example": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"})
    amount: int = Field(..., gt=0, description="Total stream amount in stroops (1 token = 10^7 stroops)", json_schema_extra={"example": 1000000000})
    start_time: int = Field(..., description="Commencement UNIX timestamp in seconds", json_schema_extra={"example": 1700000000})
    cliff_time: int = Field(..., description="Cliff timestamp prior to which 0 tokens are claimable", json_schema_extra={"example": 1700050000})
    end_time: int = Field(..., description="Timestamp at which 100% of tokens unlock", json_schema_extra={"example": 1700200000})
    revocable: bool = Field(default=True, description="Whether sender can cancel stream before end_time", json_schema_extra={"example": True})


class StreamBatchItem(BaseModel):
    recipient: str = Field(..., description="Beneficiary address", json_schema_extra={"example": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H"})
    amount: int = Field(..., gt=0, description="Amount in stroops", json_schema_extra={"example": 500000000})
    start_time: int = Field(..., description="Commencement timestamp", json_schema_extra={"example": 1700000000})
    cliff_time: int = Field(..., description="Cliff timestamp", json_schema_extra={"example": 1700050000})
    end_time: int = Field(..., description="End timestamp", json_schema_extra={"example": 1700200000})
    revocable: bool = Field(default=True, description="Revocability flag", json_schema_extra={"example": True})


class StreamBatchCreateRequest(BaseModel):
    sender: str = Field(..., description="Funder address executing the batch escrow", json_schema_extra={"example": "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO"})
    token: str = Field(..., description="Token contract address", json_schema_extra={"example": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"})
    items: list[StreamBatchItem] = Field(..., min_length=1, description="List of streams to create")


class StreamRecordModel(BaseModel):
    id: int = Field(..., description="Unique auto-incrementing stream ID", json_schema_extra={"example": 1})
    sender: str = Field(..., description="Stream funder address", json_schema_extra={"example": "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO"})
    recipient: str = Field(..., description="Beneficiary address", json_schema_extra={"example": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H"})
    token: str = Field(..., description="Token contract address", json_schema_extra={"example": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"})
    token_symbol: str = Field(default="USDC", description="Token symbol", json_schema_extra={"example": "USDC"})
    token_decimals: int = Field(default=7, description="Asset decimals", json_schema_extra={"example": 7})
    total_amount: int = Field(..., description="Total locked tokens in stroops", json_schema_extra={"example": 1000000000})
    claimed_amount: int = Field(default=0, description="Withdrawn tokens in stroops", json_schema_extra={"example": 200000000})
    start_time: int = Field(..., description="Commencement timestamp (seconds)", json_schema_extra={"example": 1700000000})
    cliff_time: int = Field(..., description="Cliff timestamp (seconds)", json_schema_extra={"example": 1700050000})
    end_time: int = Field(..., description="End timestamp (seconds)", json_schema_extra={"example": 1700200000})
    revocable: bool = Field(default=True, description="Revocability flag", json_schema_extra={"example": True})
    is_cancelled: bool = Field(default=False, description="Stream cancellation status", json_schema_extra={"example": False})
    created_at: int = Field(..., description="Stream index timestamp", json_schema_extra={"example": 1700000000})


class StreamDetailResponse(StreamRecordModel):
    current_time: int = Field(..., description="Current evaluation timestamp", json_schema_extra={"example": 1700100000})
    unlocked_amount: int = Field(..., description="Calculated total unlocked tokens", json_schema_extra={"example": 500000000})
    claimable_amount: int = Field(..., description="Net claimable tokens ready for withdrawal", json_schema_extra={"example": 300000000})
    unlocked_percentage: float = Field(..., description="Percentage of tokens unlocked (0-100)", json_schema_extra={"example": 50.0})
    claimed_percentage: float = Field(..., description="Percentage of tokens claimed (0-100)", json_schema_extra={"example": 20.0})
    rate_per_second: float = Field(..., description="Tokens unlocked per second in stroops", json_schema_extra={"example": 5000.0})
    rate_per_day: float = Field(..., description="Tokens unlocked per 24h day", json_schema_extra={"example": 432000000.0})
    status: StreamStatus = Field(..., description="High-level lifecycle status", json_schema_extra={"example": StreamStatus.ACTIVE})


class ProtocolMetricsResponse(BaseModel):
    tvl_stroops: int = Field(..., description="Total Value Locked across all active streams (in stroops)", json_schema_extra={"example": 5500000000})
    tvl_formatted: float = Field(..., description="TVL formatted in whole token units", json_schema_extra={"example": 550.0})
    total_streams: int = Field(..., description="Total streams ever created", json_schema_extra={"example": 14})
    active_streams: int = Field(..., description="Currently streaming streams", json_schema_extra={"example": 11})
    total_claimed_stroops: int = Field(..., description="Total tokens claimed by recipients", json_schema_extra={"example": 1200000000})
    total_claimed_formatted: float = Field(..., description="Total yield claimed formatted", json_schema_extra={"example": 120.0})
    unique_senders: int = Field(..., description="Count of distinct funder accounts", json_schema_extra={"example": 4})
    unique_recipients: int = Field(..., description="Count of distinct beneficiary accounts", json_schema_extra={"example": 9})


class StreamEventRecord(BaseModel):
    id: int = Field(..., description="Event log ID", json_schema_extra={"example": 1})
    stream_id: int = Field(..., description="Referenced stream ID", json_schema_extra={"example": 1})
    event_type: str = Field(..., description="Event name (created, withdraw, cancelled)", json_schema_extra={"example": "withdraw"})
    actor: str = Field(..., description="Caller address who triggered event", json_schema_extra={"example": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H"})
    amount: int = Field(..., description="Amount transferred in stroops", json_schema_extra={"example": 200000000})
    timestamp: int = Field(..., description="Ledger timestamp of event", json_schema_extra={"example": 1700100000})
    tx_hash: str | None = Field(None, description="Stellar transaction hash", json_schema_extra={"example": "a9b3...ef41"})


class TokenVerificationResponse(BaseModel):
    address: str = Field(..., description="Token contract address", json_schema_extra={"example": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"})
    symbol: str = Field(..., description="SAC token symbol", json_schema_extra={"example": "USDC"})
    name: str = Field(..., description="Token display name", json_schema_extra={"example": "Circle USD Coin"})
    decimals: int = Field(..., description="Decimal precision", json_schema_extra={"example": 7})
    is_sep41_compliant: bool = Field(..., description="Complies with Soroban SEP-41 Token Standard", json_schema_extra={"example": True})
    is_verified: bool = Field(..., description="Whitelisted / verified asset", json_schema_extra={"example": True})


class WebhookSubscribeRequest(BaseModel):
    stream_id: int | None = Field(None, description="Optional stream ID to watch (null watches all)", json_schema_extra={"example": 1})
    recipient: str | None = Field(None, description="Optional recipient address to watch", json_schema_extra={"example": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H"})
    webhook_url: str = Field(..., description="HTTP POST endpoint to deliver notifications", json_schema_extra={"example": "https://api.mydao.org/webhooks/vesting"})
    events: list[str] = Field(default=["created", "withdraw", "cliff_reached", "cancelled"], description="List of events to trigger webhook")


class WebhookSubscriptionModel(BaseModel):
    id: int
    webhook_url: str
    stream_id: int | None
    recipient: str | None
    events: str
    created_at: int
    is_active: bool


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS streams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender TEXT NOT NULL,
                recipient TEXT NOT NULL,
                token TEXT NOT NULL,
                token_symbol TEXT DEFAULT 'USDC',
                token_decimals INTEGER DEFAULT 7,
                total_amount INTEGER NOT NULL,
                claimed_amount INTEGER DEFAULT 0,
                start_time INTEGER NOT NULL,
                cliff_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                revocable INTEGER NOT NULL,
                is_cancelled INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS stream_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stream_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                actor TEXT NOT NULL,
                amount INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                tx_hash TEXT,
                FOREIGN KEY (stream_id) REFERENCES streams(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS webhooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                webhook_url TEXT NOT NULL,
                stream_id INTEGER,
                recipient TEXT,
                events TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                is_active INTEGER DEFAULT 1
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tokens (
                address TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                name TEXT NOT NULL,
                decimals INTEGER NOT NULL,
                is_sep41 INTEGER DEFAULT 1,
                is_verified INTEGER DEFAULT 1
            )
        """)
        # Seed default verified SAC tokens: native XLM and USDC
        conn.execute("""
            INSERT OR IGNORE INTO tokens (address, symbol, name, decimals, is_sep41, is_verified)
            VALUES 
            ('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', 'USDC', 'USD Coin', 7, 1, 1),
            ('CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2SLH34INTBP', 'XLM', 'Stellar Lumens', 7, 1, 1),
            ('CBIELTK6Y35ZG52IBNEQ6UQXNCJEHNOAAA57G45CRCHXS64UVMOPL5US', 'AQUA', 'Aquarius Token', 7, 1, 1)
        """)
    conn.close()
