# Contributing to SoroStream

Thank you for your interest in contributing to **SoroStream**! This repository is organized for open-source Stellar/Soroban builders and community contributors.

---

## 🛠️ Development Environment Setup

### Prerequisites
1. **Rust & Cargo** (1.78+):
   ```bash
   rustup target add wasm32-unknown-unknown
   ```
2. **Stellar CLI** (v21+):
   ```bash
   cargo install --locked stellar-cli --features opt
   ```
3. **Python 3.12+** with `venv`
4. **Node.js 18+** and `npm`

---

## 📦 Monorepo Structure

- `contracts/vesting_stream/`: Rust smart contract compiled to WASM using `soroban-sdk`.
- `backend/`: FastAPI RPC indexing engine, SQLite cache, and webhook notification worker.
- `sdk/`: Official TypeScript Client SDK (`@sorostream/sdk`).
- `frontend/`: Next.js Web3 application with BUX-inspired glassmorphic dark theme.
- `scripts/`: Testnet deployment, account funding, and automation tools.

---

## 🧪 Testing & Quality Gates

Before opening a pull request, ensure all quality gates pass:

### 1. Smart Contracts
```bash
cd contracts/vesting_stream
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

### 2. Backend & Security Vectors
```bash
cd backend
source venv/bin/activate
ruff check app tests
mypy app
pytest -v
```

### 3. TypeScript SDK
```bash
cd sdk
npm ci
npm run build
npm test
```

---

## 🎯 Contributor Workflow

1. Fork the repository and create your branch from `main` (`feature/your-feature-name`).
2. Adhere to conventional commit formats:
   - `feat(...)`: New feature or capability
   - `fix(...)`: Bug fix
   - `test(...)`: Adding or updating test suites
   - `docs(...)`: Documentation updates
3. Submit a Pull Request targeting `main`. Ensure all CI checks pass.
4. Maintainers will review and provide feedback on your contribution!
