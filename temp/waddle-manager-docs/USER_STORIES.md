# User Stories - Waddle Implementation

## Progress Tracker

### Phase 1 - Foundation
- [x] Story 1: Core Infrastructure Setup
- [x] Story 2: SQLite Database Layer

### Phase 2 - Core Engine
- [x] Story 3: MCP Server Implementation
- [x] Story 4: Headless Claude Executor (Still used for architect/reviewer)
- [x] Story 11: Hybrid Claude Executor (Architecture Update)
- [x] Story 12: Task Completion MCP Tools
- [ ] Story 5: Autonomous Orchestrator Engine

### Phase 3 - User Interface
- [ ] Story 6: Web Dashboard UI
- [ ] Story 7: CLI Interface and Packaging

### Phase 4 - Production Ready
- [ ] Story 8: Testing and Documentation
- [ ] Story 9: npm Publishing Pipeline
- [ ] Story 10: Example Project and Templates

---

## Story 1: Core Infrastructure Setup

**Status**: ✅ Completed

**As a** developer  
**I want** a well-structured TypeScript project with all necessary dependencies  
**So that** I can build the Waddle with modern tooling

### Acceptance Criteria
- [x] TypeScript project initialized with strict mode
- [x] Dependencies installed: express, better-sqlite3, commander, winston
- [x] Build system configured with tsup
- [x] Jest testing framework configured
- [x] ESLint and Prettier configured
- [x] Basic project structure created

### Technical Details
```
@waddle.run/mcp/
├── src/
│   ├── orchestrator/
│   │   ├── index.ts
│   │   ├── autonomous-loop.ts
│   │   └── ai-reasoner.ts
│   ├── mcp-server/
│   │   ├── index.ts
│   │   ├── tools.ts
│   │   └── handlers.ts
│   ├── database/
│   │   ├── index.ts
│   │   ├── migrations/
│   │   └── repositories/
│   ├── executor/
│   │   ├── index.ts
│   │   ├── headless-claude.ts
│   │   └── role-prompts.ts
│   ├── web-ui/
│   │   ├── server.ts
│   │   └── client/
│   ├── cli/
│   │   └── index.ts
│   └── index.ts
├── tests/
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
└── README.md
```

### Implementation Notes
```bash
# Commands to run
npm init -y
npm install -D typescript @types/node @types/express
npm install express better-sqlite3 commander winston
npm install -D jest @types/jest ts-jest
npm install -D eslint prettier @typescript-eslint/parser
npm install -D tsup
```

---

## Story 2: SQLite Database Layer

**Status**: ✅ Completed

**As a** system  
**I want** a persistent database to track features, tasks, and context  
**So that** work progress and history are maintained across restarts

### Acceptance Criteria
- [x] Database schema implemented with migrations
- [x] Repository pattern for data access
- [x] CRUD operations for features, tasks, transitions
- [x] Context storage for architecture docs and reviews
- [x] Transaction support for state changes
- [x] Database initialization on first run
- [x] Unit tests for all repository methods

### Technical Details
```typescript
// src/database/schema.ts
interface Feature {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

// src/database/repositories/feature-repository.ts
class FeatureRepository {
  create(feature: CreateFeatureDto): Promise<Feature>
  findById(id: string): Promise<Feature | null>
  findAll(filter?: FeatureFilter): Promise<Feature[]>
  update(id: string, updates: UpdateFeatureDto): Promise<Feature>
  delete(id: string): Promise<void>
}
```

### Implementation Notes
- Use better-sqlite3 for synchronous operations
- Implement migrations with version tracking
- Add indexes for frequently queried fields
- Include transaction helpers
- Create seed data for testing

---

## Story 3: MCP Server Implementation

**Status**: ✅ Completed

**As a** Claude Code user  
**I want** MCP tools to interact with Waddle  
**So that** I can create features and monitor progress

### Acceptance Criteria
- [x] MCP server running on configurable port (default 3000)
- [x] Tools implemented: createFeature, getProgress, queryFeatures
- [x] Additional tools: pauseWork, resumeWork, setFeaturePriority
- [x] JSON-RPC 2.0 protocol compliance
- [x] Error handling with proper error codes
- [x] Request validation with clear error messages
- [x] Integration tests with mock Claude Code client

### Technical Details
```typescript
// src/mcp-server/tools.ts
export const tools = {
  createFeature: {
    description: "Create a new feature for autonomous development",
    parameters: {
      description: { type: 'string', required: true },
      priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] }
    },
    handler: async (params) => {
      // Implementation
    }
  },
  // ... other tools
}

// src/mcp-server/index.ts
class MCPServer {
  private server: http.Server;
  
  start(port: number): Promise<void>
  stop(): Promise<void>
  handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse>
}
```

