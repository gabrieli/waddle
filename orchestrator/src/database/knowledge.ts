import { getDatabase } from './connection.js';
import { generateId, executeQuery } from './utils.js';
import { getLogger } from '../utils/logger.js';
import {
  Pattern,
  ADR,
  Review,
  AgentCommunication,
  PatternCreateParams,
  PatternFilter,
  ADRCreateParams,
  ReviewCreateParams,
  MessageCreateParams,
  PatternMetadata,
  ADRStatus,
  MessageStatus
} from '../types/knowledge.js';
import { AgentRole } from '../types/index.js';

const logger = getLogger();

// Pattern functions

export function createPattern(params: PatternCreateParams): Pattern {
  const db = getDatabase();
  const id = generateId('PATTERN');
  
  const query = `
    INSERT INTO patterns (
      id, agent_role, pattern_type, context, solution, 
      effectiveness_score, work_item_ids, metadata, embedding
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const workItemIds = params.work_item_ids ? params.work_item_ids.join(',') : null;
  const metadata = params.metadata ? JSON.stringify(params.metadata) : null;
  
  const queryParams = [
    id,
    params.agent_role,
    params.pattern_type,
    params.context,
    params.solution,
    params.effectiveness_score || 0.0,
    workItemIds,
    metadata,
    params.embedding || null
  ];
  
  executeQuery(
    'createPattern',
    query,
    queryParams,
    () => db.prepare(query).run(...queryParams),
    { patternId: id, agent_role: params.agent_role, pattern_type: params.pattern_type }
  );
  
  logger.info('Pattern created', { 
    patternId: id, 
    agent_role: params.agent_role, 
    pattern_type: params.pattern_type 
  });
  
  return getPattern(id)!;
}

export function getPattern(id: string): Pattern | null {
  const db = getDatabase();
  
  const query = `
    SELECT * FROM patterns WHERE id = ?
  `;
  const params = [id];
  
  return executeQuery(
    'getPattern',
    query,
    params,
    () => db.prepare(query).get(...params) as Pattern | null,
    { patternId: id }
  );
}

export function getPatternsByFilter(filter: PatternFilter): Pattern[] {
  const db = getDatabase();
  
  let query = `
    SELECT * FROM patterns
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (filter.agent_role) {
    query += ` AND agent_role = ?`;
    params.push(filter.agent_role);
  }
  
  if (filter.pattern_type) {
    query += ` AND pattern_type = ?`;
    params.push(filter.pattern_type);
  }
  
  if (filter.min_effectiveness_score !== undefined) {
    query += ` AND effectiveness_score >= ?`;
    params.push(filter.min_effectiveness_score);
  }
  
  // Order by effectiveness score descending
  query += ` ORDER BY effectiveness_score DESC, usage_count DESC`;
  
  if (filter.max_results) {
    query += ` LIMIT ?`;
    params.push(filter.max_results);
  }
  
  const patterns = executeQuery(
    'getPatternsByFilter',
    query,
    params,
    () => db.prepare(query).all(...params) as Pattern[],
    { filter }
  );
  
  // Remove embeddings if not requested
  if (!filter.include_embeddings) {
    patterns.forEach(pattern => {
      pattern.embedding = null;
    });
  }
  
  return patterns;
}

export function updatePatternEffectiveness(
  id: string, 
  newScore: number, 
  incrementUsage: boolean = true
): boolean {
  const db = getDatabase();
  
  let query = `
    UPDATE patterns
    SET effectiveness_score = ?,
        updated_at = CURRENT_TIMESTAMP
  `;
  const params: any[] = [newScore];
  
  if (incrementUsage) {
    query += `, usage_count = usage_count + 1`;
  }
  
  query += ` WHERE id = ?`;
  params.push(id);
  
  const result = executeQuery(
    'updatePatternEffectiveness',
    query,
    params,
    () => db.prepare(query).run(...params),
    { patternId: id, newScore, incrementUsage }
  );
  
  if (result.changes > 0) {
    logger.info('Pattern effectiveness updated', { 
      patternId: id, 
      newScore, 
      incrementUsage 
    });
    return true;
  }
  
  return false;
}

