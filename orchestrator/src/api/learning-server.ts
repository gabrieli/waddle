import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase, getDatabase } from '../database/connection.js';
import { getLogger } from '../utils/logger.js';
import { LearningWorker } from '../services/learning-worker.js';
import { createLearningMetricsRouter } from './routes/learning-metrics.js';
import patternRoutes from './routes/patterns.js';
import adrRoutes from './routes/adrs.js';
import reviewRoutes from './routes/reviews.js';
import messageRoutes from './routes/messages.js';
import decisionRoutes from './routes/decisions.js';

const logger = getLogger();

export function createLearningApiServer(learningWorker?: LearningWorker): Express {
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Request logging
  app.use((req, res, next) => {
    logger.info('API request', {
      method: req.method,
      path: req.path,
      query: JSON.stringify(req.query),
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
  
  // Learning metrics routes (if worker provided)
  if (learningWorker) {
    const db = getDatabase();
    if (db) {
      const learningRoutes = createLearningMetricsRouter(db, learningWorker);
      app.use('/api/learning', learningRoutes);
    }
  }
  
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

export function startLearningApiServer(port: number = 3000): void {
  try {
    // Initialize database
    initializeDatabase();
    const db = getDatabase();
    
    if (!db) {
      throw new Error('Failed to initialize database');
    }
    
    // Initialize learning worker
    const learningWorker = new LearningWorker(db, {
      enabled: true,
      extractionInterval: 30 * 60 * 1000, // 30 minutes
      scoringInterval: 60 * 60 * 1000,    // 1 hour
      cleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Start learning worker
    learningWorker.start().then(() => {
      logger.info('Learning worker started');
    }).catch(error => {
      logger.error('Failed to start learning worker', error);
    });
    
    const app = createLearningApiServer(learningWorker);
    
    const server = app.listen(port, () => {
      logger.info('API server started with learning features', { port });
      console.log(`🚀 Knowledge Base API server with learning running on http://localhost:${port}`);
      console.log('');
      console.log('Available endpoints:');
      console.log('  GET  /health                           - Health check');
      console.log('  GET  /api/patterns                     - Search patterns');
      console.log('  GET  /api/patterns/:id                 - Get pattern by ID');
      console.log('  POST /api/patterns/:id/use             - Increment pattern usage');
      console.log('  GET  /api/adrs                         - Search ADRs');
      console.log('  GET  /api/adrs/:id                     - Get ADR by ID');
      console.log('  GET  /api/reviews/work-item/:id        - Get reviews for work item');
      console.log('  GET  /api/messages/agent/:id           - Get messages for agent');
      console.log('  GET  /api/decisions/:id/trace          - Get decision trace');
      console.log('');
      console.log('Learning endpoints:');
      console.log('  GET  /api/learning/status              - Learning system status');
      console.log('  GET  /api/learning/metrics             - Learning metrics');
      console.log('  GET  /api/learning/effectiveness/trends - Pattern effectiveness trends');
      console.log('  GET  /api/learning/categorization/accuracy - Categorization accuracy');
      console.log('  GET  /api/learning/cleanup/stats       - Cleanup statistics');
      console.log('  GET  /api/learning/patterns/growth     - Pattern growth over time');
      console.log('  GET  /api/learning/agents/progress     - Agent learning progress');
      console.log('  GET  /api/learning/patterns/usage-heatmap - Pattern usage heatmap');
      console.log('  GET  /api/learning/insights            - Learning insights');
      console.log('  POST /api/learning/extract             - Trigger pattern extraction (admin)');
      console.log('  POST /api/learning/score               - Trigger effectiveness scoring (admin)');
      console.log('');
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await learningWorker.stop();
      server.close(() => {
        closeDatabase();
        process.exit(0);
      });
    });
    
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await learningWorker.stop();
      server.close(() => {
        closeDatabase();
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start API server', { error: error as Error });
    process.exit(1);
  }
}

// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  startLearningApiServer(port);
}