### Implementation Notes
- Follow MCP specification exactly
- Implement request/response logging
- Add health check endpoint
- Support both HTTP and WebSocket transports
- Include example client code

---

## Story 4: Headless Claude Executor

**Status**: ✅ Completed

**As a** manager system  
**I want** to spawn headless Claude instances with specific contexts  
**So that** tasks are completed autonomously

### Acceptance Criteria
- [x] Spawn Claude with -p flag and appropriate tools
- [x] Role-based prompt templates (architect, developer, reviewer)
- [x] Context injection from database
- [x] Output parsing for both text and JSON formats
- [x] Error handling for process failures
- [x] Retry logic with exponential backoff
- [x] Process timeout management
- [x] Resource cleanup on failure

### Technical Details
```typescript
// src/executor/headless-claude.ts
interface ExecutionRequest {
  task: Task;
  role: 'architect' | 'developer' | 'reviewer';
  context: Context[];
  timeout?: number;
}

class HeadlessClaudeExecutor {
  async execute(request: ExecutionRequest): Promise<ExecutionResult>
  private buildPrompt(request: ExecutionRequest): string
  private spawnClaude(prompt: string, tools: string[]): Promise<string>
  private parseOutput(output: string): ExecutionResult
}

// src/executor/role-prompts.ts
export const rolePrompts = {
  architect: {
    system: "You are a technical architect...",
    tools: ['Read', 'Write', 'Edit', 'WebSearch'],
    outputFormat: 'json'
  },
  // ... other roles
}
```

### Implementation Notes
- Use child_process.spawn for better control
- Stream output for large responses
- Implement kill switch for runaway processes
- Log all executions for debugging
- Handle Claude not being installed gracefully

---

## Story 5: Autonomous Orchestrator Engine

**Status**: ⬜ Not Started

**As a** system  
**I want** intelligent work orchestration  
**So that** features progress automatically through development phases

### Acceptance Criteria
- [ ] Continuous loop checking for pending work
- [ ] AI-powered decision making for task routing
- [ ] State transition validation with business rules
- [ ] Deadlock detection and automatic resolution
- [ ] Configurable work velocity and concurrency
- [ ] Graceful shutdown with state preservation
- [ ] Pause/resume functionality
- [ ] Performance metrics collection

### Technical Details
```typescript
// src/orchestrator/autonomous-loop.ts
class AutonomousOrchestrator {
  private running: boolean = false;
  private paused: boolean = false;
  
  async start(): Promise<void>
  async stop(): Promise<void>
  async pause(): Promise<void>
  async resume(): Promise<void>
  
  private async runCycle(): Promise<void>
  private async selectNextTask(): Promise<Task | null>
  private async executeTask(task: Task): Promise<void>
  private async handleTaskCompletion(task: Task, result: ExecutionResult): Promise<void>
}

// src/orchestrator/ai-reasoner.ts
class AIReasoner {
  async analyzeStuckWork(feature: Feature): Promise<Resolution>
  async determineNextPhase(feature: Feature): Promise<Phase>
  async detectDeadlock(features: Feature[]): Promise<Deadlock[]>
}
```

### Implementation Notes
- Use async/await with proper error boundaries
- Implement circuit breaker for external calls
- Add jitter to prevent thundering herd
- Use event emitter for status updates
- Include dry-run mode for testing

---

## Story 6: Web Dashboard UI

**Status**: ⬜ Not Started

**As a** user  
**I want** a web interface to monitor Waddle  
**So that** I can see progress and intervene if needed

### Acceptance Criteria
- [ ] Dashboard showing active features with progress bars
- [ ] Real-time updates via WebSocket/Server-Sent Events
- [ ] Feature pipeline visualization (Kanban board style)
- [ ] Manual controls (pause, resume, reprioritize)
- [ ] Task history and logs viewer
- [ ] System health indicators
- [ ] Responsive design for mobile
- [ ] No authentication required (local use)

### Technical Details
```typescript
// src/web-ui/client/App.tsx
const Dashboard = () => {
  return (
    <div>
      <SystemStatus />
      <ActiveFeatures />
      <PipelineView />
      <ControlPanel />
      <LogViewer />
    </div>
  )
}

// src/web-ui/server.ts
class WebUIServer {
  private app: Express;
  private wsServer: WebSocket.Server;
  
  start(port: number): Promise<void>
  broadcastUpdate(update: SystemUpdate): void
  handleWebSocket(ws: WebSocket): void
}
```

### Implementation Notes
- Use React + TypeScript + Vite
- Implement with Tailwind CSS for styling
- Add Chart.js for metrics visualization
- Use Socket.io for real-time updates
- Include export functionality for reports

---

## Story 7: CLI Interface and Packaging

**Status**: ⬜ Not Started

**As a** developer  
**I want** a simple CLI to start and manage Waddle  
**So that** I can easily use it in any project

