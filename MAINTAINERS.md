# Maintainer Governance & Review Policy

This document outlines the multi-maintainer governance guidelines, code review responsibilities, and release protocols for the **SoroStream** protocol.

---

## 👥 Core Maintainers & Co-Maintainer Roster

| Role | Handle / Name | Responsibilities | Review Scope |
| :--- | :--- | :--- | :--- |
| **Lead Architect & Maintainer** | Hassan Korey (`@HassanKorey` / `@hedun`) | Smart contract protocol architecture, security, final merge authority | `contracts/`, `scripts/`, Governance |
| **Protocol Co-Maintainer** | Core Indexer Lead (`@SoroStream-Core`) | RPC indexer backend, SQLite/PostgreSQL caching, webhook workers | `backend/`, `scripts/` |
| **Frontend & UX Co-Maintainer** | Frontend Systems Lead (`@SoroStream-UX`) | Next.js dApp, BUX dark design system, Freighter wallet UX | `frontend/`, `sdk/` |
| **SDK & Integrations Co-Maintainer** | Ecosystem Lead (`@SoroStream-SDK`) | `@sorostream/sdk` distribution, npm releases, developer tooling | `sdk/`, documentation |

---

## 🛡️ Multi-Maintainer Review Procedures

1. **Pull Request Review SLA**:
   - Every community PR is assigned to at least one primary co-maintainer within **24 hours**.
   - Standard review feedback cycles are guaranteed within **48 hours**.

2. **Branch Protection & Approval Quorums**:
   - The `main` branch is strictly protected: direct pushes and force pushes are blocked.
   - **General Changes** (`frontend/`, `docs/`, `sdk/`): Require at least **1 approving review** from a designated co-maintainer.
   - **Smart Contract Changes** (`contracts/vesting_stream/`): Require **at least 2 maintainer sign-offs**, including the Smart Contract Lead Architect.
   - All automated CI quality gates must pass cleanly before any PR can be merged:
     - Soroban contract formatting (`cargo fmt`), clippy (`-D warnings`), and test suites (`cargo test`).
     - TypeScript SDK build and unit tests (`npm test`).
     - Next.js frontend production compilation (`npm run build`).
     - Backend indexer linting (`ruff`), typing (`mypy`), and security vector tests (`pytest`).

3. **Smart Contract Security Verification Gate**:
   - Any modification modifying contract state storage (`DataKey`), vesting math, cliff validation, or fund transfers must include:
     1. Unit tests in `contracts/vesting_stream/src/test.rs` covering all boundary conditions.
     2. Updated test snapshots.
     3. Exploit simulation vectors in `backend/tests/test_security_vectors.py`.

4. **Co-Maintainer Merge Protocol**:
   - Once review quorums and CI quality gates are met, the approving co-maintainer performs a **Squash and Merge** or **Rebase and Merge** to maintain a linear and readable git history.
   - PR titles must adhere to Conventional Commits format (`feat:`, `fix:`, `test:`, `docs:`, `ci:`).

---

## 🚨 Emergency Response & Key Management

- In the event of an identified vulnerability, maintainers coordinate via a private security channel.
- If emergency mitigation is required, a hotfix PR requires 2 core maintainer sign-offs and immediate deployment via `scripts/deploy_testnet.sh`.
- Deployer identities and testnet admin credentials are rotated through multi-signature key custodians.

---

## 🚀 Release Management

1. **Smart Contracts**:
   - WASM binaries are built with reproducible bytecode using `stellar contract build`.
   - Testnet deployments use `scripts/deploy_testnet.sh` with automated ledger state verification.
2. **TypeScript SDK (`@sorostream/sdk`)**:
   - Versioned according to Semantic Versioning (SemVer `MAJOR.MINOR.PATCH`).
   - Published to npm registry upon tagging a release.
3. **Frontend Application**:
   - Deployed continuously via Vercel on `main` branch pushes.
