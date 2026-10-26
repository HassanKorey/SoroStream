#!/usr/bin/env bash
# ==============================================================================
# SoroStream: Automated Issue Backlog Generation via GitHub CLI (gh)
# Maps 12 pre-scoped issues to Drips Wave complexity tiers & points
# ==============================================================================

set -euo pipefail

TARGET_REPO="${1:-HassanKorey/SoroStream-app}"

echo "=========================================================="
echo "  Publishing Drips Wave Contributor Issues"
echo "  Target Repository: ${TARGET_REPO}"
echo "=========================================================="

# 1. Ensure required labels exist
declare -A LABELS=(
    ["tier:trivial"]="d4c5f9"
    ["tier:medium"]="fbca04"
    ["tier:high"]="b60205"
    ["points:100"]="c2e0c6"
    ["points:150"]="bfd4f2"
    ["points:200"]="f9d0c4"
    ["contract"]="0075ca"
    ["frontend"]="1d76db"
    ["backend"]="5319e7"
    ["sdk"]="0e8a16"
    ["documentation"]="0052cc"
    ["security"]="e99695"
)

for label in "${!LABELS[@]}"; do
    color="${LABELS[$label]}"
    gh label create "$label" --repo "$TARGET_REPO" --color "$color" --force 2>/dev/null || true
done

# Issue 1: Trivial @ 100 pts
gh issue create --repo "$TARGET_REPO" \
    --title "docs(api): add OpenAPI metadata descriptions for FastAPI route parameters" \
    --label "tier:trivial,points:100,documentation,backend" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: Trivial (100 pts)
