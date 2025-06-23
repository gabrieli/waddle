import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger();

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        email?: string;
      };
    }
  }
}

/**
 * Simple authentication middleware.
 * In production, this would validate JWT tokens or session cookies.
 * For now, we'll use a simple API key approach.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Check for API key in header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    
    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }
    
    // Simple API key validation (in production, check against database)
    if (apiKey === process.env.API_KEY || apiKey === 'dev-api-key') {
      // Attach user info to request
      req.user = {
        id: 'system',
        role: 'admin'
      };
      next();
    } else {
      res.status(401).json({ error: 'Invalid API key' });
    }
  } catch (error) {
    logger.error('Auth middleware error', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware to check if user has admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Optional authentication middleware - allows unauthenticated access
 * but attaches user info if authenticated
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    
    if (apiKey && (apiKey === process.env.API_KEY || apiKey === 'dev-api-key')) {
      req.user = {
        id: 'system',
        role: 'admin'
      };
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}