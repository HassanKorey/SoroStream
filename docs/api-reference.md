# FastAPI Indexer & RPC Engine API Reference

The SoroStream backend provides an OpenAPI-compliant REST engine for caching on-chain stream states, computing mathematical linear vesting states, verifying SEP-41 SAC tokens, and dispatching webhook notifications.

Interactive Swagger documentation is available at `/docs` and ReDoc at `/redoc`.

---

## Health & Metrics

### `GET /api/health`
Checks backend indexer operational health and Soroban RPC connectivity.
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "service": "sorostream-indexer",
  "version": "1.0.0",
  "timestamp": 1700000000,
  "soroban_rpc": {
    "status": "healthy",
    "network": "soroban-testnet"
  }
}
```

### `GET /api/metrics`
Returns global protocol metrics and statistics.
- **Response**: `200 OK`
```json
{
  "tvl_stroops": 45000000000,
  "tvl_formatted": 4500.0,
  "total_streams": 14,
  "active_streams": 11,
  "total_claimed_stroops": 1200000000,
  "total_claimed_formatted": 120.0,
  "unique_senders": 4,
  "unique_recipients": 9
}
```

---

## Streams

### `GET /api/streams`
Lists streams matching query parameters.
- **Query Parameters**:
  - `sender` (string, optional): Stellar public key of stream creator.
  - `recipient` (string, optional): Stellar public key of stream recipient.
  - `token` (string, optional): SAC token contract address.
  - `status` (string, optional): `active`, `cliff_pending`, `completed`, `cancelled`.
  - `limit` (integer, default `50`): Maximum results to return (1-100).
  - `offset` (integer, default `0`): Pagination offset.
- **Response**: `200 OK` with list of `StreamDetailResponse`.

### `POST /api/streams`
Creates and registers a new stream escrow.
- **Request Body**:
```json
{
  "sender": "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO",
  "recipient": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H",
  "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  "amount": 10000000,
  "start_time": 1700000000,
  "cliff_time": 1700050000,
  "end_time": 1700200000,
  "revocable": true
}
```
- **Response**: `201 Created`

### `GET /api/streams/{stream_id}`
Returns real-time stream status, unlocked balances, and claimable deltas.
- **Path Parameter**: `stream_id` (integer)
- **Response**: `200 OK`

### `POST /api/streams/{stream_id}/withdraw`
Executes token claim for unlocked balance.
- **Path Parameter**: `stream_id` (integer)
- **Query Parameter**: `actor` (string, optional)
- **Response**: `200 OK`

### `POST /api/streams/{stream_id}/cancel`
Revokes an active stream escrow (sender only).
- **Path Parameter**: `stream_id` (integer)
- **Query Parameter**: `sender` (string, required)
- **Response**: `200 OK`

### `POST /api/streams/batch`
Bulk stream creation for payroll cohorts and DAO contributor distributions.
- **Request Body**:
```json
{
  "sender": "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO",
  "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  "items": [
    {
      "recipient": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H",
      "amount": 500000000,
      "start_time": 1700000000,
      "cliff_time": 1700050000,
      "end_time": 1700200000,
      "revocable": true
    }
  ]
}
```
- **Response**: `201 Created`

---

## Token Verification & SEP-41

### `GET /api/tokens`
Lists all verified Soroban Asset Contracts.

### `POST /api/tokens/verify`
Verifies an arbitrary contract address against SEP-41 token standards.
- **Query Parameter**: `address` (string)
- **Response**: `200 OK`
```json
{
  "address": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  "symbol": "USDC",
  "name": "USD Coin",
  "decimals": 7,
  "is_sep41_compliant": true,
  "is_verified": true
}
```

---

## Event Ingestion & Webhooks

### `GET /api/events`
Returns stream event audit logs.
- **Query Parameters**: `stream_id` (optional), `limit` (default 50).

### `POST /api/events/ingest`
Hardened on-chain event ingestion endpoint for Soroban listeners. Accurately tracks `StreamCancelled` events, updates SQLite records, and triggers webhooks.
- **Request Body**:
```json
{
  "event_type": "StreamCancelled",
  "stream_id": 1,
  "actor": "GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO",
  "amount": 5000000,
  "claimable_to_recipient": 5000000,
  "refund_to_sender": 20000000,
  "timestamp": 1700100000,
  "tx_hash": "tx_cancellation_abc123"
}
```
- **Response**: `200 OK`

### `POST /api/webhooks/subscribe`
Registers an HTTP webhook URL to receive stream milestone notifications.
- **Request Body**:
```json
{
  "stream_id": 1,
  "recipient": "GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H",
  "webhook_url": "https://api.mydao.org/webhooks/vesting",
  "events": ["created", "withdraw", "cliff_reached", "cancelled"]
}
```
- **Response**: `201 Created`
