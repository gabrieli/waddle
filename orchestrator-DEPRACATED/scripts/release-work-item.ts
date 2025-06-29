import { releaseWorkItem } from '../src/database/utils.js';

const workItemId = process.argv[2] || 'EPIC-MC81PSB0-EL4';
const agentId = process.argv[3] || 'manual-release';

console.log(`Releasing work item ${workItemId}...`);
const result = releaseWorkItem(workItemId, agentId);
console.log(result ? '✅ Released successfully' : '❌ Failed to release');