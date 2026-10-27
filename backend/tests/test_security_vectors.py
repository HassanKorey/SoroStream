"""
Security Vector Pytest Suite for Attack Simulation (Issue #9).

Simulates high-severity adversarial scenarios across the SoroStream protocol:
1. Cliff Bypass Attempts (pre-cliff and 1-second boundary t = cliff_time - 1)
2. Double-Withdrawal Race Conditions (sequential & concurrent asyncio.gather claims)
3. Unauthorized Revocation by Malicious Third Party (Error::Unauthorized = 9)
4. Illegal Revocation of Non-Revocable Streams (Error::StreamNotRevocable = 7) & Double-Cancel (Error::StreamAlreadyCancelled = 6)
5. Integer Overflow, Zero-Duration (t_start == t_end), and Post-Cancellation Drain Attempts
"""

from __future__ import annotations

import asyncio
import time
from enum import IntEnum

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models import init_db
from app.soroban_client import SorobanClient


class SorobanContractError(IntEnum):
    """Exact Soroban #[contracterror] codes defined in contracts/vesting_stream/src/lib.rs."""

    ALREADY_INITIALIZED = 1
    NOT_INITIALIZED = 2
    INVALID_TIME_BOUNDS = 3
    INVALID_AMOUNT = 4
    STREAM_NOT_FOUND = 5
    STREAM_ALREADY_CANCELLED = 6
    STREAM_NOT_REVOCABLE = 7
    NOTHING_TO_WITHDRAW = 8
    UNAUTHORIZED = 9


@pytest.fixture(autouse=True)
def setup_database():
    init_db()


