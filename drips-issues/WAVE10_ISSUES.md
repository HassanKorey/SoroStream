# SoroStream: Drips Wave Maintainer Issues Definition (12 Issues)

This document specifies the 12 pre-scoped contributor issues for **SoroStream** as defined in the **Master Technical Specification & Engineering Blueprint**. Each issue is classified under Drips Wave complexity tiers and awarded maintainer governance points.

| Issue # | Title | Complexity Tier | Points | Core Deliverable |
|---|---|---|---|---|
| **#1** | OpenAPI Metadata & Schema Documentation | Trivial | 100 pts | Enhance FastAPI route metadata, query descriptions, and 402/200 schema examples |
| **#2** | Unit Tests for Soroban Contract Getter Functions | Trivial | 100 pts | Write Rust unit tests verifying `get_stream()` data accuracy and panic handling |
| **#3** | Tailwind Component Polishing & BUX Theme Integration | Trivial | 100 pts | Refactor UI button states, apply BUX glassmorphism borders (`border-white/10`) |
| **#4** | Soroban CLI Deployment Script & Testnet Auto-Funding | Medium | 150 pts | Build bash script utilizing `stellar-cli` to compile WASM, deploy, and fund via Friendbot |
| **#5** | Real-Time Vesting Ticker & Progress Bar Component | Medium | 150 pts | React component calculating per-second stream unlocks & animating live progress |
| **#6** | Stream Cancellation & Revocation Event Handler | Medium | 150 pts | Contract event parsing in backend indexer tracking `cancel` events and DB updates |
| **#7** | Freighter Wallet Integration & Contract Helper | Medium | 150 pts | Connect `@stellar/stellar-sdk` and Freighter extension to sign & submit transactions |
| **#8** | Multi-Token SAC Verification Engine | High | 200 pts | Extend contract and API to support arbitrary Soroban Asset Contracts (SEP-41) |
| **#9** | Security Vector Pytest Suite for Attack Simulation | High | 200 pts | Async tests simulating cliff bypass, double-withdraw, integer overflow, illegal cancels |
| **#10** | TypeScript Client SDK (`@sorostream/sdk`) | High | 200 pts | Automated TypeScript client library wrapping stream creation, claim math, RPC polling |
| **#11** | Automated Recipient Notification Webhook Worker | Medium | 150 pts | Worker service monitoring on-chain stream creations / cliff unlocks and sending webhooks |
| **#12** | Batch Stream Creation & CSV Bulk Vesting Importer | High | 200 pts | dApp component allowing DAOs/orgs to upload CSV rosters and execute bulk escrows |

---

## Detailed Issue Specifications

### Issue #1: OpenAPI Metadata & Schema Documentation
- **Tier**: Trivial (100 pts)
- **Component**: `backend/app/main.py`, `backend/app/models.py`
- **Scope**:
  - Add comprehensive summary, description, and OpenAPI response examples to all FastAPI endpoints.
  - Document query parameters (`sender`, `recipient`, `token`, `status`, `limit`, `offset`).
  - Provide realistic 200 OK, 400 Bad Request, and 404 Not Found schema responses.
- **Acceptance Criteria**:
  - Interactive docs at `/docs` (Swagger UI) and `/redoc` display detailed schema samples.
  - All Pydantic request models include `Field(..., description=...)` annotations.

### Issue #2: Unit Tests for Soroban Contract Getter Functions
- **Tier**: Trivial (100 pts)
- **Component**: `contracts/vesting_stream/src/test.rs`
- **Scope**:
  - Verify `get_stream(stream_id)` returns exact stream record data, unlocked tokens, and claimable amounts.
  - Verify query for non-existent stream returns `Error::StreamNotFound`.
  - Validate `get_stream_count()` and `get_admin()`.
- **Acceptance Criteria**:
  - `cargo test` executes and passes all getter unit tests.

### Issue #3: Tailwind Component Polishing & BUX Theme Integration
- **Tier**: Trivial (100 pts)
- **Component**: `frontend/src/styles`, `frontend/src/components`
- **Scope**:
  - Implement BUX-inspired glassmorphic cards with `#090D16` canvas, `#10B981` accents, and `border-white/10`.
  - Standardize button states (hover glow, active press, disabled state).
- **Acceptance Criteria**:
  - Components render consistently with sleek dark theme and responsive layout.

