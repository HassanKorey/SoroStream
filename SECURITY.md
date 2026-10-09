# Security Policy & Audit Vector Specifications

Security is paramount for SoroStream. This document outlines vulnerability disclosure procedures and documents the formal attack simulation vectors verified in the protocol test suite.
  
---

## 🔒 Reporting a Vulnerability

If you discover a security vulnerability within SoroStream smart contracts, backend indexer, or SDK, please report it privately:

- **Email**: `edunhassan1006@gmail.com`
- **Subject**: `[SECURITY VULNERABILITY] SoroStream`

Please include:
1. Proof-of-concept script or unit test replicating the issue.
2. Affected components and git commit hash.
3. Potential impact and remediation recommendations.

We respond within 24 hours and will coordinate a responsible disclosure timeline.

---

## 🛡️ Formally Tested Attack Vectors

The SoroStream smart contract and backend undergo automated security vector testing (`backend/tests/test_security_vectors.py` and `contracts/vesting_stream/src/test.rs`):

| Attack Vector | Description | Defense Implementation |
|---|---|---|
| **Cliff Bypass** | Beneficiary attempting to withdraw tokens prior to the configured `cliff_time`. | Contract calculates `0` unlocked tokens when `t < cliff_time` and reverts with `Error::NothingToWithdraw`. |
| **Double-Withdrawal Race** | Repeated or parallel withdrawal calls attempting to extract unlocked tokens more than once. | Storage updates `claimed_amount += claimable` synchronously before token transfers. |
| **Unauthorized Cancellation** | Non-sender or arbitrary third party attempting to call `cancel_stream`. | Explicit `sender.require_auth()` and check `record.sender == sender` returning `Error::Unauthorized`. |
| **Non-Revocable Cancellation** | Sender attempting to cancel a stream where `revocable == false`. | Contract enforces `record.revocable` returning `Error::StreamNotRevocable`. |
| **Cancellation Double Payout** | Attempting to cancel an already cancelled stream. | Enforces `!record.is_cancelled` returning `Error::StreamAlreadyCancelled`. |
| **Time Bounds Inversion** | Attempting to create a stream where `start > cliff` or `cliff >= end`. | Strict parameter validation returning `Error::InvalidTimeBounds`. |
| **Zero/Negative Amount Escrow** | Attempting to initialize a stream with `amount <= 0`. | Strictly validates `amount > 0` returning `Error::InvalidAmount`. |
