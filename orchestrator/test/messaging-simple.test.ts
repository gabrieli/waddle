import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA } from '../src/database/schema.js';

describe('Messaging System - Simple Tests', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');
    
    // Create schema
    Object.entries(SCHEMA).forEach(([name, sql]) => {
      if (name !== 'indices' && typeof sql === 'string') {
        db.prepare(sql).run();
      }
    });
    
    // Create indexes
    if (SCHEMA.indices && Array.isArray(SCHEMA.indices)) {
      SCHEMA.indices.forEach((sql: string) => {
        db.prepare(sql).run();
      });
    }
  });

  afterEach(() => {
    db.close();
  });

  it('should create and retrieve a message', () => {
    // Insert a message
    const insertStmt = db.prepare(`
      INSERT INTO agent_communications (
        id, from_agent, to_agent, message_type, 
        subject, content, priority, status,
        retry_count, is_dead_letter
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const messageId = 'MSG-TEST-001';
    insertStmt.run(
      messageId,
      'manager',
      'developer',
      'question',
      'Test Question',
      'Can you help?',
      'medium',
      'pending',
      0,
      0
    );
    
    // Retrieve the message
    const selectStmt = db.prepare('SELECT * FROM agent_communications WHERE id = ?');
    const message = selectStmt.get(messageId) as any;
    
    expect(message).toBeDefined();
    expect(message.id).toBe(messageId);
    expect(message.from_agent).toBe('manager');
    expect(message.to_agent).toBe('developer');
    expect(message.message_type).toBe('question');
    expect(message.status).toBe('pending');
    expect(message.retry_count).toBe(0);
    expect(message.is_dead_letter).toBe(0);
  });

  it('should support all message types', () => {
    const messageTypes = ['question', 'insight', 'warning', 'handoff'];
    const insertStmt = db.prepare(`
      INSERT INTO agent_communications (
        id, from_agent, to_agent, message_type, 
        subject, content, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    messageTypes.forEach((type, index) => {
      insertStmt.run(
        `MSG-${type}-${index}`,
        'architect',
        'developer',
        type,
        `Test ${type}`,
        `Content for ${type}`,
        'high'
      );
    });
    
    // Verify all were inserted
    const count = db.prepare('SELECT COUNT(*) as count FROM agent_communications').get() as any;
    expect(count.count).toBe(4);
    
    // Verify each type
    messageTypes.forEach(type => {
      const msg = db.prepare(
        'SELECT * FROM agent_communications WHERE message_type = ?'
      ).get(type) as any;
      expect(msg).toBeDefined();
      expect(msg.message_type).toBe(type);
    });
  });

  it('should handle message status transitions', () => {
    const messageId = 'MSG-STATUS-TEST';
    
    // Insert message
    db.prepare(`
      INSERT INTO agent_communications (
        id, from_agent, to_agent, message_type, 
        subject, content, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      messageId,
      'developer',
      'reviewer',
      'handoff',
      'Code Review',
      'Please review',
      'urgent'
    );
    
    // Update to delivered
    db.prepare(`
      UPDATE agent_communications 
      SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(messageId);
    
    let message = db.prepare('SELECT * FROM agent_communications WHERE id = ?').get(messageId) as any;
    expect(message.status).toBe('delivered');
    expect(message.delivered_at).not.toBeNull();
    
    // Update to processed
    db.prepare(`
      UPDATE agent_communications 
      SET status = 'processed', processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(messageId);
    
    message = db.prepare('SELECT * FROM agent_communications WHERE id = ?').get(messageId) as any;
    expect(message.status).toBe('processed');
    expect(message.processed_at).not.toBeNull();
  });

  it('should handle dead letter queue', () => {
    const messageId = 'MSG-DLQ-TEST';
    
    // Insert failed message
    db.prepare(`
      INSERT INTO agent_communications (
        id, from_agent, to_agent, message_type, 
        subject, content, priority, status,
        retry_count, is_dead_letter, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      messageId,
      'manager',
      'architect',
      'warning',
      'System Issue',
      'Database is down',
      'urgent',
      'failed',
      3,
      1,
      'Max retries exceeded'
    );
    
    // Query dead letter messages
    const deadLetters = db.prepare(
      'SELECT * FROM agent_communications WHERE is_dead_letter = 1'
    ).all() as any[];
    
    expect(deadLetters.length).toBe(1);
    expect(deadLetters[0].id).toBe(messageId);
    expect(deadLetters[0].retry_count).toBe(3);
    expect(deadLetters[0].error_message).toBe('Max retries exceeded');
  });

  it('should filter messages by priority', () => {
    const priorities = ['low', 'medium', 'high', 'urgent'];
    const insertStmt = db.prepare(`
      INSERT INTO agent_communications (
        id, from_agent, to_agent, message_type, 
        subject, content, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    priorities.forEach((priority, index) => {
      insertStmt.run(
        `MSG-PRI-${index}`,
        'developer',
        'manager',
        'insight',
        `Priority ${priority}`,
        'Update',
        priority
      );
    });
    
    // Get high and urgent only
    const highPriorityMessages = db.prepare(`
      SELECT * FROM agent_communications 
      WHERE priority IN ('high', 'urgent')
      ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
        END
    `).all() as any[];
    
    expect(highPriorityMessages.length).toBe(2);
    expect(highPriorityMessages[0].priority).toBe('urgent');
    expect(highPriorityMessages[1].priority).toBe('high');
  });

  it('should track communication patterns', () => {
    // Insert various messages to create patterns
    const patterns = [
      { from: 'manager', to: 'architect', type: 'question', count: 3 },
      { from: 'architect', to: 'developer', type: 'insight', count: 5 },
      { from: 'developer', to: 'reviewer', type: 'handoff', count: 2 },
      { from: 'reviewer', to: 'developer', type: 'warning', count: 4 }
    ];
    
    const insertStmt = db.prepare(`
      INSERT INTO agent_communications (
        id, from_agent, to_agent, message_type, 
        subject, content, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    let id = 0;
    patterns.forEach(pattern => {
      for (let i = 0; i < pattern.count; i++) {
        insertStmt.run(
          `MSG-PATTERN-${id++}`,
          pattern.from,
          pattern.to,
          pattern.type,
          'Subject',
          'Content',
          'medium'
        );
      }
    });
    
    // Query communication patterns
    const queryResult = db.prepare(`
      SELECT 
        from_agent,
        to_agent,
        message_type,
        COUNT(*) as count
      FROM agent_communications
      GROUP BY from_agent, to_agent, message_type
      ORDER BY count DESC
    `).all() as any[];
    
    expect(queryResult.length).toBe(4);
    expect(queryResult[0].count).toBe(5); // architect -> developer insight
    expect(queryResult[0].from_agent).toBe('architect');
    expect(queryResult[0].to_agent).toBe('developer');
    expect(queryResult[0].message_type).toBe('insight');
  });
});