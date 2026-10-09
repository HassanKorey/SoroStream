# Maintainer Governance & Review Policy

This document outlines the governance guidelines and review responsibilities for SoroStream core maintainers.

---

## 👥 Core Maintainers

- **Project Lead / Smart Contract Architect**: Hassan Korey (`@HassanKorey`)
- **Backend & Protocol Indexer Lead**: SoroStream Protocol Team
- **Frontend & Design System Lead**: SoroStream UX Team

---

## 🛡️ Review & Approval Responsibilities

1. **Branch Protection Rules**:
   - The `main` branch is protected against direct pushes.
   - All code enters `main` exclusively through Pull Requests with at least 1 approving maintainer review.
   - All CI quality gates (`cargo test`, `clippy`, `ruff`, `mypy`, `pytest`, `sdk build`, `frontend build`) must pass.
2. **Issue Triage**:
   - Review incoming bug reports and feature requests.
   - Ensure labels and milestones are applied consistently.
3. **Smart Contract Change Approvals**:
   - Any modifications to `contracts/vesting_stream/src/lib.rs` must include accompanying unit tests in `test.rs` and security vector simulations in `backend/tests/test_security_vectors.py`.
   - Breaking state changes require migration strategies for persistent `DataKey` storage.

---

## 🚀 Release Process

- Smart contract WASMs are compiled using reproducible builds:
  ```bash
  cargo build --target wasm32-unknown-unknown --release
  ```
- Deployments to Stellar Testnet are managed via `scripts/deploy_testnet.sh`.
- SDK releases are versioned via SemVer and published to npm under `@sorostream/sdk`.
