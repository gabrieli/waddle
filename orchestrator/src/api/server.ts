import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase } from '../database/connection.js';
import { getLogger } from '../utils/logger.js';
import patternRoutes from './routes/patterns.js';
import adrRoutes from './routes/adrs.js';
import reviewRoutes from './routes/reviews.js';
import messageRoutes from './routes/messages.js';
import decisionRoutes from './routes/decisions.js';

const logger = getLogger();

export function createApiServer(): Express {
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Request logging
  app.use((req, res, next) => {
    logger.info('API request', {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip
    });
    next();
  });
  
  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // API routes
  app.use('/api/patterns', patternRoutes);
  app.use('/api/adrs', adrRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/decisions', decisionRoutes);
  
  // Error handling
  app.use((err: any, req: Request, res: Response, next: any) => {
    logger.error('API error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  });
  
  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });
  
  return app;
}

export function startApiServer(port: number = 3000): void {
  try {
    // Initialize database
    initializeDatabase();
    
    const app = createApiServer();
    
    const server = app.listen(port, () => {
      logger.info('API server started', { port });
      console.log(`🚀 Knowledge Base API server running on http://localhost:${port}`);
      console.log('');
      console.log('Available endpoints:');
      console.log('  GET  /health                    - Health check');
      console.log('  GET  /api/patterns              - Search patterns');
      console.log('  GET  /api/patterns/:id          - Get pattern by ID');
      console.log('  POST /api/patterns/:id/use      - Increment pattern usage');
      console.log('  GET  /api/adrs                  - Search ADRs');
      console.log('  GET  /api/adrs/:id              - Get ADR by ID');
      console.log('  GET  /api/reviews/work-item/:id - Get reviews for work item');
      console.log('  GET  /api/messages/agent/:id    - Get messages for agent');
      console.log('  GET  /api/decisions/:id/trace   - Get decision trace');
      console.log('');
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        closeDatabase();
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        closeDatabase();
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start API server', { error });
    process.exit(1);
  }
}

// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  startApiServer(port);
}