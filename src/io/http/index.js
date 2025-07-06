// server.js
import express from 'express';
import { getDatabase } from '../db/index.ts';
import { initializeAgentsOnStartup } from '../startup/agent-initialization.ts';

// Global scheduler instance
let schedulerInterval = null;

// Scheduler logic with comprehensive logging
const runSchedulerCycle = async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔄 Scheduler: Starting assignment cycle...`);
  
  try {
    const db = getDatabase();
    
    // Update last run time
    db.prepare('UPDATE scheduler_config SET last_run_at = CURRENT_TIMESTAMP WHERE id = 1').run();
    
    // 1. Get available agents (those without work_item_id)
    const availableAgents = db.prepare('SELECT id, type FROM agents WHERE work_item_id IS NULL').all();
    console.log(`[${timestamp}] 👥 Available agents: ${availableAgents.length}`, 
      availableAgents.map(a => `${a.type}(${a.id})`));
    
    // 2. Get assignable work items
    const assignableWork = db.prepare(`
      SELECT id, name, type, status 
      FROM work_items 
      WHERE status = 'new' AND agent_id IS NULL
    `).all();
    console.log(`[${timestamp}] 📋 Assignable work: ${assignableWork.length}`, 
      assignableWork.map(w => `${w.type}:${w.id}`));
    
    let assignments = 0;
    
    // 3. Assignment rules and matching
    for (const agent of availableAgents) {
      // Find work that matches this agent type
      let workItem = null;
      
      if (agent.type === 'architect') {
        workItem = assignableWork.find(w => w.type === 'epic' && w.status === 'new');
      } else if (agent.type === 'developer') {
        workItem = assignableWork.find(w => w.type === 'user_story' && w.status === 'new');
      } else if (agent.type === 'tester') {
        workItem = assignableWork.find(w => w.type === 'user_story' && w.status === 'review');
      }
      
      if (workItem) {
        // Make assignment
        try {
          db.prepare(`
            UPDATE work_items 
            SET agent_id = ?, status = 'in_progress', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(agent.id, workItem.id);
          
          db.prepare(`
            UPDATE agents 
            SET work_item_id = ?, version = version + 1
            WHERE id = ?
          `).run(workItem.id, agent.id);
          
          console.log(`[${timestamp}] ✅ Assignment: ${agent.type}(${agent.id}) ← ${workItem.type}(${workItem.id}) "${workItem.name}"`);
          assignments++;
          
          // Remove from available lists to prevent double assignment
          const agentIndex = availableAgents.findIndex(a => a.id === agent.id);
          if (agentIndex > -1) availableAgents.splice(agentIndex, 1);
          
          const workIndex = assignableWork.findIndex(w => w.id === workItem.id);
          if (workIndex > -1) assignableWork.splice(workIndex, 1);
          
        } catch (error) {
          console.error(`[${timestamp}] ❌ Assignment failed: ${agent.type}(${agent.id}) ← ${workItem.type}(${workItem.id}):`, error.message);
        }
      }
    }
    
    if (assignments === 0) {
      console.log(`[${timestamp}] 😴 No assignments made - no matching work/agents available`);
    } else {
      console.log(`[${timestamp}] 🎯 Scheduler cycle complete: ${assignments} assignments made`);
    }
    
  } catch (error) {
    console.error(`[${timestamp}] ❌ Scheduler error:`, error.message);
  }
};

const startScheduler = () => {
  if (schedulerInterval) {
    console.log(`[${new Date().toISOString()}] ⚠️  Scheduler already running`);
    return false;
  }
  
  console.log(`[${new Date().toISOString()}] 🚀 Starting scheduler (5 second intervals)`);
  schedulerInterval = setInterval(runSchedulerCycle, 5000);
  
  // Run immediately
  runSchedulerCycle();
  return true;
};

const stopScheduler = () => {
  if (!schedulerInterval) {
    console.log(`[${new Date().toISOString()}] ⚠️  Scheduler not running`);
    return false;
  }
  
  clearInterval(schedulerInterval);
  schedulerInterval = null;
  console.log(`[${new Date().toISOString()}] 🛑 Scheduler stopped`);
  return true;
};

// Command handlers as pure functions
const getStatus = async () => ({
  status: 'running',
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  timestamp: new Date().toISOString(),
  pid: process.pid
});

const processData = async (data) => {
  // Simulate async processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    processed: true,
    dataLength: data?.length || 0,
    result: `Processed: ${data}`,
    timestamp: new Date().toISOString()
  };
};

const restart = async (service = 'default') => {
  console.log(`[${new Date().toISOString()}] Restarting service: ${service}`);
  return { 
    restarting: service, 
    timestamp: new Date().toISOString(),
    message: `Service ${service} restart initiated`
  };
};

const echo = async (message) => ({
  message: message || 'No message provided'
});