### Acceptance Criteria
- [ ] CLI with commands: start, stop, status, config, logs
- [ ] Global npm package configuration with bin entry
- [ ] Daemon mode support with process management
- [ ] Configuration file support (waddle.config.json)
- [ ] Environment variable overrides
- [ ] Helpful error messages and validation
- [ ] Auto-completion support
- [ ] Version and help commands

### Technical Details
```typescript
// src/cli/index.ts
#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('waddle')
  .description('AI development team that waddles so your projects can run 🐧')
  .version('1.0.0');

program
  .command('start')
  .option('-d, --daemon', 'Run in background')
  .option('-p, --port <port>', 'MCP server port', '3000')
  .action(async (options) => {
    // Implementation
  });

// package.json
{
  "bin": {
    "waddle": "./bin/waddle.js"
  }
}
```

### Implementation Notes
- Use commander.js for CLI parsing
- Implement with node-windows/node-mac/node-linux for daemon
- Add PID file management
- Include log rotation
- Support multiple instances with different configs

---

## Story 8: Testing and Documentation

**Status**: ⬜ Not Started

**As a** open source user  
**I want** comprehensive tests and documentation  
**So that** I can trust and understand the system

### Acceptance Criteria
- [ ] Unit tests for all components (>80% coverage)
- [ ] Integration tests for complete workflows
- [ ] End-to-end test with mock Claude
- [ ] Performance tests for concurrent operations
- [ ] README with quick start guide and badges
- [ ] API documentation with examples
- [ ] Architecture diagrams (Mermaid)
- [ ] Troubleshooting guide
- [ ] Contributing guidelines

### Technical Details
```typescript
// tests/integration/workflow.test.ts
describe('Complete Feature Workflow', () => {
  it('should complete a feature from creation to deployment', async () => {
    // Create feature via MCP
    // Wait for architecture phase
    // Verify developer phase starts
    // Simulate review feedback
    // Verify completion
  });
});

// tests/mocks/claude-mock.ts
class ClaudeMock {
  constructor(private responses: Map<string, string>) {}
  
  spawn(args: string[]): ChildProcess {
    // Return mock process with predetermined responses
  }
}
```

### Implementation Notes
- Use Jest for all testing
- Create test fixtures for database
- Mock external dependencies
- Add GitHub Actions for CI
- Generate coverage reports

---

## Story 9: npm Publishing Pipeline

**Status**: ⬜ Not Started

**As a** maintainer  
**I want** automated publishing to npm  
**So that** releases are consistent and reliable

### Acceptance Criteria
- [ ] GitHub Actions workflow for CI/CD
- [ ] Automated tests on every PR
- [ ] Semantic versioning with conventional commits
- [ ] Automated changelog generation
- [ ] npm publish on release tag
- [ ] GitHub release creation with assets
- [ ] Security scanning (npm audit)
- [ ] Package size optimization

### Technical Details
```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Implementation Notes
- Use semantic-release for automation
- Add .npmignore for package optimization
- Include prepublishOnly script
- Test package installation locally
- Add npm badge to README

---

## Story 10: Example Project and Templates

**Status**: ⬜ Not Started

**As a** new user  
**I want** example configurations and templates  
**So that** I can quickly start using Waddle

### Acceptance Criteria
- [ ] Example waddle.config.json with all options documented
- [ ] Role prompt templates for common scenarios
- [ ] Sample feature requests (CRUD app, API endpoint, etc.)
- [ ] Quick start video/gif in README
- [ ] Integration examples with popular frameworks
- [ ] Best practices guide
- [ ] Performance tuning guide
- [ ] Example of custom role creation

### Technical Details
```
examples/
├── basic-setup/
│   ├── waddle.config.json
│   └── README.md
├── custom-roles/
│   ├── prompts/
│   └── README.md
├── integrations/
│   ├── nextjs/
│   ├── express/
│   └── nestjs/
└── features/
    ├── crud-api.json
    ├── auth-system.json
    └── data-pipeline.json
```

### Implementation Notes
- Create realistic examples
- Test each example thoroughly
- Include expected outputs
- Add screenshots to docs
- Create asciinema recordings

---

---

## Story 11: Hybrid Claude Executor (Architecture Update)

**Status**: ✅ Completed

**As a** manager system  
**I want** to use a hybrid approach with interactive Claude for developers and headless for architects/reviewers  
**So that** each role gets the appropriate execution environment for their needs

### Acceptance Criteria
- [x] Keep headless executor for architect and reviewer roles
- [x] Create interactive executor for developer role only
- [x] Route tasks to appropriate executor based on role
- [x] Pass task context via initial prompt for interactive mode
- [x] Monitor Claude process output for completion detection
- [x] Parse task output from MCP tool calls
- [x] Clean process termination after task completion
- [x] Handle timeouts for long-running tasks
- [x] Support for multiple concurrent Claude instances

### Technical Details
```typescript
// src/executor/hybrid-executor.ts
class HybridClaudeExecutor {
  private headlessExecutor: HeadlessClaudeExecutor;
  private interactiveExecutor: InteractiveClaudeExecutor;
  
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // Use interactive mode only for developer role
    if (request.role === 'developer') {
      return this.interactiveExecutor.execute(request);
    }
    
