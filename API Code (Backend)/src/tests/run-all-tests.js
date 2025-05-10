#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const testScripts = [
  'plaid-insight-test.js',
  'mock-insight-test.js',
  'api-connectivity-test.js'
];

console.log('🚀 Starting Comprehensive System Tests');

testScripts.forEach(script => {
  try {
    console.log(`\n🔍 Running ${script}`);
    execSync(`node ${path.join(__dirname, script)}`, { stdio: 'inherit' });
    console.log(`✅ ${script} Passed`);
  } catch (error) {
    console.error(`❌ ${script} Failed`);
    process.exit(1);
  }
});

console.log('\n🎉 All System Tests Passed Successfully!');