### Issue #4: Soroban CLI Deployment Script & Testnet Auto-Funding
- **Tier**: Medium (150 pts)
- **Component**: `scripts/deploy_testnet.sh`
- **Scope**:
  - Create automated deployment script using `stellar` / `soroban` CLI.
  - Automate Friendbot funding of deployer keys on Stellar testnet.
  - Compile WASM, deploy contract, and initialize with deployer admin.
- **Acceptance Criteria**:
  - Script executes end-to-end, writing `.env.testnet` containing `SOROSTREAM_CONTRACT_ID`.

### Issue #5: Real-Time Vesting Ticker & Progress Bar Component
- **Tier**: Medium (150 pts)
- **Component**: `frontend/src/components/StreamTicker.tsx`, `frontend/src/components/VestingVisualizer.tsx`
- **Scope**:
  - Render dynamic per-second unlocked tokens ticker using client ledger extrapolation.
  - Display SVG linear vesting curve with cliff milestone indicators.
- **Acceptance Criteria**:
  - Ticker increments smoothly every second and accurately reflects claimable balance.

### Issue #6: Stream Cancellation & Revocation Event Handler
- **Tier**: Medium (150 pts)
- **Component**: `backend/app/soroban_client.py`, `backend/app/models.py`
- **Scope**:
  - Parse Soroban contract `cancel` events containing `(stream_id, claimable_to_recipient, refund_to_sender)`.
  - Update cached database stream state (`is_cancelled = true`, `status = cancelled`).
- **Acceptance Criteria**:
  - Stream events are accurately ingested and reflected in database and `/api/streams/{id}` endpoint.

### Issue #7: Freighter Wallet Integration & Contract Helper
- **Tier**: Medium (150 pts)
- **Component**: `frontend/src/lib/freighter.ts`, `frontend/src/lib/soroban.ts`
- **Scope**:
  - Integrate Freighter wallet browser extension for address retrieval and transaction signing.
  - Build helper routines for building, simulating, and submitting Soroban transactions.
- **Acceptance Criteria**:
  - Users can connect wallet, sign `create_stream`, `withdraw`, and `cancel_stream` transactions.

### Issue #8: Multi-Token SAC Verification Engine
- **Tier**: High (200 pts)
- **Component**: `backend/app/main.py`, `contracts/vesting_stream/src/lib.rs`
- **Scope**:
  - Implement `/api/tokens/{address}/verify` to validate SEP-41 Soroban Asset Contracts.
  - Verify token symbol, decimals, name, and sender trustlines.
- **Acceptance Criteria**:
  - Verification endpoint returns token metadata and flags unsupported non-compliant assets.

### Issue #9: Security Vector Pytest Suite for Attack Simulation
- **Tier**: High (200 pts)
- **Component**: `backend/tests/test_security_vectors.py`
- **Scope**:
  - Write test suite simulating exploit vectors:
    - Pre-cliff early claim bypass attempts.
    - Double-withdraw race conditions.
    - Unauthorized stream revocation by third party.
    - Revocation of non-revocable stream.
    - Numerical overflow / zero-duration stream attacks.
- **Acceptance Criteria**:
  - All security vector tests pass and assert expected contract/API rejection codes.

### Issue #10: TypeScript Client SDK (`@sorostream/sdk`)
- **Tier**: High (200 pts)
- **Component**: `sdk/src/`
- **Scope**:
  - Export full TypeScript library with classes `SoroStreamClient`, `VestingMath`, and types.
  - Provide pure client-side math functions for instantaneous linear calculations.
- **Acceptance Criteria**:
  - `npm run build && npm test` builds cleanly and passes unit tests.

### Issue #11: Automated Recipient Notification Webhook Worker
- **Tier**: Medium (150 pts)
- **Component**: `backend/app/webhook_worker.py`
- **Scope**:
  - Build async worker service polling active streams for cliff threshold crossings.
  - Deliver HTTP POST webhooks to subscribed recipient endpoints with retry logic.
- **Acceptance Criteria**:
  - Worker dispatches webhook payloads and tracks subscription state.

### Issue #12: Batch Stream Creation & CSV Bulk Vesting Importer
- **Tier**: High (200 pts)
- **Component**: `contracts/vesting_stream/src/lib.rs`, `frontend/src/components/CsvBatchImporter.tsx`
- **Scope**:
  - Implement contract function `create_stream_batch` for atomic bulk vesting escrows.
  - Develop front-end CSV parser validating recipient addresses, token amounts, and timelines.
- **Acceptance Criteria**:
  - Batch creation executes in contract and CSV importer validates input roster.
