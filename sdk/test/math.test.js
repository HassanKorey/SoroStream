const assert = require('assert');
const { calculateVesting } = require('../dist/math');

console.log('Testing @sorostream/sdk vesting math...');

const stream = {
  totalAmount: BigInt(100_000_000), // 10 tokens
  claimedAmount: BigInt(0),
  startTime: 1000,
  cliffTime: 2000,
  endTime: 6000,
  isCancelled: false,
};

// 1. Before cliff (t = 1500)
const beforeCliff = calculateVesting(stream, 1500);
assert.strictEqual(beforeCliff.unlockedAmount, BigInt(0));
assert.strictEqual(beforeCliff.claimableAmount, BigInt(0));
assert.strictEqual(beforeCliff.status, 'cliff_pending');

// 2. At cliff (t = 2000): (2000 - 1000) / 5000 = 20%
const atCliff = calculateVesting(stream, 2000);
assert.strictEqual(atCliff.unlockedAmount, BigInt(20_000_000));
assert.strictEqual(atCliff.claimableAmount, BigInt(20_000_000));
assert.strictEqual(atCliff.unlockedPercentage, 20.0);
assert.strictEqual(atCliff.status, 'active');

// 3. At midpoint (t = 3500): (3500 - 1000) / 5000 = 50%
const atMidpoint = calculateVesting(stream, 3500);
assert.strictEqual(atMidpoint.unlockedAmount, BigInt(50_000_000));
assert.strictEqual(atMidpoint.claimableAmount, BigInt(50_000_000));

// 4. Past end (t = 7000): 100% unlocked
const pastEnd = calculateVesting(stream, 7000);
assert.strictEqual(pastEnd.unlockedAmount, BigInt(100_000_000));
assert.strictEqual(pastEnd.claimableAmount, BigInt(100_000_000));
assert.strictEqual(pastEnd.status, 'active');

console.log('All @sorostream/sdk math unit tests passed!');
