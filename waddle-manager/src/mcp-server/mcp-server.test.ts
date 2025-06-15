/**
 * Integration tests for MCP Server
 */

import { MCPServer } from './index';
import { Database } from '../database';
import { WaddleManager } from '../orchestrator';
import type { JSONRPCRequest, JSONRPCResponse } from './types';
import * as fs from 'fs';
import * as http from 'http';
import { io as ioClient, Socket } from 'socket.io-client';

// Helper to make HTTP requests in tests
interface TestResponse {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

async function makeRequest(url: string, options?: RequestInit): Promise<TestResponse> {
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> || {})
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode! >= 200 && res.statusCode! < 300,
          status: res.statusCode!,
          json: async () => JSON.parse(data),
          text: async () => data,
        });
      });
    });

    req.on('error', reject);
    if (options?.body) {
      req.write(options.body);
    }
    req.end();
  });
}

describe('MCPServer', () => {
  let server: MCPServer;
  let db: Database;
  let manager: WaddleManager;
  const testDbPath = './test-mcp-server.db';
  const testPort = 3456;

  beforeEach(async () => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize dependencies
    db = new Database(testDbPath);
    await db.initialize();
    
    manager = new WaddleManager();
    await manager.start();

    // Create server
    server = new MCPServer(db, manager, testPort);
  });

  afterEach(async () => {
    await server.stop();
    await manager.stop();
    await db.close();
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Server lifecycle', () => {
    it('should start and stop correctly', async () => {
      expect(server.isListening()).toBe(false);
      
      await server.start();
      expect(server.isListening()).toBe(true);
      expect(server.getPort()).toBe(testPort);
      
      await server.stop();
      expect(server.isListening()).toBe(false);
    });

    it('should throw error if started twice', async () => {
      await server.start();
      await expect(server.start()).rejects.toThrow('MCP Server is already running');
    });

    it('should handle stop when not running', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe('HTTP endpoints', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should respond to health check', async () => {
      const response = await makeRequest(`http://localhost:${testPort}/health`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toMatchObject({
        status: 'healthy',
        version: '1.0.0',
        uptime: expect.any(Number),
      });
    });

    it('should list available tools', async () => {
      // Add a small delay to ensure server is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await makeRequest(`http://localhost:${testPort}/tools`);
      const tools = await response.json() as Array<{name: string; description: string; parameters: any}>;

      expect(response.ok).toBe(true);
      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBe(6);
      
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('createFeature');
      expect(toolNames).toContain('getProgress');
      expect(toolNames).toContain('queryFeatures');
      expect(toolNames).toContain('pauseWork');
      expect(toolNames).toContain('resumeWork');
      expect(toolNames).toContain('setFeaturePriority');
    });
  });

  describe('JSON-RPC handling', () => {
    it('should handle valid createFeature request', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'createFeature',
        params: {
          description: 'Test feature',
          priority: 'high',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        result: {
          id: expect.any(String),
          message: expect.stringContaining('Feature created successfully'),
        },
        id: 1,
      });
    });

    it('should handle getProgress request', async () => {
      // Create a feature first
      const feature = db.features.create({ description: 'Test feature' });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'getProgress',
        params: {},
        id: 2,
      };

      const response = await server.handleRequest(request);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        result: {
          features: expect.arrayContaining([
            expect.objectContaining({
              id: feature.id,
              description: 'Test feature',
              status: 'pending',
            }),
          ]),
          summary: {
            total: 1,
            pending: 1,
            inProgress: 0,
            completed: 0,
            failed: 0,
          },
        },
        id: 2,
      });
    });

    it('should handle invalid method', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'nonExistentMethod',
        params: {},
        id: 3,
      };

      const response = await server.handleRequest(request);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found: nonExistentMethod',
        },
        id: 3,
      });
    });

    it('should handle invalid parameters', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'createFeature',
        params: {
          // Missing required 'description' field
          priority: 'high',
        },
        id: 4,
      };

      const response = await server.handleRequest(request);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Invalid parameters',
          data: expect.any(Array),
        },
        id: 4,
      });
    });

    it('should handle invalid request format', async () => {
      const response = await server.handleRequest({
        // Missing 'jsonrpc' field
        method: 'createFeature',
        id: 5,
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid request format',
        },
        id: null, // ID is not preserved when request format is invalid
      });
    });

    it('should handle parse error', async () => {
      // Since handleRequest expects parsed JSON, we actually get invalid request
      const response = await server.handleRequest('invalid json');

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32600, // Invalid request, not parse error
          message: 'Invalid request format',
        },
        id: null,
      });
    });
  });

  describe('Tool implementations', () => {
    it('should create feature with task', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'createFeature',
        params: {
          description: 'Build user authentication',
          priority: 'critical',
          metadata: { tags: ['security', 'backend'] },
        },
        id: 'test-1',
      };

      const response = await server.handleRequest(request) as JSONRPCResponse;
      expect(response.error).toBeUndefined();
      
      const featureId = (response.result as any).id;
      const feature = db.features.findById(featureId);
      expect(feature).toBeDefined();
      expect(feature?.priority).toBe('critical');
      expect(feature?.metadata).toEqual({ tags: ['security', 'backend'] });

      // Check that architect task was created
      const tasks = db.tasks.findByFeatureId(featureId);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].role).toBe('architect');
      expect(tasks[0].description).toContain('Design architecture for');
    });

    it('should query features with filters', async () => {
      // Create test features
      db.features.create({ description: 'Feature 1', priority: 'low' });
      db.features.create({ description: 'Feature 2', priority: 'high' });
      db.features.create({ description: 'Feature 3', priority: 'high' });
      const completed = db.features.create({ description: 'Feature 4', priority: 'critical' });
      db.features.update(completed.id, { status: 'complete' });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'queryFeatures',
        params: {
          priority: ['high', 'critical'],
          limit: 10,
        },
        id: 'test-2',
      };

      const response = await server.handleRequest(request) as JSONRPCResponse;
      const features = response.result as any[];
      
      expect(features).toHaveLength(3);
      expect(features.every(f => ['high', 'critical'].includes(f.priority))).toBe(true);
    });

    it('should pause and resume work', async () => {
      expect(manager.isPaused()).toBe(false);

      // Pause
      let request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'pauseWork',
        params: {},
        id: 'test-3',
      };

      let response = await server.handleRequest(request) as JSONRPCResponse;
      expect(response.error).toBeUndefined();
      expect(manager.isPaused()).toBe(true);

      // Resume
      request = {
        jsonrpc: '2.0',
        method: 'resumeWork',
        params: {},
        id: 'test-4',
      };

      response = await server.handleRequest(request) as JSONRPCResponse;
      expect(response.error).toBeUndefined();
      expect(manager.isPaused()).toBe(false);
    });

    it('should update feature priority', async () => {
      const feature = db.features.create({ description: 'Test', priority: 'low' });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'setFeaturePriority',
        params: {
          featureId: feature.id,
          priority: 'critical',
        },
        id: 'test-5',
      };

      const response = await server.handleRequest(request) as JSONRPCResponse;
      const result = response.result as any;
      
      expect(result.oldPriority).toBe('low');
      expect(result.newPriority).toBe('critical');

      const updated = db.features.findById(feature.id);
      expect(updated?.priority).toBe('critical');
    });

    it('should handle feature not found in setFeaturePriority', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'setFeaturePriority',
        params: {
          featureId: '00000000-0000-0000-0000-000000000000',
          priority: 'high',
        },
        id: 'test-6',
      };

      const response = await server.handleRequest(request) as JSONRPCResponse;
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32603);
      expect(response.error?.message).toContain('Feature not found');
    });
  });

  describe('WebSocket support', () => {
    let client: Socket;

    beforeEach(async () => {
      await server.start();
      client = ioClient(`http://localhost:${testPort}`);
      
      // Wait for connection
      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
      });
    });

    afterEach(() => {
      client.disconnect();
    });

    it('should handle RPC over WebSocket', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'createFeature',
        params: {
          description: 'WebSocket test feature',
        },
        id: 'ws-1',
      };

      const response = await new Promise<JSONRPCResponse>((resolve) => {
        client.emit('rpc', request, (response: JSONRPCResponse) => {
          resolve(response);
        });
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        result: {
          id: expect.any(String),
          message: expect.stringContaining('Feature created successfully'),
        },
        id: 'ws-1',
      });
    });

    it('should broadcast system updates', async () => {
      const updatePromise = new Promise((resolve) => {
        client.on('system-update', (update) => {
          resolve(update);
        });
      });

      server.broadcastUpdate({
        type: 'feature-completed',
        featureId: 'test-123',
        timestamp: new Date().toISOString(),
      });

      const update = await updatePromise;
      expect(update).toMatchObject({
        type: 'feature-completed',
        featureId: 'test-123',
      });
    });
  });
});