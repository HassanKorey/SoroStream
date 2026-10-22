const { spawnSync } = require('child_process');
const path = require('path');

console.log('====================================================');
console.log('Running @sorostream/sdk Test Suite');
console.log('====================================================');

const tests = ['math.test.js', 'client.test.js'];

for (const testFile of tests) {
  const fullPath = path.join(__dirname, testFile);
  console.log(`\n▶ Running ${testFile}...`);
  const result = spawnSync('node', [fullPath], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[-] Test failure in ${testFile}`);
    process.exit(result.status || 1);
  }
}

console.log('\n====================================================');
console.log('✔ All @sorostream/sdk test suites completed successfully!');
console.log('====================================================\n');
