import { DeveloperAgent } from '../../src/agents/developer';
import { DatabaseConnection } from '../../src/database/connection';
import { WaddleConfig, loadConfig } from '../../src/config';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

describe('Developer Agent Integration Tests', () => {
  let db: DatabaseConnection;
  let config: WaddleConfig;
  let testWorkItemId: string;

  beforeAll(() => {
    // Ensure we're in test environment
    process.env.WADDLE_ENV = 'test';
    config = loadConfig();
    config.claude.timeout = 35000; // 35 seconds to allow for 30 second test execution
  });

  beforeEach(() => {
    // Create fresh database connection for each test
    db = new DatabaseConnection('test');
    
    // Clean up any existing test data
    db.getDatabase().exec('DELETE FROM work_history');
    db.getDatabase().exec('DELETE FROM agents');
    db.getDatabase().exec('DELETE FROM work_items');
    
    // Create a test work item
    testWorkItemId = uuidv4();
    const stmt = db.getDatabase().prepare(`
      INSERT INTO work_items (id, type, title, description, status, assigned_role, created_at, updated_at)
      VALUES (?, 'task', ?, ?, 'ready', 'developer', datetime('now'), datetime('now'))
    `);
    
    stmt.run(testWorkItemId, 'Test Task', 'Create a simple hello world function');
  });

  afterEach(() => {
    // Clean up data but don't close the database yet
    db.getDatabase().exec('DELETE FROM work_history');
    db.getDatabase().exec('DELETE FROM agents');
    db.getDatabase().exec('DELETE FROM work_items');
  });

  afterAll(() => {
    // Close database after all tests
    db.close();
  });

  test('should register agent and lock work item', async () => {
    const developer = new DeveloperAgent(db, config);
    
    // Start execution in background
    const executionPromise = developer.execute(testWorkItemId);
    
    // Give it a moment to register and lock
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check agent is registered - get the specific agent instance
    const agentStmt = db.getDatabase().prepare('SELECT * FROM agents WHERE type = ? ORDER BY created_at DESC LIMIT 1');
    const agent = agentStmt.get('developer') as any;
    expect(agent).toBeDefined();
    expect(agent.work_item_id).toBe(testWorkItemId);
    
    // Check work item is locked
    const workItemStmt = db.getDatabase().prepare('SELECT * FROM work_items WHERE id = ?');
    const workItem = workItemStmt.get(testWorkItemId) as any;
    expect(workItem.processing_agent_id).toBe(agent.id);
    expect(workItem.status).toBe('in_progress');
    
    // Cancel execution to clean up
    await executionPromise.catch(() => {}); // Ignore errors for this test
  });

  test('should execute claude and update work item status', async () => {
    const developer = new DeveloperAgent(db, config);
    
    // Execute the work item
    await developer.execute(testWorkItemId);
    
    // Check work item status is updated to review
    const workItemStmt = db.getDatabase().prepare('SELECT * FROM work_items WHERE id = ?');
    const workItem = workItemStmt.get(testWorkItemId) as any;
    expect(workItem.status).toBe('review');
    expect(workItem.assigned_role).toBe('reviewer');
    expect(workItem.processing_agent_id).toBeNull();
    
    // Check work history
    const historyStmt = db.getDatabase().prepare('SELECT * FROM work_history WHERE work_item_id = ? ORDER BY created_at');
    const history = historyStmt.all(testWorkItemId) as any[];
    
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].action).toBe('developer_started');
    expect(history[history.length - 1].action).toBe('developer_completed');
    
    // Check agent is unassigned
    const agentStmt = db.getDatabase().prepare('SELECT * FROM agents WHERE type = ?');
    const agent = agentStmt.get('developer') as any;
    expect(agent.work_item_id).toBeNull();
  }, 40000); // 40 second timeout

  test('should handle claude execution failure', async () => {
    const developer = new DeveloperAgent(db, config);
    
    // Use invalid work item to trigger error
    const invalidWorkItemId = uuidv4();
    
    await expect(developer.execute(invalidWorkItemId)).rejects.toThrow('Work item');
    
    // Check no agent is left assigned
    const agentStmt = db.getDatabase().prepare('SELECT * FROM agents WHERE work_item_id IS NOT NULL');
    const agents = agentStmt.all();
    expect(agents.length).toBe(0);
  });

  test('should clean up locks on error', async () => {
    // Create a config with very short timeout to force error
    const errorConfig = { ...config };
    errorConfig.claude.timeout = 100; // 100ms timeout
    
    const developer = new DeveloperAgent(db, errorConfig);
    
    try {
      await developer.execute(testWorkItemId);
    } catch (error) {
      // Expected to fail
    }
    
    // Check work item is unlocked
    const workItemStmt = db.getDatabase().prepare('SELECT * FROM work_items WHERE id = ?');
    const workItem = workItemStmt.get(testWorkItemId) as any;
    expect(workItem.processing_agent_id).toBeNull();
    
    // Check agent is unassigned
    const agentStmt = db.getDatabase().prepare('SELECT * FROM agents WHERE type = ?');
    const agent = agentStmt.get('developer') as any;
    expect(agent.work_item_id).toBeNull();
    
    // Check failure is logged in history
    const historyStmt = db.getDatabase().prepare('SELECT * FROM work_history WHERE work_item_id = ? AND action = ?');
    const failureHistory = historyStmt.get(testWorkItemId, 'developer_failed');
    expect(failureHistory).toBeDefined();
  });

  test('should use ROLE_DEVELOPER instructions', async () => {
    const developer = new DeveloperAgent(db, config);
    
    // Spy on the prompt building
    const buildPromptSpy = jest.spyOn(developer as any, 'buildPrompt');
    
    await developer.execute(testWorkItemId);
    
    expect(buildPromptSpy).toHaveBeenCalled();
    const prompt = buildPromptSpy.mock.results[0].value;
    
    // Check that prompt includes role instructions
    expect(prompt).toContain('Quality Principle');
    expect(prompt).toContain('Core Values');
    expect(prompt).toContain('Test First');
  }, 40000);
});