import { Router, Request, Response } from 'express';
import { 
  createADR,
  getADR,
  getADRsByStatus,
  getADRsByWorkItem,
  updateADRStatus,
  supersedeADR
} from '../../database/knowledge.js';
import { ADRStatus } from '../../types/knowledge.js';
import { AgentRole } from '../../types/index.js';

const router = Router();

// GET /api/adrs - Search ADRs
router.get('/', (req: Request, res: Response) => {
  try {
    let adrs = [];
    
    if (req.query.work_item) {
      adrs = getADRsByWorkItem(req.query.work_item as string);
    } else if (req.query.status) {
      adrs = getADRsByStatus(req.query.status as ADRStatus);
    } else {
      // Get all ADRs by querying each status
      const statuses: ADRStatus[] = ['proposed', 'accepted', 'deprecated', 'superseded'];
      adrs = statuses.flatMap(status => getADRsByStatus(status));
    }
    
    // Apply text search if provided
    if (req.query.search) {
      const searchText = (req.query.search as string).toLowerCase();
      adrs = adrs.filter(adr =>
        adr.title.toLowerCase().includes(searchText) ||
        adr.context.toLowerCase().includes(searchText) ||
        adr.decision.toLowerCase().includes(searchText) ||
        (adr.consequences && adr.consequences.toLowerCase().includes(searchText))
      );
    }
    
    // Apply limit if provided
    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string, 10);
      adrs = adrs.slice(0, limit);
    }
    
    res.json({
      success: true,
      count: adrs.length,
      adrs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/adrs/:id - Get ADR by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const adr = getADR(req.params.id);
    
    if (!adr) {
      return res.status(404).json({
        success: false,
        error: 'ADR not found'
      });
    }
    
    res.json({
      success: true,
      adr
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/adrs - Create new ADR
router.post('/', (req: Request, res: Response) => {
  try {
    const { title, context, decision, consequences, created_by, work_item_id } = req.body;
    
    // Validate required fields
    if (!title || !context || !decision || !created_by) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, context, decision, created_by'
      });
    }
    
    const adr = createADR({
      title,
      context,
      decision,
      consequences,
      status: 'proposed',
      created_by: created_by as AgentRole,
      work_item_id
    });
    
    res.status(201).json({
      success: true,
      adr
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/adrs/:id/status - Update ADR status
router.put('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    const validStatuses: ADRStatus[] = ['proposed', 'accepted', 'deprecated', 'superseded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const success = updateADRStatus(req.params.id, status);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'ADR not found'
      });
    }
    
    const adr = getADR(req.params.id);
    
    res.json({
      success: true,
      adr
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/adrs/:id/supersede - Supersede ADR with a new one
router.post('/:id/supersede', (req: Request, res: Response) => {
  try {
    const { new_adr_id } = req.body;
    
    if (!new_adr_id) {
      return res.status(400).json({
        success: false,
        error: 'new_adr_id is required'
      });
    }
    
    const success = supersedeADR(req.params.id, new_adr_id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'ADR not found or new ADR not found'
      });
    }
    
    const oldAdr = getADR(req.params.id);
    const newAdr = getADR(new_adr_id);
    
    res.json({
      success: true,
      old_adr: oldAdr,
      new_adr: newAdr
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;