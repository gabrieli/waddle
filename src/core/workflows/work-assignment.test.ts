/**
 * Work Assignment Tests - Core Business Logic (TDD)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  matchAgentsToWork,
  type Agent,
  type AssignableWork,
  type Assignment,
  type AssignmentRule
} from './work-assignment.ts';

describe('Work Assignment Core Logic', () => {
  describe('matchAgentsToWork', () => {
    test('should match architect to epic', () => {
      const agents: Agent[] = [
        { id: 1, type: 'architect' }
      ];
      
      const work: AssignableWork[] = [
        { id: 101, type: 'epic', status: 'new' }
      ];
      
      const rules: AssignmentRule[] = [
        { agentType: 'architect', workType: 'epic', workStatus: 'new' }
      ];
      
      const assignments = matchAgentsToWork(agents, work, rules);
      
      assert.strictEqual(assignments.length, 1);
      assert.strictEqual(assignments[0].agentId, 1);
      assert.strictEqual(assignments[0].workItemId, 101);
    });

    test('should match developer to user story', () => {
      const agents: Agent[] = [
        { id: 2, type: 'developer' }
      ];
      
      const work: AssignableWork[] = [
        { id: 102, type: 'user_story', status: 'new' }
      ];
      
      const rules: AssignmentRule[] = [
        { agentType: 'developer', workType: 'user_story', workStatus: 'new' }
      ];
      
      const assignments = matchAgentsToWork(agents, work, rules);
      
      assert.strictEqual(assignments.length, 1);
      assert.strictEqual(assignments[0].agentId, 2);
      assert.strictEqual(assignments[0].workItemId, 102);
    });

    test('should match tester to review', () => {
      const agents: Agent[] = [
        { id: 3, type: 'tester' }
      ];
      
      const work: AssignableWork[] = [
        { id: 103, type: 'user_story', status: 'review' }
      ];
      
      const rules: AssignmentRule[] = [
        { agentType: 'tester', workType: 'user_story', workStatus: 'review' }
      ];
      
      const assignments = matchAgentsToWork(agents, work, rules);
      
      assert.strictEqual(assignments.length, 1);
      assert.strictEqual(assignments[0].agentId, 3);
      assert.strictEqual(assignments[0].workItemId, 103);
    });

    test('should handle multiple agents and work items', () => {
      const agents: Agent[] = [
        { id: 1, type: 'architect' },
        { id: 2, type: 'developer' },
        { id: 3, type: 'tester' }
      ];
      
      const work: AssignableWork[] = [
        { id: 101, type: 'epic', status: 'new' },
        { id: 102, type: 'user_story', status: 'new' },
        { id: 103, type: 'user_story', status: 'review' }
      ];
      
      const rules: AssignmentRule[] = [
        { agentType: 'architect', workType: 'epic', workStatus: 'new' },
        { agentType: 'developer', workType: 'user_story', workStatus: 'new' },
        { agentType: 'tester', workType: 'user_story', workStatus: 'review' }
      ];
      
      const assignments = matchAgentsToWork(agents, work, rules);
      
      assert.strictEqual(assignments.length, 3);
    });

    test('should return empty array when no matches', () => {
      const agents: Agent[] = [
        { id: 1, type: 'architect' }
      ];
      
      const work: AssignableWork[] = [
        { id: 102, type: 'user_story', status: 'new' }
      ];
      
      const rules: AssignmentRule[] = [
        { agentType: 'architect', workType: 'epic', workStatus: 'new' }
      ];
      
      const assignments = matchAgentsToWork(agents, work, rules);
      
      assert.strictEqual(assignments.length, 0);
    });

    test('should only assign one work item per agent', () => {
      const agents: Agent[] = [
        { id: 1, type: 'developer' }
      ];
      
      const work: AssignableWork[] = [
        { id: 101, type: 'user_story', status: 'new' },
        { id: 102, type: 'user_story', status: 'new' }
      ];
      
      const rules: AssignmentRule[] = [
        { agentType: 'developer', workType: 'user_story', workStatus: 'new' }
      ];
      
      const assignments = matchAgentsToWork(agents, work, rules);
      
      assert.strictEqual(assignments.length, 1);
      assert.strictEqual(assignments[0].agentId, 1);
      assert.strictEqual(assignments[0].workItemId, 101);
    });
  });
});