import { Router, Request, Response } from 'express';
import { getWorkItemHistory, getWorkItem } from '../../database/utils.js';
import { defaultContextManager } from '../../agents/context-manager.js';
import { getPatternsByFilter, getADRsByWorkItem } from '../../database/knowledge.js';

const router = Router();

// GET /api/decisions/:id/trace - Trace decision making process
router.get('/:id/trace', async (req: Request, res: Response) => {
  try {
    const workItemId = req.params.id;
    
    // Verify work item exists
    const workItem = getWorkItem(workItemId);
    if (!workItem) {
      return res.status(404).json({
        success: false,
        error: 'Work item not found'
      });
    }
    
    // Get work item history
    const history = getWorkItemHistory(workItemId);
    
    // Get historical context
    const context = await defaultContextManager.getContextForWorkItem(workItemId);
    
    // Extract decision points
    const decisions = history.filter(h => 
      h.action === 'decision' || 
      (h.action === 'agent_output' && h.content?.includes('decision'))
    ).map(decision => {
      try {
        const content = JSON.parse(decision.content || '{}');
        return {
          timestamp: decision.created_at,
          agent: decision.created_by,
          action: decision.action,
          decision: content.decision || null,
          rationale: content.rationale || null,
          raw_content: decision.content
        };
      } catch {
        return {
          timestamp: decision.created_at,
          agent: decision.created_by,
          action: decision.action,
          decision: null,
          rationale: null,
          raw_content: decision.content
        };
      }
    });
    
    // Get relevant patterns
    const patterns = getPatternsByFilter({
      work_item_ids: [workItemId]
    }).map(p => ({
      id: p.id,
      type: p.pattern_type,
      context: p.context,
      solution: p.solution,
      effectiveness_score: p.effectiveness_score,
      usage_count: p.usage_count
    }));
    
    // Get relevant ADRs
    const adrs = getADRsByWorkItem(workItemId).map(a => ({
      id: a.id,
      title: a.title,
      status: a.status,
      context: a.context,
      decision: a.decision,
      consequences: a.consequences
    }));
    
    // Build response
    const traceData = {
      work_item: {
        id: workItem.id,
        title: workItem.title,
        type: workItem.type,
        status: workItem.status
      },
      decision_timeline: decisions,
      influencing_context: {
        success_patterns: context.successPatterns,
        error_patterns: context.errorPatterns,
        relevant_history_count: context.relevantHistory.length,
        related_items_count: context.relatedItems.length
      },
      patterns_used: patterns,
      architecture_decisions: adrs,
      agent_performance: Array.from(context.agentPerformance.entries()).map(([agent, metrics]) => ({
        agent,
        success_rate: metrics.successRate,
        average_execution_time: metrics.averageExecutionTime,
        common_errors: metrics.commonErrors
      }))
    };
    
    res.json({
      success: true,
      trace: traceData
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/decisions/:id/context - Get full historical context
router.get('/:id/context', async (req: Request, res: Response) => {
  try {
    const workItemId = req.params.id;
    
    // Verify work item exists
    const workItem = getWorkItem(workItemId);
    if (!workItem) {
      return res.status(404).json({
        success: false,
        error: 'Work item not found'
      });
    }
    
    // Get full context
    const context = await defaultContextManager.getContextForWorkItem(workItemId);
    
    // Include history details if requested
    const includeDetails = req.query.include_details === 'true';
    
    const response: any = {
      work_item_id: workItemId,
      relevant_history: includeDetails ? context.relevantHistory : context.relevantHistory.map(h => ({
        timestamp: h.created_at,
        action: h.action,
        agent: h.created_by,
        summary: h.content ? h.content.substring(0, 100) + '...' : null
      })),
      related_items: context.relatedItems.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        priority: item.priority
      })),
      success_patterns: context.successPatterns,
      error_patterns: context.errorPatterns,
      agent_performance: Array.from(context.agentPerformance.entries()).map(([agent, metrics]) => ({
        agent,
        ...metrics
      }))
    };
    
    res.json({
      success: true,
      context: response
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;