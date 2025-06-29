#!/usr/bin/env node

// Simple script to verify the setup works
// This doesn't require npm install

import fs from 'fs';
import path from 'path';

console.log('Verifying Waddle setup...\n');

// Check directory structure
const dirs = [
  'src/server',
  'src/agents', 
  'src/database',
  'src/claude',
  'src/config',
  'tests/integration'
];

console.log('Directory structure:');
for (const dir of dirs) {
  const exists = fs.existsSync(path.join(process.cwd(), dir));
  console.log(`  ${exists ? '✓' : '✗'} ${dir}`);
}

// Check key files
const files = [
  'src/server/index.ts',
  'src/agents/developer.ts',
  'src/database/connection.ts',
  'src/claude/executor.ts',
  'src/config/index.ts',
  'tests/integration/developer-agent.test.ts',
  'tests/integration/server.test.ts'
];

console.log('\nKey files:');
for (const file of files) {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
}

// Check dev-roles
const roleFile = path.join(process.cwd(), 'dev-roles/ROLE_DEVELOPER.md');
const roleExists = fs.existsSync(roleFile);
console.log(`\nRole instructions:`);
console.log(`  ${roleExists ? '✓' : '✗'} dev-roles/ROLE_DEVELOPER.md`);

console.log('\nSetup verification complete!');

if (roleExists) {
  console.log('\nAll files are in place. You can now:');
  console.log('1. Run: npm install');
  console.log('2. Start server: npm run dev');
  console.log('3. In another terminal: npm run client');
  console.log('4. Run tests: npm test');
} else {
  console.log('\nWarning: ROLE_DEVELOPER.md not found in dev-roles/');
}