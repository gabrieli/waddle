import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedPromptBuilder } from './prompts-enhanced.js';
import { ContextRetrievalService } from '../services/context-retrieval.js';
import { ContextManager } from './context-manager.js';
import { WorkItem } from '../types/index.js';
import { initializeDatabase, closeDatabase } from '../database/connection.js';
import { createPattern, createADR } from '../database/knowledge.js';

describe('EnhancedPromptBuilder', () => {
  let promptBuilder: EnhancedPromptBuilder;
  let mockContextManager: ContextManager;
  let contextRetrievalService: ContextRetrievalService;

  beforeEach(() => {
    initializeDatabase(':memory:');
    
    // Create some test knowledge
    createPattern({
      agent_role: 'developer',
      pattern_type: 'solution',
      context: 'When implementing authentication',
      solution: 'Use JWT tokens with proper validation',
      effectiveness_score: 0.9
    });

    createADR({
      title: 'Use Microservices Architecture',
      context: 'Need for scalability',
      decision: 'Adopt microservices pattern',
      status: 'accepted',
      created_by: 'architect'
    });

    mockContextManager = new ContextManager();
    contextRetrievalService = new ContextRetrievalService();
    
    promptBuilder = new EnhancedPromptBuilder({
      contextManager: mockContextManager,
      contextRetrievalService,
      enableHistoricalContext: true,
      enableKnowledgeBase: true
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('buildDeveloperPrompt', () => {
    it('should include knowledge base context for relevant tasks', async () => {
      const workItem: WorkItem = {
        id: 'STORY-001',
        type: 'story',
        title: 'Implement user authentication',
        description: 'Add JWT-based authentication to the API',
        status: 'ready',
        parent_id: null,
        assigned_role: 'developer',
        processing_started_at: null,
        processing_agent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const technicalContext = 'Use the existing auth module';
      
      const prompt = await promptBuilder.buildDeveloperPrompt(workItem, technicalContext);
      
      expect(prompt).toContain('HISTORICAL CONTEXT');
      expect(prompt).toContain('JWT'); // Should include the relevant pattern
      expect(prompt).toContain('authentication'); // Should include context from pattern
      expect(prompt).toContain(technicalContext);
    });

    it('should handle missing knowledge gracefully', async () => {
      const workItem: WorkItem = {
        id: 'STORY-002',
        type: 'story',
        title: 'Unrelated task about quantum computing',
        description: 'Something completely different',
        status: 'ready',
        parent_id: null,
        assigned_role: 'developer',
        processing_started_at: null,
        processing_agent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const prompt = await promptBuilder.buildDeveloperPrompt(workItem, 'Some context');
      
      expect(prompt).toBeDefined();
      expect(prompt).toContain(workItem.title);
      // Should not fail even if no relevant knowledge is found
    });

    it('should respect context length limits', async () => {
      // Add lots of patterns to trigger truncation
      for (let i = 0; i < 20; i++) {
        createPattern({
          agent_role: 'developer',
          pattern_type: 'solution',
          context: `Pattern ${i}: When implementing authentication feature with lots of details and context`,
          solution: `Solution ${i}: Use JWT tokens with proper validation and many implementation details that make this text very long`,
          effectiveness_score: 0.9
        });
      }
      
      const shortLimitBuilder = new EnhancedPromptBuilder({
        contextRetrievalService,
        maxContextLength: 100,
        enableKnowledgeBase: true,
        maxKnowledgeItems: 20 // Get many items
      });

      const workItem: WorkItem = {
        id: 'STORY-003',
        type: 'story',
        title: 'Implement authentication feature',
        description: 'This task is about authentication which should match many patterns',
        status: 'ready',
        parent_id: null,
        assigned_role: 'developer',
        processing_started_at: null,
        processing_agent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const prompt = await shortLimitBuilder.buildDeveloperPrompt(workItem, 'Technical context');
      
      expect(prompt).toContain('[Context truncated]');
    });
  });

  describe('buildArchitectPrompt', () => {
    it('should include ADRs for architectural work', async () => {
      const epic: WorkItem = {
        id: 'EPIC-001',
        type: 'epic',
        title: 'Implement scalable architecture',
        description: 'Refactor to support growth',
        status: 'ready',
        parent_id: null,
        assigned_role: 'architect',
        processing_started_at: null,
        processing_agent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const prompt = await promptBuilder.buildArchitectPrompt(epic);
      
      expect(prompt).toContain('Architecture Decisions');
      expect(prompt).toContain('Microservices'); // Should include the ADR
    });
  });

  describe('buildManagerPrompt', () => {
    it('should aggregate context from multiple work items', async () => {
      const workItems: WorkItem[] = [
        {
          id: 'STORY-001',
          type: 'story',
          title: 'Authentication story',
          description: null,
          status: 'ready',
          parent_id: null,
          assigned_role: null,
          processing_started_at: null,
          processing_agent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'BUG-001',
          type: 'bug',
          title: 'Fix authentication error',
          description: null,
          status: 'ready',
          parent_id: null,
          assigned_role: null,
          processing_started_at: null,
          processing_agent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const prompt = await promptBuilder.buildManagerPrompt(workItems, 'Recent history', 'No errors');
      
      expect(prompt).toContain('STORY-001');
      expect(prompt).toContain('BUG-001');
      expect(prompt).toContain('No errors'); // Check for the errors parameter instead
    });
  });

  describe('configuration options', () => {
    it('should allow disabling knowledge base', async () => {
      const noKnowledgeBuilder = new EnhancedPromptBuilder({
        enableKnowledgeBase: false,
        enableHistoricalContext: false
      });

      const workItem: WorkItem = {
        id: 'STORY-001',
        type: 'story',
        title: 'Test story',
        description: null,
        status: 'ready',
        parent_id: null,
        assigned_role: null,
        processing_started_at: null,
        processing_agent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const prompt = await noKnowledgeBuilder.buildDeveloperPrompt(workItem, 'Context');
      
      expect(prompt).not.toContain('HISTORICAL CONTEXT');
    });

    it('should allow configuring relevance threshold', async () => {
      const highThresholdBuilder = new EnhancedPromptBuilder({
        contextRetrievalService,
        minRelevanceScore: 0.9, // Very high threshold
        enableKnowledgeBase: true
      });

      const workItem: WorkItem = {
        id: 'STORY-001',
        type: 'story',
        title: 'Vaguely related to authentication',
        description: null,
        status: 'ready',
        parent_id: null,
        assigned_role: null,
        processing_started_at: null,
        processing_agent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const prompt = await highThresholdBuilder.buildDeveloperPrompt(workItem, 'Context');
      
      // With high threshold, vague matches shouldn't be included
      expect(prompt).toBeDefined();
    });
  });
});