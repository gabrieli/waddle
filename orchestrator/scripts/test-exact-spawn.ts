import { spawn } from 'child_process';

const prompt = `You are a Development Manager analyzing a single work item.

WORK ITEM:
Type: epic
ID: EPIC-MC81PSB0-EL4
Title: Test Epic 2
Status: backlog
Description: Simply acknowledge this epic and move it to done. It's a test one to understand if the manager agent is working

RECENT HISTORY:
No recent history

RULES:
- Epic in backlog → assign_architect
- Story in ready → assign_developer  
- Story in review → assign_code_quality_reviewer
- Work that's been reviewed and approved → mark_complete
- If dependencies aren't met → wait

Analyze this ONE item and decide the next action.

Return ONLY valid JSON:
{
  "action": "assign_architect|assign_developer|assign_code_quality_reviewer|mark_complete|wait",
  "reason": "brief reason for the decision"
}`;

const claudeExecutable = '/Users/gabrielionescu/.claude/local/claude';
const escapedPrompt = prompt.replace(/'/g, "'\"'\"'");
const command = `${claudeExecutable} -p '${escapedPrompt}'`;

console.log('Testing exact spawn command...\n');
console.log(`Command: ${command.substring(0, 100)}...`);
console.log(`Working directory: .`);

const claude = spawn(command, [], {
  cwd: '.',
  env: { ...process.env },
  shell: true
});

console.log(`Process spawned with PID: ${claude.pid}`);

claude.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

claude.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

claude.on('close', (code) => {
  console.log(`Process closed with code: ${code}`);
});

claude.on('error', (err) => {
  console.error('ERROR:', err);
});