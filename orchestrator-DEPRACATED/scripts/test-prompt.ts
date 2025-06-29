import { getWorkItem, getWorkItemHistory } from '../src/database/utils.js';

const SINGLE_ITEM_MANAGER_PROMPT = `You are a Development Manager analyzing a single work item.

WORK ITEM:
{workItem}

RECENT HISTORY:
{history}

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

const workItemId = 'EPIC-MC81PSB0-EL4';
const workItem = getWorkItem(workItemId);

if (workItem) {
  const history = getWorkItemHistory(workItemId);
  const recentHistory = history.slice(0, 3).map(h => 
    `${h.action}: ${h.content || 'No details'} (by ${h.created_by})`
  ).join('\n');
  
  const workItemStr = `Type: ${workItem.type}
ID: ${workItem.id}
Title: ${workItem.title}
Status: ${workItem.status}
Description: ${workItem.description || 'No description'}`;
  
  const prompt = SINGLE_ITEM_MANAGER_PROMPT
    .replace('{workItem}', workItemStr)
    .replace('{history}', recentHistory || 'No recent history');
    
  console.log('Generated prompt:');
  console.log('=================');
  console.log(prompt);
  console.log('=================');
  console.log(`\nPrompt length: ${prompt.length} characters`);
}