    // Use headless mode for architect and reviewer roles
    return this.headlessExecutor.execute(request);
  }
}

// src/executor/interactive-claude.ts
class InteractiveClaudeExecutor {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const prompt = this.buildInteractivePrompt(request);
    const process = spawn('claude', ['code', prompt]);
    
    // Monitor output for completion tool call
    const result = await this.waitForCompletion(process, request.timeout);
    
    // Terminate Claude instance
    await this.cleanTermination(process);
    
    return result;
  }
  
  private buildInteractivePrompt(request: ExecutionRequest): string {
    return `You are working on task #${request.task.id} for feature "${request.feature.description}".
    
    Role: ${request.role}
    Task: ${request.task.description}
    
    Context:
    ${request.context.map(c => c.content).join('\n\n')}
    
    Instructions:
    1. Complete the task using all available tools
    2. When finished, call the 'reportTaskCompletion' MCP tool with your results
    3. The completion report should include files created/modified and a summary
    
    Please begin working on this task.`;
  }
}
```

### Implementation Notes
- Use spawn with shell:true for proper terminal handling
- Parse ANSI escape codes from output
- Implement robust process cleanup
- Add process pooling for efficiency
- Log all interactions for debugging

---

## Story 12: Task Completion MCP Tools

**Status**: ✅ Completed

**As a** Claude Code instance  
**I want** MCP tools to report task completion  
**So that** the manager knows when I'm done and can process results

### Acceptance Criteria
- [x] Add reportTaskCompletion tool to MCP server
- [x] Tool accepts task ID, status, and structured output
- [x] Validate task exists and is assigned to caller
- [x] Store completion data in database
- [x] Emit completion event for manager to handle
- [x] Support partial progress updates
- [x] Include error reporting in completion
- [x] Return confirmation to Claude

### Technical Details
```typescript
// src/mcp-server/tools.ts
export const taskCompletionTools = {
  reportTaskCompletion: {
    description: "Report completion of an assigned task",
    parameters: {
      taskId: { type: 'number', required: true },
      status: { type: 'string', enum: ['complete', 'failed', 'blocked'] },
      output: {
        type: 'object',
        properties: {
          filesCreated: { type: 'array', items: { type: 'string' } },
          filesModified: { type: 'array', items: { type: 'string' } },
          testsAdded: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          details: { type: 'string' },
          errors: { type: 'array', items: { type: 'string' } },
          nextSteps: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    handler: async (params, context) => {
      // Validate task assignment
      const task = await db.tasks.findById(params.taskId);
      if (!task || task.status !== 'in_progress') {
        throw new Error('Invalid task or not in progress');
      }
      
      // Update task with results
      await db.tasks.update(task.id, {
        status: params.status,
        completedAt: new Date(),
        output: params.output
      });
      
      // Emit event for manager
      manager.emit('task:completed', {
        taskId: task.id,
        featureId: task.featureId,
        status: params.status,
        output: params.output
      });
      
      return {
        success: true,
        message: 'Task completion recorded'
      };
    }
  },
  
  reportTaskProgress: {
    description: "Report progress on current task",
    parameters: {
      taskId: { type: 'number', required: true },
      progress: { type: 'string' },
      currentStep: { type: 'string' }
    }
  }
};
```

### Implementation Notes
- Add authentication/session tracking for Claude instances
- Implement rate limiting to prevent spam
- Store progress updates in audit log
- Add WebSocket notifications for real-time updates
- Consider adding file snapshot capabilities

## Completion Tracking

### Summary
- **Total Stories**: 12
- **Completed**: 6
- **In Progress**: 0
- **Not Started**: 6

### Next Steps
1. ~~Start with Story 1 (Core Infrastructure)~~ ✅
2. ~~Complete Phase 1 before moving to Phase 2~~ ✅ Phase 1 Complete!
3. Each story should be fully tested before marking complete
4. Update this document as work progresses
5. ~~Story 3 (MCP Server Implementation)~~ ✅
6. ~~Story 4 (Headless Claude Executor)~~ ✅
7. ~~Story 12 (Task Completion MCP Tools)~~ ✅
8. ~~Story 11 (Hybrid Claude Executor)~~ ✅
9. **Next**: Story 5 (Autonomous Orchestrator Engine) - The final piece to make Waddle self-sufficient!

### Notes for Resuming Work
- Check this document for current progress
- Review completed stories for context
- Run tests to ensure system still works
- Check for any dependency updates needed