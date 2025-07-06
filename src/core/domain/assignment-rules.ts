/**
 * Assignment Rules Configuration (Core Domain)
 */
import type { AssignmentRule } from '../workflows/work-assignment.ts';

/**
 * Standard assignment rules as per US-003 requirements
 */
export const standardAssignmentRules: AssignmentRule[] = [
  // Architects handle new epics
  { agentType: 'architect', workType: 'epic', workStatus: 'new' },
  
  // Developers handle new user stories
  { agentType: 'developer', workType: 'user_story', workStatus: 'new' },
  
  // Testers handle user stories in review
  { agentType: 'tester', workType: 'user_story', workStatus: 'review' }
];