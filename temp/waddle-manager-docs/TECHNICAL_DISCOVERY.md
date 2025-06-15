# Technical Discovery: Waddle - Autonomous Development Orchestration System

## Executive Summary

Waddle is an autonomous development orchestration system that manages software development workflows by coordinating AI agents through different development phases. It eliminates the need for constant human interaction by intelligently routing work between architecture, development, and review phases while maintaining context and progress in a persistent database.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Waddle Manager                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Autonomous      │  │   MCP Server     │  │  Web UI      │ │
│  │  Orchestrator    │  │   (Port 3000)    │  │  (Port 8080) │ │
│  │                  │  │                  │  │              │ │
│  │  - Task Queue    │  │  - createFeature │  │  - Dashboard │ │
│  │  - State Machine │  │  - getProgress   │  │  - Metrics   │ │
│  │  - AI Reasoner   │  │  - pauseWork     │  │  - Logs      │ │
│  └────────┬─────────┘  └──────────────────┘  └──────────────┘ │
│           │                                                      │
│           ▼ Spawns                                               │
│  ┌──────────────────────────────────────┐                      │
│  │     Headless Claude Executor         │                      │
│  │  - Role-based prompts                │                      │
│  │  - Tool permissions                  │                      │
│  │  - Context injection                 │                      │
│  └──────────────────────────────────────┘                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SQLite Database                        │  │
│  │  Tables: features, tasks, transitions, context, audit    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Autonomous Orchestrator
- Continuous loop checking for pending work
- Intelligent task routing using AI reasoning
- State management and transition validation
- Deadlock detection and resolution
- Progress monitoring and SLA enforcement

### 2. MCP Server Interface
- Exposes tools for Claude Code interaction
- RESTful API for external integrations
- WebSocket support for real-time updates
- Authentication via API keys
- Rate limiting and quota management

### 3. Headless Execution Engine
- Spawns Claude instances with specific roles
- Manages tool permissions per role
- Injects context from database
- Handles execution timeouts and retries
- Captures and stores outputs

### 4. Persistent Storage (SQLite)
- Feature and task tracking
- State transition history
- Context documents (architecture, reviews)
- Audit logs for compliance
- Performance metrics

### 5. Web Dashboard
- Real-time progress monitoring
- Feature pipeline visualization
- Manual intervention capabilities
- Historical analytics
- System health monitoring

## Technology Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js for HTTP/MCP server
- **Database**: SQLite with better-sqlite3
- **Process Management**: Node.js child_process for headless Claude
- **Web UI**: React + Vite for dashboard
- **Testing**: Jest + Playwright
- **Package Manager**: npm/yarn
- **Build Tool**: tsup for library bundling

## Key Design Decisions

1. **TypeScript Over Python**: Better type safety, seamless Node.js integration, easier npm distribution
2. **SQLite Over PostgreSQL**: Zero configuration, embedded database, perfect for single-instance deployment
3. **MCP Protocol**: Industry standard for AI tool integration
4. **Headless Claude Execution**: Clean process isolation, full tool access, error boundary
5. **AI-Powered Orchestration**: Handles edge cases better than rigid state machines

## Security Considerations

- API key authentication for MCP endpoints
- Sandboxed execution environments
- Audit logging for all state changes
- No credential storage in database
- Optional encryption at rest

## Deployment Model

- Single binary/npm package installation
- No external dependencies besides Claude CLI
- Optional Docker container
- Cloud-ready with persistent volume support

## Database Schema

### Features Table
```sql
CREATE TABLE features (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    status TEXT NOT NULL, -- pending, in_progress, complete, failed
    priority TEXT DEFAULT 'normal', -- low, normal, high, critical
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSON
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_id TEXT NOT NULL,
    role TEXT NOT NULL, -- architect, developer, reviewer
    description TEXT NOT NULL,
    status TEXT NOT NULL, -- pending, in_progress, complete, failed
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    output JSON,
    error TEXT,
    FOREIGN KEY (feature_id) REFERENCES features(id)
);
```

