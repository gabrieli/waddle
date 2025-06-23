import { Router, Request, Response } from 'express';
import { 
  getPattern, 
  getPatternsByFilter,
  incrementPatternUsage,
  updatePatternEffectiveness 
} from '../../database/knowledge.js';
import { PatternFilter, PatternType } from '../../types/knowledge.js';
import { AgentRole } from '../../types/index.js';
import { accessControl } from '../middleware/access-control.js';

const router = Router();

// GET /api/patterns - Search patterns
router.get('/', (req: Request, res: Response) => {
  try {
    const filter: PatternFilter = {};
    
    // Parse query parameters
    if (req.query.agent_role) {
      filter.agent_role = req.query.agent_role as AgentRole;
    }
    
    if (req.query.pattern_type) {
      filter.pattern_type = req.query.pattern_type as PatternType;
    }
    
    if (req.query.min_score) {
      filter.min_effectiveness_score = parseFloat(req.query.min_score as string);
    }
    
    if (req.query.limit) {
      filter.max_results = parseInt(req.query.limit as string, 10);
    }
    
    // Include embeddings only if explicitly requested
    if (req.query.include_embeddings === 'true') {
      filter.include_embeddings = true;
    }
    
    const patterns = getPatternsByFilter(filter);
    
    // Apply text search if provided
    let results = patterns;
    if (req.query.search) {
      const searchText = (req.query.search as string).toLowerCase();
      results = patterns.filter(pattern => 
        pattern.context.toLowerCase().includes(searchText) ||
        pattern.solution.toLowerCase().includes(searchText) ||
        (pattern.metadata && JSON.stringify(pattern.metadata).toLowerCase().includes(searchText))
      );
    }
    
    // Apply access control filtering
    const userRole = (req as any).userRole || req.headers['x-user-role'] as string;
    const hasApiKey = (req as any).hasValidApiKey || false;
    const filteredResults = accessControl.filterPatterns(results, userRole, hasApiKey);
    
    res.json({
      success: true,
      count: filteredResults.length,
      patterns: filteredResults
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/patterns/:id - Get pattern by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const pattern = getPattern(req.params.id);
    
    if (!pattern) {
      return res.status(404).json({
        success: false,
        error: 'Pattern not found'
      });
    }
    
    // Apply access control for single pattern
    const userRole = (req as any).userRole || req.headers['x-user-role'] as string;
    const hasApiKey = (req as any).hasValidApiKey || false;
    const [filteredPattern] = accessControl.filterPatterns([pattern], userRole, hasApiKey);
    
    res.json({
      success: true,
      pattern: filteredPattern
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/patterns/:id/use - Increment pattern usage
router.post('/:id/use', (req: Request, res: Response) => {
  try {
    const success = incrementPatternUsage(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Pattern not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Pattern usage incremented'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/patterns/:id/effectiveness - Update pattern effectiveness
router.put('/:id/effectiveness', (req: Request, res: Response) => {
  try {
    const { score, increment_usage } = req.body;
    
    if (typeof score !== 'number' || score < 0 || score > 1) {
      return res.status(400).json({
        success: false,
        error: 'Score must be a number between 0 and 1'
      });
    }
    
    const success = updatePatternEffectiveness(
      req.params.id, 
      score, 
      increment_usage !== false
    );
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Pattern not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Pattern effectiveness updated'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/patterns/access/status - Get access control status
router.get('/access/status', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      access_control: accessControl.getStatus()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;