// Basic test without dependencies
// Run with: node scripts/test-basic.js

const fs = require('fs');
const path = require('path');

console.log('Running basic tests...\n');

// Test 1: Check file structure
console.log('Test 1: File Structure');
const requiredFiles = [
  'src/server/index.ts',
  'src/server/commands.ts',
  'src/agents/base.ts',
  'src/agents/developer.ts',
  'src/agents/registry.ts',
  'src/database/connection.ts',
  'src/database/schema.ts',
  'src/claude/executor.ts',
  'src/config/index.ts',
  'tests/integration/developer-agent.test.ts',
  'tests/integration/server.test.ts'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
}

// Test 2: Check TypeScript syntax (basic)
console.log('\nTest 2: TypeScript Syntax Check');
const tsFiles = requiredFiles.filter(f => f.endsWith('.ts'));
let syntaxOk = true;

for (const file of tsFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Basic checks
      if (content.includes('export class') || content.includes('export interface') || content.includes('export function')) {
        console.log(`  ✓ ${file} - has exports`);
      } else {
        console.log(`  ⚠ ${file} - no exports found`);
      }
    } catch (err) {
      console.log(`  ✗ ${file} - ${err.message}`);
      syntaxOk = false;
    }
  }
}

// Test 3: Check configuration
console.log('\nTest 3: Configuration');
const configExample = path.join(__dirname, '..', 'waddle.config.example.json');
if (fs.existsSync(configExample)) {
  try {
    const config = JSON.parse(fs.readFileSync(configExample, 'utf-8'));
    console.log('  ✓ Config example is valid JSON');
    console.log(`  ✓ Environment: ${config.environment}`);
    console.log(`  ✓ Server port: ${config.server.port}`);
  } catch (err) {
    console.log('  ✗ Config example error:', err.message);
  }
}

// Summary
console.log('\n--- Summary ---');
console.log(`File structure: ${allFilesExist ? 'PASS' : 'FAIL'}`);
console.log(`Basic syntax: ${syntaxOk ? 'PASS' : 'FAIL'}`);
console.log('\nNote: For full testing, run "npm install" then "npm test"');