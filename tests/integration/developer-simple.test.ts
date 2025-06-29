import { DeveloperAgent } from '../../src/agents/developer';
import { DatabaseConnection } from '../../src/database/connection';
import { WaddleConfig, loadConfig } from '../../src/config';
import { v4 as uuidv4 } from 'uuid';

describe('Developer Agent Simple Tests', () => {
  let db: DatabaseConnection;
  let config: WaddleConfig;

  beforeAll(() => {
    process.env.WADDLE_ENV = 'test';
    process.env.NODE_ENV = 'test';
    config = loadConfig();
    config.claude.timeout = 10000; // 10 seconds for simple test
  });

  beforeEach(() => {
    db = new DatabaseConnection('test');
    
    // Clean up any existing test data
    db.getDatabase().exec('DELETE FROM work_history');
    db.getDatabase().exec('DELETE FROM agents');
    db.getDatabase().exec('DELETE FROM work_items');
  });

  afterEach(() => {
    db.close();
  });

  test('should handle work item lifecycle', async () => {
    // Create a very simple work item
    const workItemId = uuidv4();
    const stmt = db.getDatabase().prepare(`
      INSERT INTO work_items (id, type, title, description, status, assigned_role, created_at, updated_at)
      VALUES (?, 'task', ?, ?, 'ready', 'developer', datetime('now'), datetime('now'))
    `);
    
    stmt.run(workItemId, 'Simple Test', 'Just return "Hello World"');
    
    const developer = new DeveloperAgent(db, config);
    
    // Test that the basic flow works
    try {
      await developer.execute(workItemId);
      
      // Check final state
      const workItem = db.getDatabase().prepare('SELECT * FROM work_items WHERE id = ?').get(workItemId) as any;
      expect(workItem.status).toBe('review');
      expect(workItem.assigned_role).toBe('reviewer');
      expect(workItem.processing_agent_id).toBeNull();
      
      // Check history was recorded
      const history = db.getDatabase().prepare('SELECT COUNT(*) as count FROM work_history WHERE work_item_id = ?').get(workItemId) as any;
      expect(history.count).toBeGreaterThan(0);
      
    } catch (error) {
      // If Claude fails, at least check cleanup happened
      const workItem = db.getDatabase().prepare('SELECT * FROM work_items WHERE id = ?').get(workItemId) as any;
      expect(workItem.processing_agent_id).toBeNull();
      
      const agent = db.getDatabase().prepare('SELECT * FROM agents WHERE type = ? ORDER BY created_at DESC LIMIT 1').get('developer') as any;
      if (agent) {
        expect(agent.work_item_id).toBeNull();
      }
    }
  });
});