export function incrementPatternUsage(id: string): boolean {
  const db = getDatabase();
  
  const query = `
    UPDATE patterns
    SET usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [id];
  
  const result = executeQuery(
    'incrementPatternUsage',
    query,
    params,
    () => db.prepare(query).run(...params),
    { patternId: id }
  );
  
  return result.changes > 0;
}

// ADR functions

export function createADR(params: ADRCreateParams): ADR {
  const db = getDatabase();
  const id = generateId('ADR');
  
  const query = `
    INSERT INTO adrs (
      id, title, context, decision, consequences, 
      status, work_item_id, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const queryParams = [
    id,
    params.title,
    params.context,
    params.decision,
    params.consequences || null,
    params.status || 'proposed',
    params.work_item_id || null,
    params.created_by
  ];
  
  executeQuery(
    'createADR',
    query,
    queryParams,
    () => db.prepare(query).run(...queryParams),
    { adrId: id, title: params.title, status: params.status || 'proposed' }
  );
  
  logger.info('ADR created', { 
    adrId: id, 
    title: params.title, 
    status: params.status || 'proposed',
    created_by: params.created_by 
  });
  
  return getADR(id)!;
}

export function getADR(id: string): ADR | null {
  const db = getDatabase();
  
  const query = `
    SELECT * FROM adrs WHERE id = ?
  `;
  const params = [id];
  
  return executeQuery(
    'getADR',
    query,
    params,
    () => db.prepare(query).get(...params) as ADR | null,
    { adrId: id }
  );
}

export function getADRsByStatus(status: ADRStatus): ADR[] {
  const db = getDatabase();
  
  const query = `
    SELECT * FROM adrs
    WHERE status = ?
    ORDER BY created_at DESC
  `;
  const params = [status];
  
  return executeQuery(
    'getADRsByStatus',
    query,
    params,
    () => db.prepare(query).all(...params) as ADR[],
    { status }
  );
}

export function getADRsByWorkItem(workItemId: string): ADR[] {
  const db = getDatabase();
  
  const query = `
    SELECT * FROM adrs
    WHERE work_item_id = ?
    ORDER BY created_at DESC
  `;
  const params = [workItemId];
  
  return executeQuery(
    'getADRsByWorkItem',
    query,
    params,
    () => db.prepare(query).all(...params) as ADR[],
    { workItemId }
  );
}

export function updateADRStatus(id: string, status: ADRStatus, supersededBy?: string): boolean {
  const db = getDatabase();
  
  const query = `
    UPDATE adrs
    SET status = ?,
        superseded_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [status, supersededBy || null, id];
  
  const result = executeQuery(
    'updateADRStatus',
    query,
    params,
    () => db.prepare(query).run(...params),
    { adrId: id, status, supersededBy }
  );
  
  if (result.changes > 0) {
    logger.info('ADR status updated', { adrId: id, status, supersededBy });
    return true;
  }
  
  return false;
}

// Review functions

export function createReview(params: ReviewCreateParams): Review {
  const db = getDatabase();
  const id = generateId('REVIEW');
  
  const query = `
    INSERT INTO reviews (
      id, work_item_id, reviewer_role, review_type, 
      status, feedback, suggestions, quality_score
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const queryParams = [
    id,
    params.work_item_id,
    params.reviewer_role,
    params.review_type,
    params.status,
    params.feedback,
    params.suggestions || null,
    params.quality_score || null
  ];
  
  executeQuery(
    'createReview',
    query,
    queryParams,
    () => db.prepare(query).run(...queryParams),
    { 
      reviewId: id, 
      workItemId: params.work_item_id, 
      reviewType: params.review_type,
      status: params.status 
    }
  );
  
  logger.info('Review created', { 
    reviewId: id, 
    workItemId: params.work_item_id,
    reviewType: params.review_type,
    status: params.status,
    reviewer: params.reviewer_role 
  });
  
  return getReview(id)!;
}

export function getReview(id: string): Review | null {
  const db = getDatabase();
  
  const query = `
    SELECT * FROM reviews WHERE id = ?
  `;
  const params = [id];
  
  return executeQuery(
    'getReview',
    query,
    params,
    () => db.prepare(query).get(...params) as Review | null,
    { reviewId: id }
  );
}

export function getReviewsByWorkItem(workItemId: string): Review[] {
  const db = getDatabase();
  
  const query = `
    SELECT * FROM reviews
    WHERE work_item_id = ?
    ORDER BY created_at DESC
  `;
  const params = [workItemId];
  
  return executeQuery(
    'getReviewsByWorkItem',
    query,
    params,
    () => db.prepare(query).all(...params) as Review[],
    { workItemId }
  );
}

export function getReviewsByStatus(status: string): Review[] {
  const db = getDatabase();
  
  const query = `
    SELECT * FROM reviews
    WHERE status = ?
    ORDER BY created_at DESC
  `;
  const params = [status];
  
  return executeQuery(
    'getReviewsByStatus',
    query,
    params,
    () => db.prepare(query).all(...params) as Review[],
    { status }
  );
}

// Agent communication functions

export function sendMessage(params: MessageCreateParams): AgentCommunication {
  const db = getDatabase();
  const id = generateId('MSG');
  
  const query = `
    INSERT INTO agent_communications (
      id, from_agent, to_agent, message_type, 
      subject, content, work_item_id, priority
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const queryParams = [
    id,
    params.from_agent,
    params.to_agent,
    params.message_type,
    params.subject,
    params.content,
    params.work_item_id || null,
    params.priority || 'medium'
  ];
  
  executeQuery(
    'sendMessage',
    query,
    queryParams,
    () => db.prepare(query).run(...queryParams),
    { 
      messageId: id, 
      from: params.from_agent, 
      to: params.to_agent,
      type: params.message_type 
    }
  );
  
  logger.info('Message sent', { 
    messageId: id, 
    from: params.from_agent,
    to: params.to_agent,
    subject: params.subject,
    priority: params.priority || 'medium' 
  });
  
  return getMessage(id)!;
}

export function getMessage(id: string): AgentCommunication | null {
  const db = getDatabase();
  
  const query = `
    SELECT * FROM agent_communications WHERE id = ?
  `;
  const params = [id];
  
  return executeQuery(
    'getMessage',
    query,
    params,
    () => db.prepare(query).get(...params) as AgentCommunication | null,
    { messageId: id }
  );
}

export function getMessagesForAgent(agentId: string, status?: MessageStatus): AgentCommunication[] {
  const db = getDatabase();
  
  let query = `
    SELECT * FROM agent_communications
    WHERE to_agent = ?
  `;
  const params: any[] = [agentId];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY 
    CASE priority 
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    created_at ASC
  `;
  
  return executeQuery(
    'getMessagesForAgent',
    query,
    params,
    () => db.prepare(query).all(...params) as AgentCommunication[],
    { agentId, status }
  );
}

export function updateMessageStatus(
  id: string, 
  status: MessageStatus,
  timestampField?: 'delivered_at' | 'read_at' | 'processed_at'
): boolean {
  const db = getDatabase();
  
  let query = `
    UPDATE agent_communications
    SET status = ?
  `;
  const params: any[] = [status];
  
  if (timestampField) {
    query += `, ${timestampField} = CURRENT_TIMESTAMP`;
  }
  
  query += ` WHERE id = ?`;
  params.push(id);
  
  const result = executeQuery(
    'updateMessageStatus',
    query,
    params,
    () => db.prepare(query).run(...params),
    { messageId: id, status, timestampField }
  );
  
  if (result.changes > 0) {
    logger.info('Message status updated', { messageId: id, status });
    return true;
  }
  
  return false;
}

export function markMessageAsDelivered(id: string): boolean {
  return updateMessageStatus(id, 'delivered', 'delivered_at');
}

export function getUndeliveredMessages(agentId: string): AgentCommunication[] {
  return getMessagesForAgent(agentId, 'pending');
}

export function supersedeADR(oldAdrId: string, newAdrId: string): boolean {
  const db = getDatabase();
  
  // First, update the old ADR
  const updateOld = updateADRStatus(oldAdrId, 'superseded', newAdrId);
  
  if (!updateOld) {
    return false;
  }
  
  // Then, ensure the new ADR is accepted
  const updateNew = updateADRStatus(newAdrId, 'accepted');
  
  if (!updateNew) {
    // Rollback the old ADR update if the new one fails
    updateADRStatus(oldAdrId, 'accepted');
    return false;
  }
  
  logger.info('ADR superseded', { oldAdrId, newAdrId });
  return true;
}