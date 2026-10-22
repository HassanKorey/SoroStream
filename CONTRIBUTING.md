# Contributing to SoroStream

Thank you for your interest in contributing to **SoroStream**! SoroStream is an open-source, non-custodial token vesting and streaming protocol built on Stellar and Soroban. We welcome contributions from developers, designers, and auditors.

---

## 🛠️ Development Environment Setup

### Prerequisites
1. **Rust & Cargo** (1.78+ / 1.80+):
   ```bash
   rustup target add wasm32-unknown-unknown
   ```
2. **Stellar CLI** (v21+):
   ```bash
   cargo install --locked stellar-cli --features opt
   ```
3. **Node.js 18+ & npm 9+**:
   ```bash
   node -v
   npm -v
   ```
4. **Python 3.12+** with `venv`

---

## 📦 Monorepo Architecture

- `contracts/vesting_stream/`: Soroban smart contract written in `#![no_std]` Rust.
- `sdk/`: Official TypeScript client library (`@sorostream/sdk`) with mathematical engine and Freighter transaction helpers.
- `frontend/`: Next.js 14 web application featuring BUX-inspired glassmorphism dark mode (`#090D16`), real-time stream tickers, and CSV batch escrows.
- `backend/`: FastAPI indexer, SQLite/PostgreSQL caching layer, and webhook notification worker.
- `scripts/`: Deployment scripts (`deploy_testnet.sh`) and automation utilities.

---

## 🧪 Testing & Quality Gates

Every pull request must pass the automated GitHub Actions CI quality gates (`.github/workflows/ci.yml`):

### 1. Smart Contracts (Rust)
```bash
cd contracts/vesting_stream
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

### 2. TypeScript SDK
```bash
cd sdk
npm ci
npm run build
npm test
```

### 3. Frontend Web Dashboard
```bash
cd frontend
npm ci
npm run build
```

### 4. Backend & Security Vectors
```bash
cd backend
python -m pip install -r requirements.txt
ruff check app tests
pytest -v
```

---

## 👥 Multi-Maintainer Review Workflow

To maintain code security and protocol integrity, SoroStream follows a rigorous multi-maintainer review policy:

1. **Pick or Propose an Issue**:
   - Check the [GitHub Issues](https://github.com/HassanKorey/SoroStream/issues) backlog. Issues are categorized by Drips Wave points:
     - **Trivial (100 pts)**: Documentation, metadata, component styling.
     - **Medium (150 pts)**: Script automation, ticker components, event handlers.
     - **High (200 pts)**: Multi-token SAC verification, bulk vesting, security vector suites, SDK expansion.
   - Comment on the issue to request assignment before starting work.

2. **Branching & Atomic Commits**:
   - Branch from `main` using descriptive names:
     - `contract/<feature-name>`
     - `frontend/<feature-name>`
     - `sdk/<feature-name>`
     - `docs/<feature-name>`
   - Use conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`, `ci:`).

3. **Pull Request Submission**:
   - Open a PR targeting `main`.
   - Provide a clear summary of changes, linked issue (e.g., `Resolves #4`), and testing verification steps.
   - Mark PR as ready for review.

4. **Co-Maintainer Review & Quorum**:
   - **General PRs**: Reviewed and approved by at least **1 co-maintainer** within 48 hours.
   - **Contract PRs**: Require **2 maintainer approvals**, including the Lead Smart Contract Architect.
   - Address any review comments promptly. Once approved and CI is green, co-maintainers will squash and merge.
