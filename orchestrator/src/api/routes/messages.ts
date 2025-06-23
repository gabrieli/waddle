import { Router, Request, Response } from 'express';
import { 
  sendMessage,
  getMessagesForAgent,
  markMessageAsDelivered,
  getUndeliveredMessages
} from '../../database/knowledge.js';
import { MessageType, MessagePriority } from '../../types/knowledge.js';
import { AgentRole } from '../../types/index.js';

const router = Router();

// GET /api/messages - Get messages for an agent
router.get('/', (req: Request, res: Response) => {
  try {
    const { agent, undelivered_only, work_item, priority, type, limit } = req.query;
    
    if (!agent) {
      return res.status(400).json({
        success: false,
        error: 'agent parameter is required'
      });
    }
    
    let messages = [];
    
    if (undelivered_only === 'true') {
      messages = getUndeliveredMessages(agent as string);
    } else {
      messages = getMessagesForAgent(agent as string);
    }
    
    // Apply filters
    if (work_item) {
      messages = messages.filter(m => m.work_item_id === work_item);
    }
    
    if (priority) {
      messages = messages.filter(m => m.priority === priority);
    }
    
    if (type) {
      messages = messages.filter(m => m.message_type === type);
    }
    
    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit as string, 10);
      messages = messages.slice(0, limitNum);
    }
    
    res.json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/messages - Send a new message
router.post('/', (req: Request, res: Response) => {
  try {
    const { 
      from_agent, 
      to_agent, 
      message_type, 
      priority, 
      subject, 
      content, 
      metadata,
      work_item_id 
    } = req.body;
    
    // Validate required fields
    if (!from_agent || !to_agent || !message_type || !priority || !subject || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from_agent, to_agent, message_type, priority, subject, content'
      });
    }
    
    // Validate message type
    const validTypes: MessageType[] = ['question', 'insight', 'warning', 'handoff'];
    if (!validTypes.includes(message_type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid message_type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    // Validate priority
    const validPriorities: MessagePriority[] = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
      });
    }
    
    const message = sendMessage({
      from_agent: from_agent as AgentRole,
      to_agent: to_agent as AgentRole,
      message_type,
      priority,
      subject,
      content,
      metadata,
      work_item_id
    });
    
    res.status(201).json({
      success: true,
      message_id: message.id
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/messages/:id/delivered - Mark message as delivered
router.put('/:id/delivered', (req: Request, res: Response) => {
  try {
    const success = markMessageAsDelivered(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Message marked as delivered'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/messages/agent/:agent/unread - Get undelivered message count
router.get('/agent/:agent/unread', (req: Request, res: Response) => {
  try {
    const messages = getUndeliveredMessages(req.params.agent);
    
    const byPriority = messages.reduce((acc, msg) => {
      acc[msg.priority] = (acc[msg.priority] || 0) + 1;
      return acc;
    }, {} as Record<MessagePriority, number>);
    
    res.json({
      success: true,
      total_unread: messages.length,
      by_priority: byPriority,
      urgent_count: byPriority.urgent || 0,
      high_count: byPriority.high || 0
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/messages/metrics - Get communication metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { agent, period } = req.query;
    const { messageService } = await import('../../services/messaging.js');
    
    // Get metrics for all agents or specific agent
    const agents = agent ? [agent as string] : ['manager', 'architect', 'developer', 'reviewer', 'bug-buster'];
    const metrics: Record<string, any> = {};
    
    for (const agentRole of agents) {
      const stats = await messageService.getMessageStats(agentRole);
      metrics[agentRole] = stats;
    }
    
    // Add overall communication patterns
    const db = await import('../../database/connection.js').then(m => m.getDatabase());
    const communicationPatterns = db.prepare(`
      SELECT 
        from_agent,
        to_agent,
        message_type,
        COUNT(*) as count,
        AVG(CASE 
          WHEN processed_at IS NOT NULL AND delivered_at IS NOT NULL 
          THEN (julianday(processed_at) - julianday(delivered_at)) * 24 * 60 * 60 * 1000
          ELSE NULL 
        END) as avg_processing_time_ms
      FROM agent_communications
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY from_agent, to_agent, message_type
      ORDER BY count DESC
    `).all();
    
    // Get dead letter queue health
    const deadLetterHealth = db.prepare(`
      SELECT 
        to_agent,
        COUNT(*) as dead_letter_count,
        MAX(last_retry_at) as latest_failure
      FROM agent_communications
      WHERE is_dead_letter = 1
      GROUP BY to_agent
    `).all();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      agentMetrics: metrics,
      communicationPatterns,
      deadLetterHealth,
      summary: {
        totalAgents: agents.length,
        totalMessages: Object.values(metrics).reduce((sum: number, m: any) => 
          sum + m.pending + m.delivered + m.processed + m.failed, 0),
        totalDeadLetters: Object.values(metrics).reduce((sum: number, m: any) => 
          sum + m.deadLetter, 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/messages/broadcast - Send message to multiple agents
router.post('/broadcast', (req: Request, res: Response) => {
  try {
    const { 
      from_agent, 
      to_agents, 
      message_type, 
      priority, 
      subject, 
      content, 
      metadata,
      work_item_id 
    } = req.body;
    
    // Validate required fields
    if (!from_agent || !to_agents || !Array.isArray(to_agents) || to_agents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'from_agent and to_agents (array) are required'
      });
    }
    
    if (!message_type || !priority || !subject || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: message_type, priority, subject, content'
      });
    }
    
    const messageIds = [];
    
    // Send message to each agent
    for (const to_agent of to_agents) {
      const message = sendMessage({
        from_agent: from_agent as AgentRole,
        to_agent: to_agent as AgentRole,
        message_type: message_type as MessageType,
        priority: priority as MessagePriority,
        subject,
        content,
        metadata,
        work_item_id
      });
      messageIds.push({ agent: to_agent, message_id: message.id });
    }
    
    res.status(201).json({
      success: true,
      messages_sent: messageIds.length,
      message_ids: messageIds
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/messages/dead-letter - Get dead letter queue messages
router.get('/dead-letter', async (req: Request, res: Response) => {
  try {
    const { agent } = req.query;
    const { messageService } = await import('../../services/messaging.js');
    
    const messages = await messageService.getDeadLetterMessages(agent as string | undefined);
    
    res.json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/messages/:id/resurrect - Resurrect a message from dead letter queue
router.post('/:id/resurrect', async (req: Request, res: Response) => {
  try {
    const { messageService } = await import('../../services/messaging.js');
    
    const success = await messageService.resurrectMessage(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Message not found in dead letter queue'
      });
    }
    
    res.json({
      success: true,
      message: 'Message resurrected from dead letter queue'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/messages/dead-letter/cleanup - Clean up old dead letter messages
router.delete('/dead-letter/cleanup', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const { messageService } = await import('../../services/messaging.js');
    
    const daysOld = days ? parseInt(days as string, 10) : 30;
    const deletedCount = await messageService.cleanupDeadLetterQueue(daysOld);
    
    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} dead letter messages older than ${daysOld} days`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;