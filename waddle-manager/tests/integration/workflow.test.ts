/**
 * Integration tests for Waddle workflow
 * Tests the interaction between MCP Server, Database, and Executor
 */

import { MCPServer } from '../../src/mcp-server';
import { Database } from '../../src/database';
import { WaddleManager } from '../../src/orchestrator';
import { HeadlessClaudeExecutor } from '../../src/executor';
import type { JSONRPCRequest } from '../../src/mcp-server/types';
import * as fs from 'fs';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process for executor tests
jest.mock('child_process');

describe('Waddle Integration Tests', () => {
  let db: Database;
  let manager: WaddleManager;
  let server: MCPServer;
  let executor: HeadlessClaudeExecutor;
  const testDbPath = './test-integration.db';
  const testPort = 3789;

  beforeEach(async () => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize components
    db = new Database(testDbPath);
    await db.initialize();
    
    manager = new WaddleManager();
    await manager.start();

    server = new MCPServer(db, manager, testPort);
    await server.start();

    executor = new HeadlessClaudeExecutor({
      claudePath: 'mock-claude',
      maxRetries: 1,
      retryDelay: 100,
    });
  });

  afterEach(async () => {
    await server.stop();
    await manager.stop();
    await db.close();
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Feature Creation and Task Execution Flow', () => {
    it('should create feature, generate tasks, and simulate execution', async () => {
      // Step 1: Create feature via MCP
      const createRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'createFeature',
        params: {
          description: 'Add user authentication system',
          priority: 'high',
          metadata: {
            tags: ['security', 'backend'],
            estimation: 5,
          },
        },
        id: 'test-1',
      };

      const createResponse = await server.handleRequest(createRequest);
      expect(createResponse.error).toBeUndefined();
      
      const featureId = (createResponse.result as any).id;
      expect(featureId).toBeDefined();

      // Step 2: Verify feature and initial task in database
      const feature = db.features.findById(featureId);
      expect(feature).toBeDefined();
      expect(feature?.description).toBe('Add user authentication system');
      expect(feature?.priority).toBe('high');
      expect(feature?.status).toBe('pending');

      const tasks = db.tasks.findByFeatureId(featureId);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].role).toBe('architect');
      expect(tasks[0].status).toBe('pending');

      // Step 3: Simulate task execution with executor
      const architectTask = tasks[0];
      
      // Mock successful architect execution
      const mockArchitectOutput = {
        design: {
          overview: 'JWT-based authentication system',
          components: [
            {
              name: 'AuthController',
              description: 'Handles auth endpoints',
              responsibilities: ['Login', 'Logout', 'Token refresh'],
            },
            {
              name: 'AuthService',
              description: 'Business logic for auth',
              responsibilities: ['Token generation', 'User validation'],
            },
          ],
          dataFlow: 'Client -> AuthController -> AuthService -> Database',
          dependencies: ['jsonwebtoken', 'bcrypt'],
        },
        implementation: {
          approach: 'TDD with comprehensive test coverage',
          phases: ['Setup and models', 'Core logic', 'API endpoints'],
          risks: ['Token security', 'Session management'],
        },
      };

      const mockSpawn = child_process.spawn as jest.MockedFunction<typeof child_process.spawn>;
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockSpawn.mockReturnValue(mockProcess);

      // Execute task
      const executionPromise = executor.execute({
        role: 'architect',
        task: architectTask,
        context: [],
      });

      // Simulate Claude response
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(mockArchitectOutput)));
      mockProcess.emit('exit', 0, null);

      const executionResult = await executionPromise;
      expect(executionResult.success).toBe(true);
      expect(executionResult.output).toEqual(mockArchitectOutput);

      // Step 4: Update task in database
      db.tasks.update(architectTask.id, {
        status: 'complete',
        completedAt: new Date(),
        output: executionResult.output,
      });

      // Store architecture as context
      db.context.create({
        featureId,
        type: 'architecture',
        content: JSON.stringify(mockArchitectOutput),
        author: 'architect',
      });

      // Create developer task based on architect output
      const devTask = db.tasks.create({
        featureId,
        role: 'developer',
        description: 'Implement authentication system based on architecture',
      });

      // Step 5: Query progress via MCP
      const progressRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'getProgress',
        params: { featureId },
        id: 'test-2',
      };

      const progressResponse = await server.handleRequest(progressRequest);
      const progress = (progressResponse.result as any);
      
      expect(progress.features).toHaveLength(1);
      expect(progress.features[0].id).toBe(featureId);
      expect(progress.features[0].progress).toBe(50); // 1 of 2 tasks complete
      expect(progress.features[0].activeTasks).toBe(0);
      expect(progress.features[0].completedTasks).toBe(1);

      // Step 6: Simulate developer execution
      const mockDeveloperOutput = {
        filesCreated: [
          'src/auth/auth.controller.ts',
          'src/auth/auth.service.ts',
          'src/auth/auth.module.ts',
        ],
        filesModified: ['src/app.module.ts'],
        testsAdded: [
          'src/auth/auth.controller.test.ts',
          'src/auth/auth.service.test.ts',
        ],
        implementation: {
          summary: 'Implemented JWT-based authentication',
          details: 'Created auth module with login, logout, and token refresh endpoints',
        },
      };

      const devExecutionPromise = executor.execute({
        role: 'developer',
        task: devTask,
        context: db.context.findByFeature(featureId),
      });

      // Simulate Claude response for developer
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(mockDeveloperOutput)));
      mockProcess.emit('exit', 0, null);

      const devResult = await devExecutionPromise;
      expect(devResult.success).toBe(true);

      // Update developer task
      db.tasks.update(devTask.id, {
        status: 'complete',
        completedAt: new Date(),
        output: devResult.output,
      });

      // Update feature status
      db.features.update(featureId, {
        status: 'complete',
      });

      // Step 7: Final progress check
      const finalProgressResponse = await server.handleRequest(progressRequest);
      const finalProgress = (finalProgressResponse.result as any);
      
      expect(finalProgress.features[0].progress).toBe(100);
      expect(finalProgress.features[0].completedTasks).toBe(2);
      expect(finalProgress.summary.completed).toBe(1);
    });
  });

  describe('Error Handling and Retry Flow', () => {
    it('should handle executor failures and track in database', async () => {
      // Create feature
      const feature = db.features.create({
        description: 'Test feature with errors',
        priority: 'normal',
      });

      // Create initial architect task manually (since we're not using manager)
      const task = db.tasks.create({
        featureId: feature.id,
        role: 'architect',
        description: 'Design test feature with errors',
      });

      // Mock failed execution
      const mockSpawn = child_process.spawn as jest.MockedFunction<typeof child_process.spawn>;
      let attemptCount = 0;
      
      mockSpawn.mockImplementation(() => {
        attemptCount++;
        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();

        setTimeout(() => {
          mockProcess.stderr.emit('data', Buffer.from('Execution error'));
          mockProcess.emit('exit', 1, null);
        }, 10);

        return mockProcess;
      });

      // Track attempts
      executor.on('attempt', () => {
        db.tasks.incrementAttempts(task.id);
      });

      // Execute with failure
      const result = await executor.execute({
        role: 'architect',
        task,
        context: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed after 1 attempts');

      // Check task was updated
      const updatedTask = db.tasks.findById(task.id);
      expect(updatedTask?.attempts).toBe(1);

      // Track failure as transition
      db.transitions.create({
        entityType: 'task',
        entityId: task.id.toString(),
        fromState: 'pending',
        toState: 'failed',
        reason: result.error,
        actor: 'system',
      });

      // Query transitions
      const transitions = db.transitions.findByEntity('task', task.id.toString());
      expect(transitions).toHaveLength(1);
      expect(transitions[0].toState).toBe('failed');
    });
  });

  describe('Workflow State Management', () => {
    it('should track feature lifecycle through transitions', async () => {
      // Create feature
      const feature = db.features.create({
        description: 'Feature with full lifecycle',
      });

      // Track creation
      db.transitions.create({
        entityType: 'feature',
        entityId: feature.id,
        toState: 'pending',
        actor: 'user',
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Start work
      db.features.update(feature.id, { status: 'in_progress' });
      db.transitions.create({
        entityType: 'feature',
        entityId: feature.id,
        fromState: 'pending',
        toState: 'in_progress',
        actor: 'system',
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Complete work
      db.features.update(feature.id, { status: 'complete' });
      db.transitions.create({
        entityType: 'feature',
        entityId: feature.id,
        fromState: 'in_progress',
        toState: 'complete',
        actor: 'system',
      });

      // Query feature history
      const transitions = db.transitions.findByEntity('feature', feature.id);
      expect(transitions).toHaveLength(3);
      // Transitions are returned in reverse order (newest first)
      expect(transitions.map(t => t.toState)).toEqual(['complete', 'in_progress', 'pending']);

      // Query via MCP
      const queryRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'queryFeatures',
        params: {
          status: 'complete',
        },
        id: 'test-3',
      };

      const response = await server.handleRequest(queryRequest);
      const features = response.result as any[];
      
      expect(features).toHaveLength(1);
      expect(features[0].status).toBe('complete');
      expect(features[0].completedAt).toBeDefined();
    });
  });

  describe('Pause and Resume Workflow', () => {
    it('should handle pause and resume operations', async () => {
      expect(manager.isPaused()).toBe(false);

      // Pause via MCP
      const pauseRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'pauseWork',
        params: {},
        id: 'test-4',
      };

      const pauseResponse = await server.handleRequest(pauseRequest);
      expect(pauseResponse.error).toBeUndefined();
      expect(manager.isPaused()).toBe(true);

      // Resume via MCP
      const resumeRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'resumeWork',
        params: {},
        id: 'test-5',
      };

      const resumeResponse = await server.handleRequest(resumeRequest);
      expect(resumeResponse.error).toBeUndefined();
      expect(manager.isPaused()).toBe(false);
    });
  });
});