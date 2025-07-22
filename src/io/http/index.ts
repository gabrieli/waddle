// server.js
import express from 'express';
import { getDatabase } from '../db/index.ts';
import { initializeAgentsOnStartup } from '../startup/agent-initialization.ts';
import { createTasksRouter } from './routes/tasks.ts';
import { createTaskService } from '../services/task-service.ts';

// Global scheduler instance
let schedulerInterval = null;

// Scheduler logic - creates tasks directly for processors to handle
const runSchedulerCycle = async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔄 Scheduler: Starting task creation cycle...`);
  
  try {
    const db = getDatabase();
    
    // Update last run time
    db.prepare('UPDATE scheduler_config SET last_run_at = CURRENT_TIMESTAMP WHERE id = 1').run();
    
    // Get work items that need tasks created
    const workItemsNeedingTasks = db.prepare(`
      SELECT wi.id, wi.name, wi.type, wi.status 
      FROM work_items wi
      WHERE wi.status = 'new' 
        AND NOT EXISTS (
          SELECT 1 FROM tasks t 
          WHERE t.user_story_id = wi.id 
            AND t.status IN ('new', 'in_progress')
        )
    `).all();
    
    console.log(`[${timestamp}] 📋 Work items needing tasks: ${workItemsNeedingTasks.length}`, 
      workItemsNeedingTasks.map(w => `${w.type}:${w.id}`));
    
    let tasksCreated = 0;
    
    // Create appropriate tasks for each work item
    for (const workItem of workItemsNeedingTasks) {
      try {
        let taskType = null;
        
        // Determine task type based on work item type and status
        if (workItem.type === 'epic') {
          taskType = 'development'; // Architect work -> development tasks
        } else if (workItem.type === 'user_story' && workItem.status === 'new') {
          taskType = 'development';
        } else if (workItem.type === 'user_story' && workItem.status === 'review') {
          taskType = 'testing';
        }
        
        if (taskType) {
          // Create task directly using task service
          const result = await taskService.createTask({
            type: taskType,
            work_item_id: workItem.id,
            branch_name: `feature/work-item-${workItem.id}`
          });
          
          if (result.success) {
            console.log(`[${timestamp}] ✅ Task created: ${taskType} task ${result.taskId} for ${workItem.type}(${workItem.id}) "${workItem.name}"`);
            tasksCreated++;
          } else {
            console.error(`[${timestamp}] ❌ Task creation failed for ${workItem.type}(${workItem.id}):`, result.error || 'Unknown error');
          }
        }
        
      } catch (error) {
        console.error(`[${timestamp}] ❌ Task creation failed for ${workItem.type}(${workItem.id}):`, error.message);
      }
    }
    
    if (tasksCreated === 0) {
      console.log(`[${timestamp}] 😴 No tasks created - no work items need new tasks`);
    } else {
      console.log(`[${timestamp}] 🎯 Scheduler cycle complete: ${tasksCreated} tasks created`);
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

// Agent management functions (simplified - agents now only used for UI tracking)
const deleteAllAgents = async () => {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM agents').run();
  return { success: true, deletedCount: result.changes };
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

// Serve static files from public directory
app.use(express.static('public'));

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

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

// Legacy agent management endpoint (kept for cleanup only)
app.delete('/api/agents/all', async (req, res) => {
  try {
    const result = await deleteAllAgents();
    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error deleting agents:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Task management API endpoints
const taskService = createTaskService(getDatabase());
const taskRouter = createTasksRouter({ 
  service: taskService, 
  database: getDatabase() 
});
app.use('/api/tasks', taskRouter);

// Work Items API endpoints
import { createWorkItemService } from '../services/work-item-service.ts';
import { createWorkItemsRouter } from './routes/work-items-api.ts';
const workItemService = createWorkItemService(getDatabase());
const workItemRouter = createWorkItemsRouter(workItemService);
app.use('/api/work-items', workItemRouter);

// Agents API endpoints
import { createAgentsRouter } from './routes/agents.ts';
const agentsRouter = createAgentsRouter(getDatabase());
app.use('/api/agents', agentsRouter);

// Scheduler API endpoints
import { createSchedulerRouter } from './routes/scheduler.ts';
const schedulerRouter = createSchedulerRouter(getDatabase(), {
  startScheduler,
  stopScheduler
});
app.use('/api/scheduler', schedulerRouter);

// Branches API endpoints
import { createBranchesRouter } from './routes/branches.ts';
const branchesRouter = createBranchesRouter();
app.use('/api/branches', branchesRouter);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`[${new Date().toISOString()}] Server listening on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Health: http://localhost:${PORT}/health`);
  console.log(`[${new Date().toISOString()}] Commands: http://localhost:${PORT}/commands`);
  
  // Initialize agents on startup (optional - only for UI status tracking)
  try {
    await initializeAgentsOnStartup();
    console.log(`[${new Date().toISOString()}] Agents initialized for status tracking`);
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] Agent initialization skipped (not critical):`, error.message);
    // Agent initialization is no longer critical since processors handle execution
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