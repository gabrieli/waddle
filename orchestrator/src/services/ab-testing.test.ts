import { describe, it, expect, beforeEach } from 'vitest';
import { ABTestingService, ABTestConfig, ABTestMetrics } from './ab-testing.js';

describe('ABTestingService', () => {
  let abService: ABTestingService;
  
  beforeEach(() => {
    const config: ABTestConfig = {
      enabled: true,
      contextEnabledPercent: 50,
      seed: 12345 // Fixed seed for deterministic tests
    };
    abService = new ABTestingService(config);
  });

  describe('variant assignment', () => {
    it('should deterministically assign variants based on work item ID', () => {
      const result1 = abService.getVariant('developer', 'STORY-001');
      const result2 = abService.getVariant('developer', 'STORY-001');
      
      expect(result1.variant).toBe(result2.variant);
      expect(result1.enableContext).toBe(result2.enableContext);
    });

    it('should assign different variants to different work items', () => {
      const results = [];
      for (let i = 0; i < 100; i++) {
        const result = abService.getVariant('developer', `STORY-${i}`);
        results.push(result.enableContext);
      }
      
      const withContext = results.filter(r => r).length;
      const withoutContext = results.filter(r => !r).length;
      
      // With 50% split, should be roughly equal (allow 20% margin)
      expect(withContext).toBeGreaterThan(30);
      expect(withContext).toBeLessThan(70);
      expect(withoutContext).toBeGreaterThan(30);
      expect(withoutContext).toBeLessThan(70);
    });

    it('should respect percentage configuration', () => {
      const service80 = new ABTestingService({
        enabled: true,
        contextEnabledPercent: 80,
        seed: 12345
      });
      
      const results = [];
      for (let i = 0; i < 100; i++) {
        const result = service80.getVariant('developer', `STORY-${i}`);
        results.push(result.enableContext);
      }
      
      const withContext = results.filter(r => r).length;
      
      // With 80% enabled, should be around 80 (allow 15% margin)
      expect(withContext).toBeGreaterThan(65);
      expect(withContext).toBeLessThan(95);
    });

    it('should return control when disabled', () => {
      const disabledService = new ABTestingService({
        enabled: false,
        contextEnabledPercent: 50
      });
      
      const result = disabledService.getVariant('developer', 'STORY-001');
      
      expect(result.variant).toBe('control');
      expect(result.enableContext).toBe(false);
    });
  });

  describe('metrics recording', () => {
    it('should record execution metrics', () => {
      const metrics: ABTestMetrics = {
        variant: 'treatment',
        agentRole: 'developer',
        workItemId: 'STORY-001',
        executionTimeMs: 1500,
        success: true,
        contextSize: 2048,
        timestamp: new Date()
      };
      
      abService.recordMetrics(metrics);
      
      const stats = abService.getStats();
      expect(stats.treatment.count).toBe(1);
      expect(stats.treatment.successCount).toBe(1);
      expect(stats.treatment.avgExecutionTime).toBe(1500);
      expect(stats.treatment.avgContextSize).toBe(2048);
    });

    it('should track failure metrics', () => {
      abService.recordMetrics({
        variant: 'control',
        agentRole: 'developer',
        workItemId: 'STORY-001',
        executionTimeMs: 500,
        success: false,
        errorType: 'timeout',
        timestamp: new Date()
      });
      
      const stats = abService.getStats();
      expect(stats.control.count).toBe(1);
      expect(stats.control.successCount).toBe(0);
      expect(stats.control.errorCounts.timeout).toBe(1);
    });

    it('should calculate success rates correctly', () => {
      // Record some successes and failures
      for (let i = 0; i < 3; i++) {
        abService.recordMetrics({
          variant: 'treatment',
          agentRole: 'developer',
          workItemId: `STORY-${i}`,
          executionTimeMs: 1000,
          success: true,
          timestamp: new Date()
        });
      }
      
      abService.recordMetrics({
        variant: 'treatment',
        agentRole: 'developer',
        workItemId: 'STORY-FAIL',
        executionTimeMs: 1000,
        success: false,
        timestamp: new Date()
      });
      
      const stats = abService.getStats();
      expect(stats.treatment.successRate).toBeCloseTo(0.75, 2);
    });
  });

  describe('statistical analysis', () => {
    it('should calculate improvement metrics', () => {
      // Record control metrics
      for (let i = 0; i < 10; i++) {
        abService.recordMetrics({
          variant: 'control',
          agentRole: 'developer',
          workItemId: `CONTROL-${i}`,
          executionTimeMs: 2000,
          success: i < 6, // 60% success rate
          timestamp: new Date()
        });
      }
      
      // Record treatment metrics
      for (let i = 0; i < 10; i++) {
        abService.recordMetrics({
          variant: 'treatment',
          agentRole: 'developer',
          workItemId: `TREATMENT-${i}`,
          executionTimeMs: 1500,
          success: i < 8, // 80% success rate
          timestamp: new Date()
        });
      }
      
      const analysis = abService.getImpactAnalysis();
      
      expect(analysis.successRateImprovement).toBeCloseTo(0.333, 2); // 33.3% improvement
      expect(analysis.executionTimeImprovement).toBeCloseTo(-0.25, 2); // 25% faster
      expect(analysis.sampleSize.control).toBe(10);
      expect(analysis.sampleSize.treatment).toBe(10);
    });

    it('should identify statistically significant differences', () => {
      // Add enough samples for statistical significance
      for (let i = 0; i < 100; i++) {
        abService.recordMetrics({
          variant: 'control',
          agentRole: 'developer',
          workItemId: `CONTROL-${i}`,
          executionTimeMs: 2000 + Math.random() * 500,
          success: Math.random() < 0.6, // ~60% success
          timestamp: new Date()
        });
        
        abService.recordMetrics({
          variant: 'treatment',
          agentRole: 'developer', 
          workItemId: `TREATMENT-${i}`,
          executionTimeMs: 1500 + Math.random() * 500,
          success: Math.random() < 0.8, // ~80% success
          timestamp: new Date()
        });
      }
      
      const analysis = abService.getImpactAnalysis();
      
      expect(analysis.isSignificant).toBe(true);
      expect(analysis.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('reporting', () => {
    it('should generate comprehensive report', () => {
      // Add some test data
      for (let i = 0; i < 5; i++) {
        abService.recordMetrics({
          variant: i % 2 === 0 ? 'control' : 'treatment',
          agentRole: 'developer',
          workItemId: `STORY-${i}`,
          executionTimeMs: 1000 + i * 100,
          success: true,
          contextSize: i % 2 === 1 ? 1000 + i * 500 : undefined,
          timestamp: new Date()
        });
      }
      
      const report = abService.generateReport();
      
      expect(report).toContain('A/B Test Report');
      expect(report).toContain('Control Group');
      expect(report).toContain('Treatment Group');
      expect(report).toContain('Impact Analysis');
      expect(report).toContain('Success Rate');
      expect(report).toContain('Execution Time');
    });
  });

  describe('persistence', () => {
    it('should export and import metrics data', () => {
      // Add test data
      abService.recordMetrics({
        variant: 'treatment',
        agentRole: 'developer',
        workItemId: 'STORY-001',
        executionTimeMs: 1500,
        success: true,
        timestamp: new Date()
      });
      
      const exported = abService.exportMetrics();
      
      // Create new service and import
      const newService = new ABTestingService({
        enabled: true,
        contextEnabledPercent: 50
      });
      
      newService.importMetrics(exported);
      
      const stats = newService.getStats();
      expect(stats.treatment.count).toBe(1);
      expect(stats.treatment.avgExecutionTime).toBe(1500);
    });
  });
});