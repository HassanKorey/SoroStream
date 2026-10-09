#!/usr/bin/env python3
"""
Publishes the 12 pre-scoped contributor issues to the GitHub repository.
"""

import json
import time
import urllib.request

import os
TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO = "HassanKorey/SoroStream"
API_URL = f"https://api.github.com/repos/{REPO}/issues"

headers = {
    "Authorization": f"token {TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "SoroStream-Issue-Publisher",
    "Content-Type": "application/json",
}

issues = [
    {
        "title": "OpenAPI Metadata & Schema Documentation",
        "labels": ["documentation", "tier:trivial", "backend"],
        "body": """### Summary
Enhance FastAPI route metadata, query parameter descriptions, and response examples across all indexer endpoints.

### Scope & Deliverables
- [ ] Add comprehensive route docstrings, summaries, and OpenAPI tags in `backend/app/main.py`.
- [ ] Annotate query parameters (`sender`, `recipient`, `token`, `status`, `limit`, `offset`) with descriptive validation constraints.
- [ ] Include realistic response examples for 200 OK, 400 Bad Request, and 404 Not Found in Pydantic schema models.
- [ ] Ensure Swagger UI (`/docs`) and ReDoc (`/redoc`) render complete schemas without missing types.

### Drips Wave Classification
- **Tier**: Trivial (100 pts)
- **Component**: `backend/app/main.py`, `backend/app/models.py`
""",
    },
    {
        "title": "Unit Tests for Soroban Contract Getter Functions",
        "labels": ["enhancement", "tier:trivial", "contracts"],
        "body": """### Summary
Write Rust unit tests verifying contract getter functions (`get_stream`, `get_stream_count`, `get_admin`) and invalid ID panic handling.

### Scope & Deliverables
- [ ] Verify `get_stream(stream_id)` returns accurate stream details, dynamic unlocked amounts, and claimable balances.
- [ ] Validate panic / error return on non-existent stream ID (`Error::StreamNotFound`).
- [ ] Verify `get_stream_count()` increments sequentially upon stream creation.
- [ ] Assert `get_admin()` returns the initialized administrator address.

### Drips Wave Classification
- **Tier**: Trivial (100 pts)
- **Component**: `contracts/vesting_stream/src/test.rs`
""",
    },
    {
        "title": "Tailwind Component Polishing & BUX Theme Integration",
        "labels": ["enhancement", "tier:trivial", "frontend"],
        "body": """### Summary
Refactor UI button states, apply BUX glassmorphism borders (`border-white/10`), and implement dark mode accent glows.

### Scope & Deliverables
- [ ] Implement high-contrast dark canvas (`#090D16`) with emerald (`#10B981`) and lime (`#84CC16`) glowing accents.
- [ ] Refactor button hover, active press, and disabled states with subtle tactile feedback.
- [ ] Apply glassmorphic backdrop filters (`backdrop-blur-md`) with ultra-thin semi-transparent borders.
- [ ] Integrate modern serif italic typographic accents alongside monospaced numerical tickers.

### Drips Wave Classification
- **Tier**: Trivial (100 pts)
- **Component**: `frontend/src/styles/globals.css`, `frontend/src/components/`
""",
    },
    {
        "title": "Soroban CLI Deployment Script & Testnet Auto-Funding",
        "labels": ["enhancement", "tier:medium", "scripts"],
        "body": """### Summary
Build a bash automation script utilizing `stellar-cli` to compile WASM, deploy to Stellar testnet, and fund test keys via Friendbot.

### Scope & Deliverables
- [ ] Validate presence of `stellar` or `soroban` CLI binary.
- [ ] Automate keypair creation and Friendbot account funding for deployer on testnet.
- [ ] Compile Rust smart contract to `wasm32-unknown-unknown` target.
- [ ] Deploy WASM bytecode to Stellar Testnet and invoke `initialize(admin)`.
- [ ] Generate `.env.testnet` configuration artifact containing the deployed Contract ID.

### Drips Wave Classification
- **Tier**: Medium (150 pts)
- **Component**: `scripts/deploy_testnet.sh`
""",
    },
    {
        "title": "Real-Time Vesting Ticker & Progress Bar Component",
        "labels": ["enhancement", "tier:medium", "frontend"],
        "body": """### Summary
Develop a React component calculating per-second stream unlocks and animating real-time claimable progress.

### Scope & Deliverables
- [ ] Compute linear unlocked tokens dynamically using client ledger time extrapolation:
  $$\\text{Unlocked}(t) = \\text{total} \\times \\frac{t - \\text{start}}{\\text{end} - \\text{start}}$$
- [ ] Render a live per-second ticking counter updating continuously without manual page refreshes.
- [ ] Display an animated gradient progress bar reflecting percentage vested.
- [ ] Handle pre-cliff lockup states (0 tokens unlocked until cliff timestamp).

### Drips Wave Classification
- **Tier**: Medium (150 pts)
- **Component**: `frontend/src/components/StreamTicker.tsx`
""",
    },
    {
        "title": "Stream Cancellation & Revocation Event Handler",
        "labels": ["enhancement", "tier:medium", "backend"],
        "body": """### Summary
Implement contract event parsing in the backend indexer to track `cancel` events and update database state.

### Scope & Deliverables
- [ ] Ingest Soroban contract events with topic symbol `cancel`.
- [ ] Extract cancellation payload: `(stream_id, claimable_to_recipient, refund_to_sender)`.
- [ ] Update cached stream status to `cancelled` and record historical revocation event in SQLite cache.
- [ ] Expose stream cancellation metadata via `/api/streams/{id}`.

### Drips Wave Classification
- **Tier**: Medium (150 pts)
- **Component**: `backend/app/soroban_client.py`, `backend/app/models.py`
""",
    },
    {
        "title": "Freighter Wallet Integration & Contract Helper",
        "labels": ["enhancement", "tier:medium", "frontend"],
        "body": """### Summary
Connect `@stellar/stellar-sdk` and Freighter wallet extension to sign and submit create_stream and withdraw transactions.

### Scope & Deliverables
- [ ] Detect Freighter wallet extension and manage connection lifecycle.
- [ ] Retrieve authenticated user public key and network passphrase.
- [ ] Build contract invocation transactions for `create_stream`, `withdraw`, and `cancel_stream`.
- [ ] Request Freighter signing and submit signed XDR envelope to Soroban RPC.

### Drips Wave Classification
- **Tier**: Medium (150 pts)
- **Component**: `frontend/src/lib/freighter.ts`
""",
    },
    {
        "title": "Multi-Token SAC Verification Engine",
        "labels": ["enhancement", "tier:high", "contracts", "backend"],
        "body": """### Summary
Extend contract and backend to support arbitrary Soroban Asset Contracts (SEP-41), verifying decimals, symbols, and trustlines.

### Scope & Deliverables
- [ ] Implement backend endpoint `/api/tokens/{address}/verify` querying token metadata via RPC.
- [ ] Verify token adheres to SEP-41 interface (`balance`, `transfer`, `decimals`, `name`, `symbol`).
- [ ] Handle decimal conversion between stroops ($10^7$) and custom asset precision.
- [ ] Provide frontend warning when encountering unverified or non-SAC compliant assets.

### Drips Wave Classification
- **Tier**: High (200 pts)
- **Component**: `backend/app/main.py`, `contracts/vesting_stream/src/lib.rs`
""",
    },
    {
        "title": "Security Vector Pytest Suite for Attack Simulation",
        "labels": ["enhancement", "tier:high", "backend"],
        "body": """### Summary
Write an automated security attack simulation suite verifying smart contract resilience against known exploit vectors.

### Scope & Deliverables
- [ ] **Cliff Bypass Attempt**: Simulate withdrawal before cliff timestamp and verify rejection.
- [ ] **Double-Withdrawal Race Condition**: Simulate concurrent claims attempting to drain escrowed funds.
- [ ] **Unauthorized Revocation**: Test cancellation attempts by non-sender / malicious third party.
- [ ] **Illegal Revocation**: Attempt cancelling a stream configured with `revocable = false`.
- [ ] **Integer Overflow & Zero Duration**: Test boundary inputs ($t_{\\text{start}} = t_{\\text{end}}$, negative amounts).

### Drips Wave Classification
- **Tier**: High (200 pts)
- **Component**: `backend/tests/test_security_vectors.py`
""",
    },
    {
        "title": "TypeScript Client SDK (@sorostream/sdk)",
        "labels": ["enhancement", "tier:high", "sdk"],
        "body": """### Summary
Publish an automated TypeScript client library wrapping stream creation, claim calculations, and RPC polling.

### Scope & Deliverables
- [ ] Export `SoroStreamClient` class for interacting with Soroban contract methods.
- [ ] Implement pure client-side mathematical calculation engine (`calculateVesting`).
- [ ] Define shared TypeScript interfaces (`StreamRecord`, `StreamCalculation`, `CreateStreamArgs`).
- [ ] Provide automated build scripts (`tsc`) and unit test suite.

### Drips Wave Classification
- **Tier**: High (200 pts)
- **Component**: `sdk/src/`
""",
    },
    {
        "title": "Automated Recipient Notification Webhook Worker",
        "labels": ["enhancement", "tier:medium", "backend"],
        "body": """### Summary
Build a lightweight background worker service monitoring on-chain stream creations or cliff unlocks and sending webhook notifications.

### Scope & Deliverables
- [ ] Background polling daemon periodically inspecting active streams in the database.
- [ ] Trigger events on cliff milestone reached and stream fully vested (100%).
- [ ] Dispatch HTTP POST webhooks to registered beneficiary URLs with signed HMAC payload.
- [ ] Retry failed deliveries with exponential backoff.

### Drips Wave Classification
- **Tier**: Medium (150 pts)
- **Component**: `backend/app/webhook_worker.py`
""",
    },
    {
        "title": "Batch Stream Creation & CSV Bulk Vesting Importer",
        "labels": ["enhancement", "tier:high", "contracts", "frontend"],
        "body": """### Summary
Develop contract batch creation method and a dApp component allowing DAOs/orgs to upload CSV rosters and execute bulk streaming escrows in a single transaction.

### Scope & Deliverables
- [ ] Contract method `create_stream_batch(sender, streams: Vec<CreateStreamArgs>)`.
- [ ] Frontend CSV file uploader and parser with client-side syntax validation.
- [ ] Validation of recipient public keys, positive token amounts, and valid chronological timelines ($t_{\\text{start}} \\le t_{\\text{cliff}} < t_{\\text{end}}$).
- [ ] Preview table showing total recipients and aggregated escrow requirements before transaction submission.

### Drips Wave Classification
- **Tier**: High (200 pts)
- **Component**: `contracts/vesting_stream/src/lib.rs`, `frontend/src/components/CsvBatchImporter.tsx`
""",
    },
]

print(f"Publishing {len(issues)} issues to {REPO}...")

published_issues = []
for idx, item in enumerate(issues, start=1):
    data = json.dumps(item).encode("utf-8")
    req = urllib.request.Request(API_URL, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            res_json = json.loads(resp.read().decode())
            number = res_json["number"]
            url = res_json["html_url"]
            print(f"[{idx}/12] Created Issue #{number}: {item['title']} -> {url}")
            published_issues.append({"number": number, "title": item["title"], "url": url})
    except Exception as err:
        print(f"[-] Error publishing '{item['title']}': {err}")
    time.sleep(1)

print("\nDone publishing all issues!")
