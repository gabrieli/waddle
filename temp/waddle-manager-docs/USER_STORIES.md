# User Stories - Waddle Implementation

## Progress Tracker

### Phase 1 - Foundation
- [ ] Story 1: Core Infrastructure Setup
- [ ] Story 2: SQLite Database Layer

### Phase 2 - Core Engine
- [ ] Story 3: MCP Server Implementation
- [ ] Story 4: Headless Claude Executor
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

**Status**: ⬜ Not Started

**As a** developer  
**I want** a well-structured TypeScript project with all necessary dependencies  
**So that** I can build the Waddle with modern tooling

### Acceptance Criteria
- [ ] TypeScript project initialized with strict mode
- [ ] Dependencies installed: express, better-sqlite3, commander, winston
- [ ] Build system configured with tsup
- [ ] Jest testing framework configured
- [ ] ESLint and Prettier configured
- [ ] Basic project structure created

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

**Status**: ⬜ Not Started

**As a** system  
**I want** a persistent database to track features, tasks, and context  
**So that** work progress and history are maintained across restarts

### Acceptance Criteria
- [ ] Database schema implemented with migrations
- [ ] Repository pattern for data access
- [ ] CRUD operations for features, tasks, transitions
- [ ] Context storage for architecture docs and reviews
- [ ] Transaction support for state changes
- [ ] Database initialization on first run
- [ ] Unit tests for all repository methods

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

**Status**: ⬜ Not Started

**As a** Claude Code user  
**I want** MCP tools to interact with Waddle  
**So that** I can create features and monitor progress

### Acceptance Criteria
- [ ] MCP server running on configurable port (default 3000)
- [ ] Tools implemented: createFeature, getProgress, queryFeatures
- [ ] Additional tools: pauseWork, resumeWork, setFeaturePriority
- [ ] JSON-RPC 2.0 protocol compliance
- [ ] Error handling with proper error codes
- [ ] Request validation with clear error messages
- [ ] Integration tests with mock Claude Code client

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

**Status**: ⬜ Not Started

**As a** manager system  
**I want** to spawn headless Claude instances with specific contexts  
**So that** tasks are completed autonomously

### Acceptance Criteria
- [ ] Spawn Claude with -p flag and appropriate tools
- [ ] Role-based prompt templates (architect, developer, reviewer)
- [ ] Context injection from database
- [ ] Output parsing for both text and JSON formats
- [ ] Error handling for process failures
- [ ] Retry logic with exponential backoff
- [ ] Process timeout management
- [ ] Resource cleanup on failure

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

## Completion Tracking

### Summary
- **Total Stories**: 10
- **Completed**: 0
- **In Progress**: 0
- **Not Started**: 10

### Next Steps
1. Start with Story 1 (Core Infrastructure)
2. Complete Phase 1 before moving to Phase 2
3. Each story should be fully tested before marking complete
4. Update this document as work progresses

### Notes for Resuming Work
- Check this document for current progress
- Review completed stories for context
- Run tests to ensure system still works
- Check for any dependency updates needed