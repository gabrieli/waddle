import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextRetrievalService, RetrievalContext, ScoredKnowledge } from './context-retrieval.js';
import { initializeDatabase, closeDatabase } from '../database/connection.js';
import { createPattern, createADR, createReview } from '../database/knowledge.js';
import { PatternCreateParams, ADRCreateParams, ReviewCreateParams } from '../types/knowledge.js';

describe('ContextRetrievalService', () => {
  let service: ContextRetrievalService;

  beforeEach(() => {
    initializeDatabase(':memory:');
    service = new ContextRetrievalService();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('calculateRelevanceScore', () => {
    it('should score exact keyword matches highly', () => {
      const context: RetrievalContext = {
        currentTask: 'Implement API authentication with JWT tokens',
        agentRole: 'developer',
        workItemType: 'story'
      };

      const knowledgeContent = 'Best practices for JWT token authentication in REST APIs';
      
      const score = service.calculateRelevanceScore(knowledgeContent, context);
      
      expect(score).toBeGreaterThan(0.5);
    });

    it('should score unrelated content low', () => {
      const context: RetrievalContext = {
        currentTask: 'Implement API authentication',
        agentRole: 'developer',
        workItemType: 'story'
      };

      const knowledgeContent = 'How to optimize database queries for better performance';
      
      const score = service.calculateRelevanceScore(knowledgeContent, context);
      
      expect(score).toBeLessThan(0.3);
    });

    it('should give bonus for matching agent role', () => {
      const context: RetrievalContext = {
        currentTask: 'Review code quality',
        agentRole: 'reviewer',
        workItemType: 'story'
      };

      const knowledgeWithRole = 'Code review best practices for reviewer agents';
      const knowledgeWithoutRole = 'Code review best practices';
      
      const scoreWithRole = service.calculateRelevanceScore(knowledgeWithRole, context);
      const scoreWithoutRole = service.calculateRelevanceScore(knowledgeWithoutRole, context);
      
      expect(scoreWithRole).toBeGreaterThan(scoreWithoutRole);
    });
  });

  describe('retrieveRelevantContext', () => {
    beforeEach(() => {
      // Add test data
      const patterns: PatternCreateParams[] = [
        {
          agent_role: 'developer',
          pattern_type: 'solution',
          context: 'When implementing JWT authentication',
          solution: 'Use jsonwebtoken library with RS256 algorithm',
          effectiveness_score: 0.9
        },
        {
          agent_role: 'developer',
          pattern_type: 'error_handling',
          context: 'Database connection errors',
          solution: 'Implement exponential backoff retry logic',
          effectiveness_score: 0.8
        },
        {
          agent_role: 'reviewer',
          pattern_type: 'approach',
          context: 'Reviewing authentication implementations',
          solution: 'Check for secure token storage and validation',
          effectiveness_score: 0.85
        }
      ];

      patterns.forEach(pattern => createPattern(pattern));

      const adrs: ADRCreateParams[] = [
        {
          title: 'Use JWT for API Authentication',
          context: 'Need secure stateless authentication',
          decision: 'Implement JWT with RS256 algorithm',
          consequences: 'Requires key management infrastructure',
          status: 'accepted',
          created_by: 'architect'
        }
      ];

      adrs.forEach(adr => createADR(adr));
    });

    it('should retrieve relevant patterns for a task', () => {
      const context: RetrievalContext = {
        currentTask: 'Implement user authentication with JWT',
        agentRole: 'developer',
        workItemType: 'story'
      };

      const results = service.retrieveRelevantContext(context, { maxResults: 5 });

      expect(results.patterns.length).toBeGreaterThan(0);
      expect(results.patterns[0].content).toContain('JWT');
      expect(results.patterns[0].relevanceScore).toBeGreaterThan(0.5);
    });

    it('should retrieve relevant ADRs', () => {
      const context: RetrievalContext = {
        currentTask: 'Design authentication system',
        agentRole: 'architect',
        workItemType: 'story'
      };

      const results = service.retrieveRelevantContext(context, { maxResults: 5 });

      expect(results.adrs.length).toBeGreaterThan(0);
      expect(results.adrs[0].content).toContain('JWT');
    });

    it('should respect maxResults limit', () => {
      const context: RetrievalContext = {
        currentTask: 'General development task',
        agentRole: 'developer',
        workItemType: 'story'
      };

      const results = service.retrieveRelevantContext(context, { maxResults: 2 });

      const totalItems = results.patterns.length + results.adrs.length + results.reviews.length;
      expect(totalItems).toBeLessThanOrEqual(2);
    });

    it('should filter by minimum relevance score', () => {
      const context: RetrievalContext = {
        currentTask: 'Implement completely unrelated feature',
        agentRole: 'developer',
        workItemType: 'story'
      };

      const results = service.retrieveRelevantContext(context, { 
        minRelevanceScore: 0.7 
      });

      results.patterns.forEach(pattern => {
        expect(pattern.relevanceScore).toBeGreaterThanOrEqual(0.7);
      });
    });
  });

  describe('formatContextForPrompt', () => {
    it('should format context into a readable prompt section', () => {
      const scoredKnowledge: ScoredKnowledge = {
        patterns: [
          {
            id: 'P1',
            type: 'pattern',
            content: 'Use JWT for authentication',
            relevanceScore: 0.9,
            metadata: { effectiveness_score: 0.85 }
          }
        ],
        adrs: [
          {
            id: 'A1',
            type: 'adr',
            content: 'Decision: Use RS256 algorithm',
            relevanceScore: 0.8,
            metadata: { status: 'accepted' }
          }
        ],
        reviews: []
      };

      const formatted = service.formatContextForPrompt(scoredKnowledge);

      expect(formatted).toContain('Historical Context');
      expect(formatted).toContain('Patterns');
      expect(formatted).toContain('Architecture Decisions');
      expect(formatted).toContain('JWT');
      expect(formatted).toContain('RS256');
    });

    it('should handle empty context gracefully', () => {
      const emptyKnowledge: ScoredKnowledge = {
        patterns: [],
        adrs: [],
        reviews: []
      };

      const formatted = service.formatContextForPrompt(emptyKnowledge);

      expect(formatted).toBe('');
    });
  });
});