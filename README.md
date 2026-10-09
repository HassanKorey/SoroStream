# SoroStream 🌊

> **Trustless, per-second linear asset streaming and cliff vesting protocol for Soroban Asset Contracts (SAC) on the Stellar Network.**

[![CI Quality Gates](https://github.com/HassanKorey/SoroStream/actions/workflows/ci.yml/badge.svg)](https://github.com/HassanKorey/SoroStream/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Soroban](https://img.shields.io/badge/Soroban-v21.0.0-blue)](https://soroban.stellar.org)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-teal)](https://fastapi.tiangolo.com)
[![TypeScript SDK](https://img.shields.io/badge/SDK-%40sorostream%2Fsdk-blueviolet)](sdk/)

---

## 🌟 Overview

**SoroStream** is a native, trustless asset streaming and vesting escrow protocol built on **Stellar** smart contracts (Soroban). It enables DAOs, corporate treasuries, Web3 founders, and grant allocators to lock tokens (XLM, USDC, or custom SEP-41 Soroban Asset Contracts) and stream them continuously to recipients second-by-second over customizable schedules with optional cliff milestones and revocation controls.


---

## 📐 Protocol Architecture

```mermaid
graph TD
    A["Sender / DAO Treasury"] -->|create_stream / batch| B["SoroStream Contract on Soroban"]
    B -->|Locks SAC Escrow| C["Token Vault (SEP-41)"]
    D["Recipient / Beneficiary"] -->|withdraw claimable| B
    B -->|Transfers unlocked tokens| D
    B -->|Publishes Events| E["Soroban RPC"]
    E -->|Real-time Ingestion| F["FastAPI Indexer Backend"]
    F -->|SQLite Cache & Webhooks| G["SoroStream Web Dashboard"]
    H["TypeScript Client SDK"] -->|Client Calculations & RPC| G
```

---

## ⚡ Mathematical Specification

The smart contract calculates unlocked tokens dynamically on invocation without needing periodic cron jobs or per-second storage writes. Let $t$ be the current ledger timestamp (`env.ledger().timestamp()`):

$$\text{Unlocked}(t) = \begin{cases} 
0 & \text{if } t < t_{\text{cliff}} \\
A_{\text{total}} & \text{if } t \ge t_{\text{end}} \\
\left\lfloor \frac{A_{\text{total}} \times (t - t_{\text{start}})}{t_{\text{end}} - t_{\text{start}}} \right\rfloor & \text{otherwise}
\end{cases}$$

$$\text{Claimable}(t) = \text{Unlocked}(t) - A_{\text{claimed}}$$

---

## 🚀 Quick Start Guide

### 1. Smart Contracts (Rust)
```bash
cd contracts/vesting_stream
cargo test
cargo clippy --all-targets -- -D warnings
```

### 2. Backend Indexer (Python)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Interactive API documentation: `http://localhost:8000/docs`

### 3. TypeScript SDK
```bash
cd sdk
npm install
npm run build
npm test
```

### 4. Testnet Deployment
Deploy to Stellar Testnet and auto-fund via Friendbot:
```bash
./scripts/deploy_testnet.sh
```

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
