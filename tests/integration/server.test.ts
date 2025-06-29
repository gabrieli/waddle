import net from 'net';
import { WaddleServer } from '../../src/server';
import { DatabaseConnection } from '../../src/database/connection';
import { v4 as uuidv4 } from 'uuid';

describe('Waddle Server Integration Tests', () => {
  let server: WaddleServer;
  let client: net.Socket;
  let db: DatabaseConnection;
  const TEST_PORT = 8766; // Different port for tests

  beforeAll(() => {
    process.env.WADDLE_ENV = 'test';
    process.env.WADDLE_PORT = TEST_PORT.toString();
    process.env.NODE_ENV = 'test';
  });

  beforeEach((done) => {
    // Start the server
    server = new WaddleServer();
    server.start();
    
    // Create database connection for test setup
    db = new DatabaseConnection('test');
    
    // Clean up test data
    db.getDatabase().exec('DELETE FROM work_history');
    db.getDatabase().exec('DELETE FROM agents');
    db.getDatabase().exec('DELETE FROM work_items');
    
    // Give server time to start
    setTimeout(() => {
      client = new net.Socket();
      client.connect(TEST_PORT, 'localhost', done);
    }, 100);
  });

  afterEach((done) => {
    client.destroy();
    db.close();
    
    // Shutdown server
    server.shutdown();
    setTimeout(done, 500);
  });

  const sendCommand = (command: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      let response = '';
      
      const onData = (data: Buffer) => {
        response += data.toString();
        try {
          const result = JSON.parse(response);
          client.removeListener('data', onData);
          resolve(result);
        } catch (e) {
          // Not complete JSON yet, wait for more data
        }
      };
      
      client.on('data', onData);
      client.on('error', reject);
      
      client.write(command + '\n');
    });
  };

  test('should respond to ping command', async () => {
    const response = await sendCommand('ping');
    
    expect(response.success).toBe(true);
    expect(response.result).toBe('pong');
  });

  test('should get system status', async () => {
    const response = await sendCommand('status');
    
    expect(response.success).toBe(true);
    expect(response.result).toHaveProperty('work_items');
    expect(response.result).toHaveProperty('active_agents');
    expect(response.result.environment).toBe('test');
  });

  test('should assign developer to work item', async () => {
    // Create a test work item
    const workItemId = uuidv4();
    const stmt = db.getDatabase().prepare(`
      INSERT INTO work_items (id, type, title, description, status, assigned_role)
      VALUES (?, 'task', 'Test Task', 'Test description', 'ready', 'developer')
    `);
    stmt.run(workItemId);
    
    const response = await sendCommand(`developer:assign ${workItemId}`);
    
    expect(response.success).toBe(true);
    expect(response.result.message).toContain('Developer agent assigned');
    expect(response.result.workItem.title).toBe('Test Task');
  });

  test('should handle invalid work item', async () => {
    const response = await sendCommand('developer:assign invalid-id');
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('not found');
  });

  test('should get developer status', async () => {
    const response = await sendCommand('developer:status');
    
    expect(response.success).toBe(true);
    expect(response.result).toHaveProperty('active_developers');
    expect(response.result).toHaveProperty('idle_developers');
    expect(Array.isArray(response.result.active_developers)).toBe(true);
    expect(Array.isArray(response.result.idle_developers)).toBe(true);
  });

  test('should handle unknown command', async () => {
    const response = await sendCommand('unknown:command');
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('Unknown command');
  });

  test('should handle multiple concurrent clients', async () => {
    const client2 = new net.Socket();
    
    await new Promise((resolve) => {
      client2.connect(TEST_PORT, 'localhost', resolve as any);
    });
    
    // Send commands from both clients
    const [response1, response2] = await Promise.all([
      sendCommand('ping'),
      new Promise((resolve) => {
        let response = '';
        client2.on('data', (data) => {
          response += data.toString();
          try {
            resolve(JSON.parse(response));
          } catch (e) {
            // Wait for complete response
          }
        });
        client2.write('status\n');
      })
    ]);
    
    expect(response1.success).toBe(true);
    expect((response2 as any).success).toBe(true);
    
    client2.destroy();
  });
});