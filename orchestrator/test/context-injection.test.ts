import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ContextManager, HistoricalContext } from '../src/agents/context-manager.js';
import { RelevanceScorer } from '../src/agents/relevance-scorer.js';
import { ABTestingManager } from '../src/agents/ab-testing.js';
import { initDatabase } from '../src/database/migrations.js';
import { createWorkItem, addHistory, getWorkItem } from '../src/database/utils.js';
import { closeDatabase } from '../src/database/connection.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = './test-context-injection.db';

describe('Context Injection System', () => {
  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Initialize test database
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    // Close database connection
    closeDatabase();
    
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('ContextManager', () => {
    it('should retrieve historical context for a work item', async () => {
      // Create test data
      const epicId = 'EPIC-001';
      createWorkItem(epicId, 'epic', 'Test Epic', 'Test description');
      
      // Add some history
      addHistory(epicId, 'status_change', JSON.stringify({ from: 'backlog', to: 'ready' }), 'manager');
      addHistory(epicId, 'agent_output', 'Analysis complete', 'architect');
      addHistory(epicId, 'error', JSON.stringify({ errorType: 'PARSE_ERROR', errorMessage: 'Invalid JSON' }), 'architect');
      
      // Create context manager
      const contextManager = new ContextManager({
        maxHistoryItems: 10,
        maxRelatedItems: 5
      });
      
      // Get context
      const context = await contextManager.getContextForWorkItem(epicId);
      
      expect(context).toBeDefined();
      expect(context.workItemId).toBe(epicId);
      expect(context.relevantHistory).toHaveLength(3);
      expect(context.errorPatterns).toContain('PARSE_ERROR: Invalid JSON');
    });

    it('should include related work items in context', async () => {
      // Create parent and child items
      const epicId = 'EPIC-002';
      const storyId = 'STORY-001';
      
      createWorkItem(epicId, 'epic', 'Parent Epic', 'Parent description');
      createWorkItem(storyId, 'story', 'Child Story', 'Child description', epicId);
      
      const contextManager = new ContextManager();
      const context = await contextManager.getContextForWorkItem(storyId);
      
      expect(context.relatedItems).toHaveLength(1);
      expect(context.relatedItems[0].id).toBe(epicId);
      expect(context.relatedItems[0].type).toBe('epic');
    });

    it('should generate agent-specific context strings', async () => {
      const epicId = 'EPIC-003';
      createWorkItem(epicId, 'epic', 'Test Epic', 'Test description');
      
      // Add varied history
      addHistory(epicId, 'agent_output', JSON.stringify({ status: 'completed' }), 'architect');
      addHistory(epicId, 'error', JSON.stringify({ errorType: 'TIMEOUT', errorMessage: 'Request timed out' }), 'developer');
      
      const contextManager = new ContextManager();
      const contextStr = await contextManager.getContextForAgent('developer', epicId);
      
      expect(contextStr).toContain('RELEVANT HISTORY:');
      expect(contextStr).toContain('COMMON ERRORS TO AVOID:');
      expect(contextStr).toContain('TIMEOUT: Request timed out');
    });

    it('should respect maxHistoryItems configuration', async () => {
      const epicId = 'EPIC-004';
      createWorkItem(epicId, 'epic', 'Test Epic', 'Test description');
      
      // Add more history than the limit
      for (let i = 0; i < 20; i++) {
        addHistory(epicId, 'agent_output', `Action ${i}`, 'developer');
      }
      
      const contextManager = new ContextManager({
        maxHistoryItems: 5
      });
      
      const context = await contextManager.getContextForWorkItem(epicId);
      expect(context.relevantHistory).toHaveLength(5);
    });

    it('should cache context for performance', async () => {
      const epicId = 'EPIC-005';
      createWorkItem(epicId, 'epic', 'Test Epic', 'Test description');
      
      const contextManager = new ContextManager({
        enableCaching: true,
        cacheTTLMinutes: 5
      });
      
      // First call - should build context
      const startTime1 = Date.now();
      const context1 = await contextManager.getContextForWorkItem(epicId);
      const time1 = Date.now() - startTime1;
      
      // Second call - should use cache
      const startTime2 = Date.now();
      const context2 = await contextManager.getContextForWorkItem(epicId);
      const time2 = Date.now() - startTime2;
      
      expect(context1).toEqual(context2);
      expect(time2).toBeLessThan(time1); // Cache should be faster
    });
  });

  describe('RelevanceScorer', () => {
    it('should score history items by relevance', () => {
      const scorer = new RelevanceScorer();
      
      const workItem = {
        id: 'STORY-001',
        type: 'story' as const,
        title: 'Implement user authentication',
        description: 'Add login and registration features',
        status: 'in_progress' as const,
        parent_id: null,
        assigned_role: null,
        processing_started_at: null,
        processing_agent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const history = [
        {
          id: 1,
          work_item_id: 'STORY-001',
          action: 'agent_output' as const,
          content: 'Implemented authentication logic',
          created_by: 'developer',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          work_item_id: 'STORY-001',
          action: 'error' as const,
          content: JSON.stringify({ errorType: 'AUTH_ERROR', errorMessage: 'Invalid credentials' }),
          created_by: 'developer',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 1 week old
        }
      ];
      
      const scored = scorer.scoreHistory(history, workItem, 'developer');
      
      expect(scored).toHaveLength(2);
      expect(scored[0].score).toBeGreaterThan(scored[1].score); // Recent item should score higher
      expect(scored[0].reasons).toContain('Recent activity');
    });

    it('should boost scores for related work items', () => {
      const scorer = new RelevanceScorer();
      
      const currentItem = {
        id: 'STORY-002',
        type: 'story' as const,
        parent_id: 'EPIC-001',
        title: 'Test Story',
        description: null,
        status: 'ready' as const,
        assigned_role: null,
        processing_started_at: null,
        processing_agent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const relatedItems = [
        { ...currentItem, id: 'EPIC-001', type: 'epic' as const, parent_id: null }, // Parent
        { ...currentItem, id: 'STORY-003', parent_id: 'EPIC-001' } // Sibling
      ];
      
      const scored = scorer.scoreWorkItems(relatedItems, currentItem, 'developer');
      
      expect(scored[0].reasons).toContain('Parent item');
      expect(scored[1].reasons).toContain('Sibling item');
      expect(scored[0].score).toBeGreaterThan(scored[1].score);
    });

    it('should calculate text similarity correctly', () => {
      const scorer = new RelevanceScorer();
      
      const workItem = {
        id: 'BUG-001',
        type: 'bug' as const,
        title: 'Fix authentication error handling',
        description: 'Users see generic error instead of specific message',
        status: 'ready' as const,
        parent_id: null,
        assigned_role: null,
        processing_started_at: null,
        processing_agent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const history = [
        {
          id: 1,
          work_item_id: 'BUG-001',
          action: 'agent_output' as const,
          content: 'Fixed authentication error messages',
          created_by: 'developer',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          work_item_id: 'BUG-001',
          action: 'agent_output' as const,
          content: 'Unrelated content about database optimization',
          created_by: 'developer',
          created_at: new Date().toISOString()
        }
      ];
      
      const scored = scorer.scoreHistory(history, workItem, 'developer');
      
      expect(scored[0].score).toBeGreaterThan(scored[1].score); // Related content should score higher
    });
  });

  describe('ABTestingManager', () => {
    it('should deterministically assign A/B test variants', () => {
      const config = {
        abTesting: {
          enabled: true,
          contextEnabledPercent: 50,
          seed: 12345
        },
        pollingInterval: 5000,
        claudeExecutable: 'claude',
        workingDirectory: '.',
        database: TEST_DB_PATH,
        agents: {
          manager: { model: 'claude-3-sonnet' },
          architect: { model: 'claude-3-sonnet' },
          developer: { model: 'claude-3-sonnet' }
        }
      };
      
      const abManager = new ABTestingManager(config);
      
      // Same work item should always get same assignment
      const result1 = abManager.shouldEnableContext('WORK-001', 'developer');
      const result2 = abManager.shouldEnableContext('WORK-001', 'developer');
      
      expect(result1.enableContext).toBe(result2.enableContext);
      expect(result1.variant).toBe(result2.variant);
    });

    it('should record and analyze metrics', () => {
      const config = {
        abTesting: {
          enabled: true,
          contextEnabledPercent: 50
        },
        pollingInterval: 5000,
        claudeExecutable: 'claude',
        workingDirectory: '.',
        database: TEST_DB_PATH,
        agents: {
          manager: { model: 'claude-3-sonnet' },
          architect: { model: 'claude-3-sonnet' },
          developer: { model: 'claude-3-sonnet' }
        }
      };
      
      const abManager = new ABTestingManager(config);
      
      // Record some metrics
      abManager.recordMetrics({
        variant: 'control',
        workItemId: 'WORK-001',
        agentType: 'developer',
        executionTimeMs: 1000,
        success: true,
        timestamp: new Date()
      });
      
      abManager.recordMetrics({
        variant: 'treatment',
        workItemId: 'WORK-002',
        agentType: 'developer',
        executionTimeMs: 1200,
        success: true,
        contextSize: 1500,
        timestamp: new Date()
      });
      
      abManager.recordMetrics({
        variant: 'control',
        workItemId: 'WORK-003',
        agentType: 'developer',
        executionTimeMs: 800,
        success: false,
        errorType: 'timeout',
        timestamp: new Date()
      });
      
      const stats = abManager.getSummaryStats();
      
      expect(stats.control.count).toBe(2);
      expect(stats.control.successRate).toBe(0.5);
      expect(stats.treatment.count).toBe(1);
      expect(stats.treatment.successRate).toBe(1.0);
      expect(stats.treatment.avgContextSize).toBe(1500);
    });

    it('should generate meaningful reports', () => {
      const config = {
        abTesting: {
          enabled: true,
          contextEnabledPercent: 50
        },
        pollingInterval: 5000,
        claudeExecutable: 'claude',
        workingDirectory: '.',
        database: TEST_DB_PATH,
        agents: {
          manager: { model: 'claude-3-sonnet' },
          architect: { model: 'claude-3-sonnet' },
          developer: { model: 'claude-3-sonnet' }
        }
      };
      
      const abManager = new ABTestingManager(config);
      
      // Add test data
      for (let i = 0; i < 10; i++) {
        abManager.recordMetrics({
          variant: i % 2 === 0 ? 'control' : 'treatment',
          workItemId: `WORK-${i}`,
          agentType: 'developer',
          executionTimeMs: 1000 + Math.random() * 500,
          success: Math.random() > 0.2,
          contextSize: i % 2 === 1 ? 1000 + Math.random() * 1000 : undefined,
          timestamp: new Date()
        });
      }
      
      const report = abManager.generateReport();
      
      expect(report).toContain('A/B TEST REPORT');
      expect(report).toContain('Control Group');
      expect(report).toContain('Treatment Group');
      expect(report).toContain('Impact Analysis');
      expect(report).toContain('Success rate change:');
    });
  });

  describe('Integration Tests', () => {
    it('should inject context into prompts correctly', async () => {
      // This would be a full integration test with the prompt builders
      // For now, we'll test the basic flow
      
      const epicId = 'EPIC-INT-001';
      createWorkItem(epicId, 'epic', 'Integration Test Epic', 'Test integration');
      
      // Add rich history
      addHistory(epicId, 'agent_output', JSON.stringify({
        status: 'completed',
        technicalApproach: 'Use microservices architecture'
      }), 'architect');
      
      addHistory(epicId, 'error', JSON.stringify({
        errorType: 'DEPENDENCY_ERROR',
        errorMessage: 'Missing required package'
      }), 'developer');
      
      const contextManager = new ContextManager();
      const contextStr = await contextManager.getContextForAgent('developer', epicId);
      
      // Verify context contains expected information
      expect(contextStr).toContain('RELEVANT HISTORY:');
      expect(contextStr).toContain('architect');
      expect(contextStr).toContain('COMMON ERRORS TO AVOID:');
      expect(contextStr).toContain('DEPENDENCY_ERROR');
    });
  });
});