const calculate = async (operation, a, b) => {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  
  if (isNaN(numA) || isNaN(numB)) {
    throw new Error('Invalid numbers provided');
  }

  const operations = {
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    multiply: (a, b) => a * b,
    divide: (a, b) => {
      if (b === 0) throw new Error('Division by zero');
      return a / b;
    }
  };

  const op = operations[operation];
  if (!op) throw new Error(`Unknown operation: ${operation}`);

  return { 
    result: op(numA, numB), 
    operation, 
    a: numA, 
    b: numB 
  };
};

const listItems = async (type = 'all') => {
  const items = {
    users: ['alice', 'bob', 'charlie'],
    services: ['auth', 'api', 'database'],
    tasks: ['backup', 'cleanup', 'sync']
  };

  if (type === 'all') return items;
  return { [type]: items[type] || [] };
};

// Agent management functions
const deleteAllAgents = async () => {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM agents').run();
  return { success: true, deletedCount: result.changes };
};

const createAgent = async (agentData) => {
  const db = getDatabase();
  const { type } = agentData;
  
  if (!['developer', 'architect', 'tester'].includes(type)) {
    throw new Error(`Invalid agent type: ${type}`);
  }
  
  const stmt = db.prepare(`
    INSERT INTO agents (type, version) 
    VALUES (?, 1)
  `);
  
  const result = stmt.run(type);
  return { success: true, id: result.lastInsertRowid };
};

const clearWorkItemAssignments = async () => {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE work_items 
    SET agent_id = NULL, started_at = NULL 
    WHERE agent_id IS NOT NULL OR started_at IS NOT NULL
  `);
  
  const result = stmt.run();
  return { success: true, updatedCount: result.changes };
};

// Command registry
const commands = {
  status: () => getStatus(),
  process: ({ data }) => processData(data),
  restart: ({ service }) => restart(service),
  echo: ({ message }) => echo(message),
  calculate: ({ operation, a, b }) => calculate(operation, a, b),
  list: ({ type }) => listItems(type)
};

// Main command executor
const executeCommand = async (command, args = {}) => {
  console.log(`[${new Date().toISOString()}] Executing: ${command}`, args);
  
  const handler = commands[command];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }
  
  return handler(args);
};

// Express setup
const app = express();
app.use(express.json());

// Logging middleware
const logRequest = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
};

app.use(logRequest);

// Routes
app.post('/command/:cmd', async (req, res) => {
  try {
    const result = await executeCommand(req.params.cmd, req.body);
    res.json({ success: true, result });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    healthy: true, 
    uptime: process.uptime(),
    timestamp: new Date().toISOString() 
  });
});

app.get('/commands', (req, res) => {
  res.json({
    availableCommands: Object.keys(commands).map(name => ({
      name,
      endpoint: `POST /command/${name}`
    }))
  });
});

// Agent management API endpoints
app.delete('/api/agents', async (req, res) => {
  try {
    const result = await deleteAllAgents();
    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error deleting agents:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/agents', async (req, res) => {
  try {
    const result = await createAgent(req.body);
    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error creating agent:`, error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.patch('/api/work-items/assignments', async (req, res) => {
  try {
    const result = await clearWorkItemAssignments();
    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error clearing work item assignments:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scheduler endpoints that actually control the scheduler
app.get('/api/scheduler/status', async (req, res) => {
  try {
    const db = getDatabase();
    const config = db.prepare('SELECT is_running, interval_seconds, last_run_at FROM scheduler_config WHERE id = 1').get();
    res.json({ 
      success: true, 
      result: {
        isRunning: Boolean(config.is_running),
        intervalSeconds: config.interval_seconds,
        lastRunAt: config.last_run_at
      }
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error getting scheduler status:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scheduler/start', async (req, res) => {
  try {
    const db = getDatabase();
    const started = startScheduler();
    if (started) {
      db.prepare('UPDATE scheduler_config SET is_running = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
      console.log(`[${new Date().toISOString()}] 🚀 Scheduler started via API`);
      res.json({ success: true, result: true });
    } else {
      res.json({ success: true, result: false, message: 'Scheduler already running' });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error starting scheduler:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scheduler/stop', async (req, res) => {
  try {
    const db = getDatabase();
    const stopped = stopScheduler();
    if (stopped) {
      db.prepare('UPDATE scheduler_config SET is_running = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
      console.log(`[${new Date().toISOString()}] 🛑 Scheduler stopped via API`);
      res.json({ success: true, result: true });
    } else {
      res.json({ success: true, result: false, message: 'Scheduler not running' });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error stopping scheduler:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`[${new Date().toISOString()}] Server listening on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Health: http://localhost:${PORT}/health`);
  console.log(`[${new Date().toISOString()}] Commands: http://localhost:${PORT}/commands`);
  
  // Initialize agents on startup
  try {
    await initializeAgentsOnStartup();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to initialize agents:`, error.message);
    // Don't exit the server, but log the error
  }
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n[${new Date().toISOString()}] ${signal} received, shutting down...`);
  
  // Stop scheduler if running
  if (schedulerInterval) {
    stopScheduler();
    const db = getDatabase();
    db.prepare('UPDATE scheduler_config SET is_running = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
  }
  
  server.close(() => {
    console.log(`[${new Date().toISOString()}] Server closed`);
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));