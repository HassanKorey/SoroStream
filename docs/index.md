# SoroStream Documentation 🌊

> **Trustless, per-second linear asset streaming & cliff vesting protocol for Soroban Asset Contracts (SAC) on the Stellar Network.**

[![CI Quality Gates](https://github.com/HassanKorey/SoroStream/actions/workflows/ci.yml/badge.svg)](https://github.com/HassanKorey/SoroStream/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet-success.svg)](https://stellar.expert/explorer/testnet/contract/CA4L7T6R74G3T5F5V7V7RWWUHE2J76Y4WJ3L7C2WJ3L7C2WJ3L7C2WJ3)
[![Soroban SDK v21.0.0](https://img.shields.io/badge/Soroban%20SDK-v21.0.0-blue.svg)](https://soroban.stellar.org)

---

## What is SoroStream?

**SoroStream** is a native, trustless asset-streaming protocol and decentralized application built on **Stellar** using **Soroban** smart contracts (`#![no_std]`). It empowers DAOs, Web3 founders, grant allocators, and corporate payroll teams to lock Soroban Asset Contract (SAC) tokens—including **XLM**, **USDC**, and arbitrary **SEP-41** compliant assets—and release them continuously to recipients second-by-second over customizable linear schedules.

### Key Value Propositions
- **Per-Second Continuous Unlocking**: Mathematical interpolation unlocks tokens smoothly as Stellar ledgers advance, without gas-expensive per-second storage updates.
- **Cliff Vesting Protection**: Guarantee lockups with customizable cliff deadlines. Prior to cliff time, 0 tokens can be withdrawn.
- **Revocability & Fair Escrow Refunds**: Senders can configure revocable streams. Upon revocation, earned tokens are instantly paid to the recipient, while unvested tokens are refunded to the sender.
- **Multi-Token SAC Compatibility**: Supports native assets and any SEP-41 token with decimal normalization and balance tracking.
- **Batch CSV Distributions**: Onboard entire contributor rosters or payroll cohorts in a single atomic transaction.
- **BUX-Inspired Glassmorphic UI**: High-contrast slate canvas (`#090D16`), glowing emerald accents (`#10B981`), Bento grid metric cards, and live per-second tickers.

---

## Quick Navigation

| Section | Description |
|---|---|
| [📐 System Architecture](architecture.md) | Sequence diagrams, data flow, mathematical specs, and security guarantees |
| [📜 Smart Contracts](contracts/vesting_stream.md) | `#![no_std]` Rust implementation, storage layouts, methods, and unit tests |
| [📦 TypeScript SDK](sdks/typescript.md) | `@sorostream/sdk` installation, methods, balance polling, and Freighter signing |
| [🌐 Backend API Reference](api-reference.md) | FastAPI indexer endpoints, OpenAPI schemas, events, and webhooks |

---

## Maintainer & Governance

| Name | Role | GitHub | Contact |
| :--- | :--- | :--- | :--- |
| Hassan Akorede (EDUN) | Lead Architect | [@HassanKorey](https://github.com/HassanKorey) | Telegram: `@HassanKorey` |
| Co-Maintainer | Smart Contract Reviewer | [@CoMaintainer](https://github.com/CoMaintainer) | Discord: `comaintainer#0001` |

- **Live dApp Deployment**: [https://soro-stream.vercel.app](https://soro-stream.vercel.app)
- **Deployed Contract ID**: [`CA4L7T6R74G3T5F5V7V7RWWUHE2J76Y4WJ3L7C2WJ3L7C2WJ3L7C2WJ3`](https://stellar.expert/explorer/testnet/contract/CA4L7T6R74G3T5F5V7V7RWWUHE2J76Y4WJ3L7C2WJ3L7C2WJ3L7C2WJ3)
- **Documentation Portal**: [https://HassanKorey.github.io/SoroStream-app](https://HassanKorey.github.io/SoroStream-app)
