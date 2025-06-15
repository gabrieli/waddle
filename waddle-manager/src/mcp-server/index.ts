/**
 * MCP Server implementation for Waddle
 */

import express, { type Express } from 'express';
import { createServer, type Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { Database } from '../database';
import type { WaddleManager } from '../orchestrator';
import { createTools } from './tools';
import type {
  JSONRPCResponse,
  JSONRPCError,
  MCPTool,
} from './types';
import { ErrorCodes } from './types';
import { z } from 'zod';

const JSONRPCRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.unknown().optional(),
  id: z.union([z.string(), z.number(), z.null()]),
});

export class MCPServer {
  private app: Express;
  private httpServer: HTTPServer;
  private io: SocketIOServer;
  private tools: Record<string, MCPTool>;
  private port: number;
  private isRunning = false;

  constructor(
    db: Database,
    manager: WaddleManager,
    port = 3000
  ) {
    this.port = port;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.tools = createTools(db, manager);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        version: '1.0.0',
        uptime: process.uptime(),
      });
    });

    // List available tools
    this.app.get('/tools', (_req, res) => {
      const toolList = Object.entries(this.tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        parameters: tool.parameters,
      }));
      res.json(toolList);
    });

    // Main JSON-RPC endpoint
    this.app.post('/rpc', async (req, res) => {
      const response = await this.handleRequest(req.body);
      res.json(response);
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      // eslint-disable-next-line no-console
      console.log(`Client connected: ${socket.id}`);

      socket.on('rpc', async (request, callback) => {
        const response = await this.handleRequest(request);
        if (callback) {
          callback(response);
        } else {
          socket.emit('rpc-response', response);
        }
      });

      socket.on('disconnect', () => {
        // eslint-disable-next-line no-console
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  async handleRequest(request: unknown): Promise<JSONRPCResponse> {
    let id: string | number | null = null;

    try {
      // Validate request format
      const validatedRequest = JSONRPCRequestSchema.parse(request);
      id = validatedRequest.id;

      // Check if method exists
      const tool = this.tools[validatedRequest.method];
      if (!tool) {
        return this.createErrorResponse(
          id,
          ErrorCodes.METHOD_NOT_FOUND,
          `Method not found: ${validatedRequest.method}`
        );
      }

      // Execute tool handler
      try {
        const result = await tool.handler(validatedRequest.params);
        return {
          jsonrpc: '2.0',
          result,
          id,
        };
      } catch (error) {
        // Handle validation errors
        if (error instanceof z.ZodError) {
          return this.createErrorResponse(
            id,
            ErrorCodes.INVALID_PARAMS,
            'Invalid parameters',
            error.errors
          );
        }

        // Handle other errors
        const message = error instanceof Error ? error.message : 'Unknown error';
        return this.createErrorResponse(
          id,
          ErrorCodes.INTERNAL_ERROR,
          message
        );
      }
    } catch (error) {
      // Handle request parsing errors
      if (error instanceof z.ZodError) {
        return this.createErrorResponse(
          id,
          ErrorCodes.INVALID_REQUEST,
          'Invalid request format',
          error.errors
        );
      }

      return this.createErrorResponse(
        id,
        ErrorCodes.PARSE_ERROR,
        'Parse error'
      );
    }
  }

  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): JSONRPCResponse {
    const error: JSONRPCError = {
      code,
      message,
    };

    if (data !== undefined) {
      error.data = data;
    }

    return {
      jsonrpc: '2.0',
      error,
      id,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('MCP Server is already running');
    }

    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        this.isRunning = true;
        // eslint-disable-next-line no-console
        console.log(`🌐 MCP Server listening on port ${this.port}`);
        // eslint-disable-next-line no-console
        console.log(`   HTTP: http://localhost:${this.port}`);
        // eslint-disable-next-line no-console
        console.log(`   WebSocket: ws://localhost:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      this.io.close(() => {
        this.httpServer.close(() => {
          this.isRunning = false;
          // eslint-disable-next-line no-console
          console.log('🌐 MCP Server stopped');
          resolve();
        });
      });
    });
  }

  getPort(): number {
    return this.port;
  }

  isListening(): boolean {
    return this.isRunning;
  }

  // Broadcast system updates to all connected clients
  broadcastUpdate(update: unknown): void {
    this.io.emit('system-update', update);
  }
}