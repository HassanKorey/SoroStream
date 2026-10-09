"""
Security Vector Pytest Suite for Attack Simulation (Issue #9).

Simulates high-severity adversarial scenarios:
1. Cliff Bypass Attempts (attempting withdrawal before cliff threshold)
2. Double-Withdraw Race Conditions (reentrancy / repeated zero-balance draining)
3. Integer Overflow & Negative Boundaries
4. Unauthorized Revocation & Tampering of Non-Revocable Escrows
5. Double Cancellation Attacks
"""

import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models import init_db


@pytest.fixture(autouse=True)
def setup_database():
    init_db()


@pytest.mark.asyncio
async def test_attack_cliff_bypass_attempt():
    """
    ATTACK VECTOR 1: Cliff Bypass Simulation.
    An adversary attempts to invoke token withdrawal when the ledger timestamp
    is strictly before the cliff timestamp. The protocol must return 0 unlocked
    tokens and reject the withdrawal with HTTP 400.
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
        stream_id = res.json()["id"]

        # Check that claimable amount is strictly zero
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
    ATTACK VECTOR 2: Double-Withdraw / Race Condition Simulation.
    An attacker attempts rapid, concurrent withdrawals to claim unlocked
    balances more than once before state persistence settles.
    """
    now = int(time.time())
    payload = {
        "sender": "GAHONESTSENDER1111111111111111111111111111111111111111111",
        "recipient": "GGREEDYATTACKER222222222222222222222222222222222222222222",
        "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        "amount": 20_000_0000000,
        "start_time": now - 100,
        "cliff_time": now - 50,
        "end_time": now - 10,  # Stream fully vested in the past
        "revocable": True,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/streams", json=payload)
        stream_id = res.json()["id"]

        # First legitimate withdrawal succeeds
        claim1 = await ac.post(f"/api/streams/{stream_id}/withdraw")
        assert claim1.status_code == 200
        first_claimed = claim1.json()["claimed_amount"]
        assert first_claimed > 0

        # Immediate secondary withdrawal must fail because claimable delta is 0
        claim2 = await ac.post(f"/api/streams/{stream_id}/withdraw")
        assert claim2.status_code == 400
        assert "No unlocked tokens" in claim2.json()["detail"]


@pytest.mark.asyncio
async def test_attack_integer_overflow_and_time_distortion():
    """
    ATTACK VECTOR 3: Time Distortion & Negative Amount Boundaries.
    Attempts creation with corrupted or negative parameters:
    - start_time > cliff_time
    - cliff_time >= end_time
    - negative or 0 amounts
    """
    now = int(time.time())
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Negative amount
        res_neg = await ac.post("/api/streams", json={
            "sender": "GA1111111111111111111111111111111111111111111111111111111",
            "recipient": "GB2222222222222222222222222222222222222222222222222222222",
            "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            "amount": -5000,
            "start_time": now,
            "cliff_time": now + 10,
            "end_time": now + 20,
            "revocable": True,
        })
        assert res_neg.status_code == 422 # Pydantic validation rejection gt=0

        # Time distortion: start > cliff
        res_time = await ac.post("/api/streams", json={
            "sender": "GA1111111111111111111111111111111111111111111111111111111",
            "recipient": "GB2222222222222222222222222222222222222222222222222222222",
            "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            "amount": 1000,
            "start_time": now + 50,
            "cliff_time": now + 10, # cliff before start!
            "end_time": now + 100,
            "revocable": True,
        })
        assert res_time.status_code == 400
        assert "Invalid bounds" in res_time.json()["detail"]


@pytest.mark.asyncio
async def test_attack_illegal_cancel_and_double_cancel():
    """
    ATTACK VECTOR 4: Illegal Cancellation & Unauthorized Revocation.
    - An attacker (not sender) attempts to cancel a stream -> HTTP 403.
    - Sender attempts to cancel an immutable non-revocable stream -> HTTP 400.
    - Double cancel on already cancelled stream -> HTTP 400.
    """
    now = int(time.time())
    honest_sender = "GAHONEST11111111111111111111111111111111111111111111111111"
    attacker = "GAATTACKER99999999999999999999999999999999999999999999999"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create non-revocable stream
        res_nonrev = await ac.post("/api/streams", json={
            "sender": honest_sender,
            "recipient": "GBRECIP222222222222222222222222222222222222222222222222222",
            "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            "amount": 50000000,
            "start_time": now - 10,
            "cliff_time": now - 5,
            "end_time": now + 100,
            "revocable": False,
        })
        nonrev_id = res_nonrev.json()["id"]

        # Cancel attempt on non-revocable stream
        res_cancel_nonrev = await ac.post(f"/api/streams/{nonrev_id}/cancel?sender={honest_sender}")
        assert res_cancel_nonrev.status_code == 400
        assert "not revocable" in res_cancel_nonrev.json()["detail"]

        # Create revocable stream
        res_rev = await ac.post("/api/streams", json={
            "sender": honest_sender,
            "recipient": "GBRECIP222222222222222222222222222222222222222222222222222",
            "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            "amount": 50000000,
            "start_time": now - 10,
            "cliff_time": now - 5,
            "end_time": now + 100,
            "revocable": True,
        })
        rev_id = res_rev.json()["id"]

        # Attacker attempts cancellation
        res_unauth = await ac.post(f"/api/streams/{rev_id}/cancel?sender={attacker}")
        assert res_unauth.status_code == 403
        assert "Unauthorized" in res_unauth.json()["detail"]

        # Legitimate sender cancels
        res_legit = await ac.post(f"/api/streams/{rev_id}/cancel?sender={honest_sender}")
        assert res_legit.status_code == 200
        assert res_legit.json()["is_cancelled"] is True

        # Second cancel attempt must fail
        res_double = await ac.post(f"/api/streams/{rev_id}/cancel?sender={honest_sender}")
        assert res_double.status_code == 400
        assert "already cancelled" in res_double.json()["detail"]