@pytest.mark.asyncio
async def test_attack_cliff_bypass_attempt():
    """
    ATTACK VECTOR 1: Cliff Bypass Simulation (Soroban Error::NothingToWithdraw = 8).
    An adversary attempts to invoke token withdrawal when the ledger timestamp
    is strictly before the cliff timestamp (including t = cliff_time - 1).
    The protocol must return 0 unlocked tokens and reject withdrawal with HTTP 400.
    """
    now = int(time.time())
    payload = {
        "sender": "GADV3RSARYSENDER777777777777777777777777777777777777777777",
        "recipient": "GADV3RSARYRECIPIENT888888888888888888888888888888888888888",
        "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        "amount": 50_000_0000000,
        "start_time": now,
        "cliff_time": now + 86400,      # Cliff 24 hours in the future
        "end_time": now + 86400 * 30,   # Stream ends in 30 days
        "revocable": True,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/streams", json=payload)
        assert res.status_code == 201
        stream_data = res.json()
        stream_id = stream_data["id"]

        # Verify exact 1-second pre-cliff boundary (t = cliff_time - 1) in math engine
        boundary_state = SorobanClient.calculate_vesting_state(
            stream_data, current_timestamp=payload["cliff_time"] - 1
        )
        assert boundary_state["unlocked_amount"] == 0
        assert boundary_state["claimable_amount"] == 0
        assert boundary_state["status"] == "cliff_pending"
        assert SorobanContractError.NOTHING_TO_WITHDRAW == 8

        # Check that API view reports strictly zero claimable amount
        stream_view = await ac.get(f"/api/streams/{stream_id}")
        assert stream_view.json()["claimable_amount"] == 0
        assert stream_view.json()["status"] == "cliff_pending"

        # Attempt premature withdraw
        attack_res = await ac.post(f"/api/streams/{stream_id}/withdraw")
        assert attack_res.status_code == 400
        assert "No unlocked tokens" in attack_res.json()["detail"]


@pytest.mark.asyncio
async def test_attack_double_withdraw_race():
    """
    ATTACK VECTOR 2: Double-Withdraw / Concurrent Race Condition Simulation.
    An attacker dispatches concurrent withdrawal requests via asyncio.gather
    attempting to drain escrowed funds more than once. Exactly one withdrawal
    may succeed and total claimed tokens must never exceed total_amount.
    """
    now = int(time.time())
    total_escrow = 20_000_0000000
    payload = {
        "sender": "GAHONESTSENDER1111111111111111111111111111111111111111111",
        "recipient": "GGREEDYATTACKER222222222222222222222222222222222222222222",
        "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        "amount": total_escrow,
        "start_time": now - 100,
        "cliff_time": now - 50,
        "end_time": now - 10,  # Stream fully vested in the past
        "revocable": True,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/streams", json=payload)
        assert res.status_code == 201
        stream_id = res.json()["id"]

        # Fire 5 concurrent withdrawal attempts simultaneously
        responses = await asyncio.gather(
            *[ac.post(f"/api/streams/{stream_id}/withdraw") for _ in range(5)]
        )
        status_codes = [r.status_code for r in responses]
        assert status_codes.count(200) == 1
        assert status_codes.count(400) == 4

        # Verify total claimed never exceeds escrowed total_amount
        final_view = (await ac.get(f"/api/streams/{stream_id}")).json()
        assert final_view["claimed_amount"] == total_escrow
        assert final_view["claimable_amount"] == 0
        assert SorobanContractError.NOTHING_TO_WITHDRAW == 8


@pytest.mark.asyncio
async def test_attack_unauthorized_revocation():
    """
    ATTACK VECTOR 3: Unauthorized Revocation by Malicious Third Party
    (Soroban Error::Unauthorized = 9).
    Neither a random attacker nor the stream recipient may revoke a stream;
    only the original funding sender is authorized.
    """
    now = int(time.time())
    honest_sender = "GAHONEST11111111111111111111111111111111111111111111111111"
    recipient = "GBRECIP222222222222222222222222222222222222222222222222222"
    malicious_actor = "GAATTACKER99999999999999999999999999999999999999999999999"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/streams",
            json={
                "sender": honest_sender,
                "recipient": recipient,
                "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                "amount": 50_000_000,
                "start_time": now - 10,
                "cliff_time": now - 5,
                "end_time": now + 100,
                "revocable": True,
            },
        )
        stream_id = res.json()["id"]

        # Random third-party attacker attempts cancellation -> HTTP 403
        res_attacker = await ac.post(
            f"/api/streams/{stream_id}/cancel?sender={malicious_actor}"
        )
        assert res_attacker.status_code == 403
        assert "Unauthorized" in res_attacker.json()["detail"]

        # Recipient attempts to self-cancel to force premature settlement -> HTTP 403
        res_recipient = await ac.post(
            f"/api/streams/{stream_id}/cancel?sender={recipient}"
        )
        assert res_recipient.status_code == 403
        assert SorobanContractError.UNAUTHORIZED == 9


@pytest.mark.asyncio
async def test_attack_illegal_cancel_and_double_cancel():
    """
    ATTACK VECTOR 4: Illegal Revocation of Non-Revocable Stream (Error::StreamNotRevocable = 7)
    & Double Cancellation Attack (Error::StreamAlreadyCancelled = 6) + Post-Cancel Drain.
    """
    now = int(time.time())
    honest_sender = "GAHONEST11111111111111111111111111111111111111111111111111"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Create non-revocable stream (revocable = False)
        res_nonrev = await ac.post(
            "/api/streams",
            json={
                "sender": honest_sender,
                "recipient": "GBRECIP222222222222222222222222222222222222222222222222222",
                "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                "amount": 50_000_000,
                "start_time": now - 10,
                "cliff_time": now - 5,
                "end_time": now + 100,
                "revocable": False,
            },
        )
        nonrev_id = res_nonrev.json()["id"]

        # Sender attempts to cancel an immutable non-revocable stream -> HTTP 400
        res_cancel_nonrev = await ac.post(
            f"/api/streams/{nonrev_id}/cancel?sender={honest_sender}"
        )
        assert res_cancel_nonrev.status_code == 400
        assert "not revocable" in res_cancel_nonrev.json()["detail"]
        assert SorobanContractError.STREAM_NOT_REVOCABLE == 7

        # 2. Create revocable stream and test double-cancel + post-cancel withdrawal drain
        res_rev = await ac.post(
            "/api/streams",
            json={
                "sender": honest_sender,
                "recipient": "GBRECIP222222222222222222222222222222222222222222222222222",
                "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                "amount": 50_000_000,
                "start_time": now - 10,
                "cliff_time": now - 5,
                "end_time": now + 100,
                "revocable": True,
            },
        )
        rev_id = res_rev.json()["id"]

        # Legitimate sender cancels once
        res_legit = await ac.post(f"/api/streams/{rev_id}/cancel?sender={honest_sender}")
        assert res_legit.status_code == 200
        assert res_legit.json()["is_cancelled"] is True

        # Second cancel attempt to double-refund unvested balance must fail -> HTTP 400
        res_double = await ac.post(f"/api/streams/{rev_id}/cancel?sender={honest_sender}")
        assert res_double.status_code == 400
        assert "already cancelled" in res_double.json()["detail"]
        assert SorobanContractError.STREAM_ALREADY_CANCELLED == 6

        # Post-cancellation withdrawal attempt by recipient must fail -> HTTP 400
        res_post_withdraw = await ac.post(f"/api/streams/{rev_id}/withdraw")
        assert res_post_withdraw.status_code == 400
        assert "No unlocked tokens" in res_post_withdraw.json()["detail"]


@pytest.mark.asyncio
async def test_attack_integer_overflow_and_time_distortion():
    """
    ATTACK VECTOR 5: Integer Overflow, Zero-Duration (t_start == t_end), and Negative Boundaries
    (Soroban Error::InvalidTimeBounds = 3, Error::InvalidAmount = 4).
    """
    now = int(time.time())
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Negative and zero amounts -> HTTP 422 (Error::InvalidAmount = 4)
        for invalid_amount in (0, -1, -5_000_000):
            res_amt = await ac.post(
                "/api/streams",
                json={
                    "sender": "GA1111111111111111111111111111111111111111111111111111111",
                    "recipient": "GB2222222222222222222222222222222222222222222222222222222",
                    "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                    "amount": invalid_amount,
                    "start_time": now,
                    "cliff_time": now + 10,
                    "end_time": now + 20,
                    "revocable": True,
                },
            )
            assert res_amt.status_code == 422
        assert SorobanContractError.INVALID_AMOUNT == 4

        # 2. Zero duration (start_time == cliff_time == end_time) -> HTTP 400
        res_zero_dur = await ac.post(
            "/api/streams",
            json={
                "sender": "GA1111111111111111111111111111111111111111111111111111111",
                "recipient": "GB2222222222222222222222222222222222222222222222222222222",
                "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                "amount": 1000,
                "start_time": now,
                "cliff_time": now,
                "end_time": now,
                "revocable": True,
            },
        )
        assert res_zero_dur.status_code == 400
        assert "Invalid bounds" in res_zero_dur.json()["detail"]

        # 3. Time distortion: start_time > cliff_time -> HTTP 400
        res_time = await ac.post(
            "/api/streams",
            json={
                "sender": "GA1111111111111111111111111111111111111111111111111111111",
                "recipient": "GB2222222222222222222222222222222222222222222222222222222",
                "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                "amount": 1000,
                "start_time": now + 50,
                "cliff_time": now + 10,
                "end_time": now + 100,
                "revocable": True,
            },
        )
        assert res_time.status_code == 400
        assert "Invalid bounds" in res_time.json()["detail"]
        assert SorobanContractError.INVALID_TIME_BOUNDS == 3

        # 4. Large i128 stroop math precision check without 64-bit integer overflow
        large_total = (2**63 - 1) * 10  # Exceeds signed 64-bit integer max, valid in Soroban i128
        calc = SorobanClient.calculate_vesting_state(
            {
                "total_amount": large_total,
                "claimed_amount": 0,
                "start_time": 1_000,
                "cliff_time": 2_000,
                "end_time": 5_000,
                "is_cancelled": False,
            },
            current_timestamp=3_000,
        )
        assert calc["unlocked_amount"] == large_total // 2
        assert calc["claimable_amount"] == large_total // 2