### Transitions Table
```sql
CREATE TABLE transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- feature, task
    entity_id TEXT NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL,
    reason TEXT,
    actor TEXT, -- system, user, ai
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON
);
```

### Context Table
```sql
CREATE TABLE context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_id TEXT NOT NULL,
    type TEXT NOT NULL, -- architecture, review, implementation
    content TEXT NOT NULL,
    author TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feature_id) REFERENCES features(id)
);
```

### Audit Table
```sql
CREATE TABLE audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    actor TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Specifications

### MCP Tools

```typescript
interface WaddleManagerTools {
  // Feature Management
  createFeature(params: {
    description: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    metadata?: Record<string, any>;
  }): Promise<{ featureId: string; status: string }>;

  // Progress Monitoring
  getProgress(params?: {
    featureId?: string;
  }): Promise<{
    active: TaskProgress[];
    pending: number;
    completed: number;
    avgCompletionTime: number;
  }>;

  // Query Features
  queryFeatures(params: {
    status?: string;
    priority?: string;
    since?: string;
    limit?: number;
  }): Promise<Feature[]>;

  // Control Operations
  pauseWork(): Promise<{ status: 'paused' }>;
  resumeWork(): Promise<{ status: 'resumed' }>;
  
  // Priority Management
  setFeaturePriority(params: {
    featureId: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
  }): Promise<{ updated: boolean }>;
}
```

### REST API Endpoints

```
POST   /api/features          - Create new feature
GET    /api/features          - List features
GET    /api/features/:id      - Get feature details
PATCH  /api/features/:id      - Update feature
GET    /api/progress          - Get system progress
POST   /api/control/pause     - Pause system
POST   /api/control/resume    - Resume system
GET    /api/health            - Health check
```

## Configuration

### Default Configuration (waddle.config.json)

```json
{
  "manager": {
    "port": 3000,
    "webUIPort": 8080,
    "databasePath": "./waddle.db",
    "logLevel": "info"
  },
  "orchestrator": {
    "checkInterval": 30000,
    "maxConcurrentTasks": 1,
    "taskTimeout": 3600000,
    "retryAttempts": 3,
    "retryDelay": 60000
  },
  "executor": {
    "claudePath": "claude",
    "defaultModel": "claude-3-sonnet",
    "roleModels": {
      "architect": "claude-3-opus",
      "developer": "claude-3-sonnet",
      "reviewer": "claude-3-haiku"
    }
  },
  "tools": {
    "architect": ["Read", "Write", "Edit", "WebSearch"],
    "developer": ["Read", "Write", "Edit", "MultiEdit", "Bash", "Grep"],
    "reviewer": ["Read", "Grep", "Bash"]
  }
}
```

## Error Handling Strategy

1. **Graceful Degradation**: System continues operating even if individual tasks fail
2. **Retry Logic**: Exponential backoff with configurable limits
3. **Circuit Breaker**: Prevents cascade failures
4. **Dead Letter Queue**: Failed tasks are stored for manual review
5. **Health Checks**: Continuous monitoring of system components

## Performance Considerations

- SQLite WAL mode for concurrent reads
- Connection pooling for database access
- Process pooling for Claude executions
- Caching layer for frequently accessed data
- Pagination for large result sets

## Monitoring and Observability

- Structured logging with Winston
- Metrics collection (task completion time, success rate)
- Health endpoint for monitoring tools
- Event stream for real-time updates
- Audit trail for compliance

## Future Enhancements

1. **Multi-Provider Support**: OpenAI, Anthropic, Google AI
2. **Distributed Execution**: Multiple worker nodes
3. **Cloud Deployment**: Managed service offering
4. **Plugin System**: Custom workflow steps
5. **Advanced Analytics**: ML-based performance optimization