- **Target Component**: \`backend/app/main.py\`, \`backend/app/models.py\`

### Description
Enhance FastAPI route parameters, query filters, and response schemas with comprehensive OpenAPI descriptions and Swagger UI / Redoc sample values for 200, 400, and 404 responses.

### Acceptance Criteria
- [ ] Document all query parameters (\`sender\`, \`recipient\`, \`token\`, \`status\`, \`limit\`, \`offset\`).
- [ ] Provide realistic schema samples in Pydantic models using \`Field(..., description=...)\`.
- [ ] Verify interactive documentation at \`/docs\` and \`/redoc\` displays complete endpoint metadata."

# Issue 2: Trivial @ 100 pts
gh issue create --repo "$TARGET_REPO" \
    --title "test(contract): add Rust unit tests for get_stream query functions" \
    --label "tier:trivial,points:100,contract" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: Trivial (100 pts)
- **Target Component**: \`contracts/vesting_stream/src/test.rs\`

### Description
Expand Soroban smart contract unit tests in Rust to comprehensively test \`get_stream\`, \`get_stream_count\`, and \`get_admin\` getter queries under both initialized and uninitialized states.

### Acceptance Criteria
- [ ] Write unit test verifying \`get_stream()\` returns exact StreamRecord, unlocked tokens, and claimable balances.
- [ ] Test that querying non-existent stream IDs returns \`Error::StreamNotFound\`.
- [ ] Validate \`get_admin()\` and \`get_stream_count()\` accuracy.
- [ ] Verify entire suite passes cleanly with \`cargo test\`."

# Issue 3: Trivial @ 100 pts
gh issue create --repo "$TARGET_REPO" \
    --title "style(ui): polish Tailwind glassmorphism borders and hover states" \
    --label "tier:trivial,points:100,frontend" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: Trivial (100 pts)
- **Target Component**: \`frontend/src/styles/globals.css\`, \`frontend/src/components/\`

### Description
Refactor Next.js UI elements to adhere strictly to BUX dark glassmorphism standards: dark slate background (\`#090D16\`), glowing emerald accents (\`#10B981\`), and ultra-thin glassmorphic borders (\`border-white/10\`).

### Acceptance Criteria
- [ ] Standardize glassmorphic card borders (\`border-white/10\`) and hover states (\`hover:border-emerald-500/30\`).
- [ ] Apply glowing gradient box shadows (\`shadow-glow-emerald\`) on primary action buttons.
- [ ] Ensure mobile responsive layout rendering across viewports."

# Issue 4: Medium @ 150 pts
gh issue create --repo "$TARGET_REPO" \
    --title "feat(cli): automate testnet WASM compilation and Friendbot funding script" \
    --label "tier:medium,points:150,contract" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: Medium (150 pts)
- **Target Component**: \`scripts/deploy_testnet.sh\`

### Description
Develop a production-grade bash automation script utilizing \`stellar-cli\` to compile the vesting_stream contract to WASM, request Friendbot funding for deployer keys, deploy contract to Stellar testnet, and initialize admin storage.

### Acceptance Criteria
- [ ] Detect \`stellar\` or \`soroban\` CLI in PATH with actionable error handling.
- [ ] Automatically check keypair identity and top up funds via Friendbot.
- [ ] Compile WASM, deploy to testnet, and invoke \`initialize\` method.
- [ ] Output configuration artifacts into \`.env.testnet\` and \`frontend/.env.local\`."

# Issue 5: Medium @ 150 pts
gh issue create --repo "$TARGET_REPO" \
    --title "feat(ui): implement real-time per-second stream ticker component" \
    --label "tier:medium,points:150,frontend" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: Medium (150 pts)
- **Target Component**: \`frontend/src/components/StreamTicker.tsx\`

### Description
Build a real-time React ticker component computing per-second token unlocks client-side using ledger timestamps, animating live claimable increments and visual unlock progress.

### Acceptance Criteria
- [ ] Render per-second claimable counter incrementing smoothly in real time.
- [ ] Display countdown badge for cliff lockups (\`formatCountdown\`).
- [ ] Show gradient progress bar (\`from-emerald-500 via-emerald-400 to-lime-400\`) reflecting vested percentage.
- [ ] One-click claim button with disabled state during cliff or when claimable balance is zero."

# Issue 6: Medium @ 150 pts
gh issue create --repo "$TARGET_REPO" \
    --title "feat(indexer): build event listener for StreamCancelled contract events" \
    --label "tier:medium,points:150,backend" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: Medium (150 pts)
- **Target Component**: \`backend/app/soroban_client.py\`, \`backend/app/main.py\`

### Description
Implement an on-chain event ingestion listener in the FastAPI indexer to track \`StreamCancelled\` and \`cancel\` contract events, update cached SQLite stream state (\`is_cancelled = 1\`, \`status = cancelled\`), and record audit trail records.

### Acceptance Criteria
- [ ] Add \`handle_stream_cancelled\` and \`ingest_event\` methods in \`SorobanClient\`.
- [ ] Expose \`POST /api/events/ingest\` endpoint for listener and worker events.
- [ ] Verify stream queries and audit logs immediately reflect cancelled state.
- [ ] Include automated pytest test verifying event ingestion."

# Issue 7: Medium @ 150 pts
gh issue create --repo "$TARGET_REPO" \
    --title "feat(wallet): connect Freighter browser extension for contract invocation" \
    --label "tier:medium,points:150,frontend" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: Medium (150 pts)
- **Target Component**: \`frontend/src/lib/freighter.ts\`, \`frontend/src/components/Navbar.tsx\`

### Description
Integrate the Freighter wallet browser extension with \`@stellar/stellar-sdk\` to enable users to connect their Stellar accounts, retrieve public keys, and sign Soroban contract transactions (\`create_stream\`, \`withdraw\`, \`cancel_stream\`).

### Acceptance Criteria
- [ ] Detect Freighter extension availability and prompt user installation if missing.
- [ ] Display connected wallet address and truncated badge in Navbar.
- [ ] Helper functions to sign XDR transaction payloads across testnet and mainnet."

# Issue 8: Medium @ 150 pts
gh issue create --repo "$TARGET_REPO" \
    --title "feat(webhook): build automated webhook worker for stream cliff milestones" \
    --label "tier:medium,points:150,backend" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: Medium (150 pts)
- **Target Component**: \`backend/app/webhook_worker.py\`

### Description
Build an asynchronous background worker service monitoring active streams for cliff threshold crossings and delivery milestone webhooks to subscribed recipient endpoints with exponential backoff retries.

### Acceptance Criteria
- [ ] Background polling task checking active streams for cliff crossing events.
- [ ] HTTP POST webhook dispatching with JSON payloads to subscribed URLs.
- [ ] Retry logic for failed delivery attempts with configurable backoff."

# Issue 9: High @ 200 pts
gh issue create --repo "$TARGET_REPO" \
    --title "feat(contract): implement multi-token SAC (SEP-41) verification engine" \
    --label "tier:high,points:200,contract,backend" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: High (200 pts)
- **Target Component**: \`backend/app/main.py\`, \`frontend/src/pages/api/tokens/\`

### Description
Extend smart contract escrow and indexer API to support arbitrary Soroban Asset Contracts (SEP-41), validating token symbol, decimals, name, and sender trustlines before stream creation.

### Acceptance Criteria
- [ ] Support native XLM, USDC, and custom SEP-41 token contracts.
- [ ] Implement \`POST /api/tokens/verify\` and \`GET /api/tokens\` in indexer.
- [ ] Frontend token selector validating asset contract and displaying decimals."

# Issue 10: High @ 200 pts
gh issue create --repo "$TARGET_REPO" \
    --title "test(security): write async pytest suite simulating attack vectors" \
    --label "tier:high,points:200,security,backend" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: High (200 pts)
- **Target Component**: \`backend/tests/test_security_vectors.py\`

### Description
Implement an async test suite simulating high-severity adversarial attack scenarios against the streaming protocol:
1. Cliff bypass attempts (withdrawing tokens before cliff timestamp).
2. Double-withdraw race conditions.
3. Integer overflow and time bound corruption.
4. Unauthorized revocation by third party.
5. Double cancellation attacks.

### Acceptance Criteria
- [ ] All 5 security vector simulations implemented with assert checks for HTTP rejection codes.
- [ ] Full suite passes cleanly via \`pytest\`."

# Issue 11: High @ 200 pts
gh issue create --repo "$TARGET_REPO" \
    --title "feat(sdk): publish TypeScript client library (@sorostream/sdk)" \
    --label "tier:high,points:200,sdk" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: High (200 pts)
- **Target Component**: \`sdk/\`

### Description
Publish an automated, typed TypeScript client library (\`@sorostream/sdk\`) providing contract wrappers, pure client-side mathematical vesting calculations, balance polling, and Freighter transaction signing.

### Acceptance Criteria
- [ ] Implement \`SoroStreamClient\` class with full CRUD methods.
- [ ] Pure mathematical helpers \`calculateVesting\` for instantaneous linear state.
- [ ] High-frequency polling helpers \`pollClaimableBalance\` and \`pollBalance\`.
- [ ] Pass 100% of unit tests with \`npm test\`."

# Issue 12: High @ 200 pts
gh issue create --repo "$TARGET_REPO" \
    --title "feat(frontend): build CSV bulk stream importer for corporate payroll" \
    --label "tier:high,points:200,frontend" \
    --body "### Drips Wave Contributor Issue
- **Complexity Tier**: High (200 pts)
- **Target Component**: \`frontend/src/components/CsvBatchImporter.tsx\`, \`frontend/src/pages/batch.tsx\`

### Description
Develop a dApp interface allowing DAOs and organizations to upload CSV recipient rosters, validate Stellar public keys and token amounts, preview aggregate payroll costs, and execute atomic batch stream creation in a single transaction.

### Acceptance Criteria
- [ ] Drag-and-drop CSV file uploader with schema validation.
- [ ] Error highlighting for invalid Stellar addresses or non-positive amounts.
- [ ] Real-time total escrow calculation and token breakdown preview.
- [ ] One-click batch transaction submission via Freighter wallet."

echo "[+] Successfully published 12 pre-scoped issues to ${TARGET_REPO}!"
