# Epic: Work Item Tracking System with Agent Assignment

**Epic ID**: EPIC-001  
**Status**: New  
**Type**: Epic  
**Assigned To**: Architect Role  
**Created**: 2025-01-17  

## Executive Summary

Implement a work item tracking system using SQLite with a centralized scheduler that automatically assigns work to available agents (Developer, Architect, Tester) and tracks work through multiple development stages. The system uses a centralized polling mechanism where a single scheduler queries for available agents and assignable work, then makes optimal assignments. Claude Code hooks handle state transitions based on agent completion results.

## Technical Discovery

### Database Schema

```sql
-- Work Items Table
CREATE TABLE work_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'review', 'done')),
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('epic', 'user_story', 'bug')),
    assigned_to TEXT CHECK (assigned_to IN ('developer', 'architect', 'tester')),
    agent_id INTEGER,
    parent_id INTEGER, -- For linking user stories to epics
    branch_name TEXT CHECK (branch_name LIKE 'feature/work-item-%-%' OR branch_name IS NULL),
    worktree_path TEXT, -- Optional: Git worktree path for parallel development
    version INTEGER DEFAULT 1, -- For optimistic locking
    started_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (parent_id) REFERENCES work_items(id)
);

-- Agents Table
CREATE TABLE agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('developer', 'architect', 'tester')),
    work_item_id INTEGER,
    version INTEGER DEFAULT 1, -- For optimistic locking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_item_id) REFERENCES work_items(id)
);

-- State Transition Log Table
CREATE TABLE state_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_item_id INTEGER NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL,
    event TEXT,
    agent_type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_item_id) REFERENCES work_items(id)
);
```

### Technical Decisions

1. **SQLite**: Chosen for simplicity, zero configuration, and serverless operation
2. **Centralized Scheduler**: Single scheduler polls every 5 seconds for available agents and assignable work, then makes optimal assignments
3. **Optimistic Locking**: Version columns prevent conflicts between scheduler, hooks, and external API calls
4. **State Management**: Formal state machine validation with transition logging and Claude Code hooks
5. **Agent Reset**: Clear agents on startup to ensure clean state
6. **Git Workflow**: Branch-based development with optional worktrees for parallel work
   - **Branch**: Required for all work items to enable proper Git workflow
   - **Worktree**: Optional for developers who want to work on multiple items simultaneously

### Developer Workflow Instructions

**Branch Management:**
- Each work item gets a unique branch: `feature/work-item-{id}-{slug}`
- Branch created automatically when work item is assigned
- Developers must switch to work item branch before starting work
- All commits must be made to the work item branch

**Worktree Usage (Optional):**
- Developers can request worktrees for parallel development
- Worktree path: `../waddle-worktrees/work-item-{id}/`
- Allows working on multiple items without constant branch switching
- Useful for long-running tasks or when helping with multiple stories

**Work Item Context:**
- API provides: `GET /api/work-items/:id/task-details` 
- Returns: work item details, branch name, worktree path (if exists)
- Developers receive complete context for starting work
- No manual Git setup required - all automated by the system

### Enhanced Architecture Components (Core/Shell)

```
┌─────────────────────────────────────────────────────────────┐
│                        IO Layer (Shell)                     │
│                                                             │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   HTTP API    │  │   Database   │  │  Claude Client  │  │
│  │ (Express/REST)│  │   (SQLite)   │  │   (Claude CLI)  │  │
│  │ • Error Hdlr  │  │ • Migrations │  │ • Hook Scripts  │  │
│  │ • Validation  │  │ • Env Config │  │ • Agent Exec    │  │
│  └───────────────┘  └──────────────┘  └─────────────────┘  │
│           │                │                     │         │
└───────────┼────────────────┼─────────────────────┼─────────┘
            │                │                     │
┌───────────▼────────────────▼─────────────────────▼─────────┐
│                        Core Layer                          │
│                                                             │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Workflows   │  │    Domain    │  │     Agents      │  │
│  │ • Assignment  │  │ • WorkItem   │  │ • Task Prep     │  │
│  │ • Scheduling  │  │ • Agent      │  │ • Orchestration │  │
│  │ • State Mgmt  │  │ • Epic       │  │ • Validation    │  │
│  │               │  │ • StateMach  │  │                 │  │
│  └───────────────┘  └──────────────┘  └─────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
            │                │                     │
┌───────────▼────────────────▼─────────────────────▼─────────┐
│                        Lib Layer                           │
│                                                             │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │      FP       │  │    Result    │  │     Types       │  │
│  │ • pipe        │  │ • Success    │  │ • WorkItem      │  │
│  │ • compose     │  │ • Failure    │  │ • Agent         │  │
│  │ • curry       │  │ • match      │  │ • Task          │  │
│  │               │  │ • ErrorCode  │  │ • StateMachine  │  │
│  └───────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Error Handling Specification

**Standardized Error Response Format:**
```javascript
{
  "error": "Human readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "timestamp": "2025-01-17T10:30:00.000Z",
  "details": {
    "field": "specific field that caused error",
    "value": "invalid value provided"
  }
}
```

**Error Codes:**
- `VALIDATION_ERROR` - Request payload validation failed
- `STATE_TRANSITION_INVALID` - Invalid state transition attempted
- `OPTIMISTIC_LOCK_CONFLICT` - Version conflict in concurrent update
- `RESOURCE_NOT_FOUND` - Requested resource does not exist
- `ASSIGNMENT_CONFLICT` - Work item already assigned to another agent
- `INTERNAL_ERROR` - Unexpected server error

### State Machine Implementation

**Core State Machine Definition:**
```javascript
// src/core/domain/state-machine.ts
const workItemStateMachine = {
  states: {
    new: { transitions: ['in_progress'] },
    in_progress: { transitions: ['review', 'done'] },
    review: { transitions: ['in_progress', 'done'] },
    done: { transitions: [] }
  },
  
  validateTransition(currentState, targetState, event = null) {
    const allowedTransitions = this.states[currentState]?.transitions || [];
    return allowedTransitions.includes(targetState);
  },
  
  getNextStates(currentState) {
    return this.states[currentState]?.transitions || [];
  }
};
```

## Goals

### Primary Goals
1. **Centralized Work Assignment**: Single scheduler efficiently assigns work to available agents based on role and work type
2. **State Tracking**: Clear visibility into work item progress through defined states
3. **Role-Based Assignment**: Optimal matching of work to agent types (architect → epic, developer → user story, tester → review)
4. **Parent-Child Relationships**: Epics contain user stories, completion tracked automatically

### Success Criteria
- Scheduler successfully assigns work to appropriate agents
- No double-assignment or missed work items
- State transitions occur correctly via hooks without scheduler conflicts
- Epic completion tracked when all child user stories complete
- System recovers cleanly on restart with proper agent reinitialization

## User Stories

### US-001: Database Setup and Schema Creation
**As a** system administrator  
**I want** to initialize the SQLite database with proper schema  
**So that** work items and agents can be stored persistently  

**Acceptance Criteria:**
- **Dual Environment Support**: Create separate database configurations for `local` and `test` environments
  - `local`: Used for running the system locally with persistent data
  - `test`: Used for integration tests with clean state per test run
- SQLite database files created with environment-specific naming
- Tables created with proper constraints and foreign keys including optimistic locking
- Database migrations system in place for future changes
- Connection pooling configured for concurrent access
- Environment-specific configuration management

**Technical Notes:**
- **Environment Configuration**:
  - `local`: Database at `./data/waddle-local.db`
  - `test`: Database at `./data/waddle-test.db` (cleaned between test runs)
  - Environment detection via `NODE_ENV` or explicit config
- Use better-sqlite3 for synchronous API and better performance
- Create `src/io/db/` module for database operations with environment support
- Create `src/core/domain/` for WorkItem and Agent models with state machine validation
- Implement schema versioning for migrations
- Add optimistic locking with version columns for concurrent access
- Add state transition logging for audit trail
- Add Git workflow management:
  - Auto-create branches: `feature/work-item-{id}-{slug}` when assigning work
  - Optional worktree creation in `../waddle-worktrees/work-item-{id}/`
  - Branch cleanup after work completion and merge

**Testing Requirements:**
- **Environment-Specific Tests**: Test both local and test database configurations
- Unit tests: Business rule validation via database constraints
- Tests: `src/io/db/constraints.test.ts`
  - ✅ Should enforce work_items status constraints (reject invalid status values)
  - ✅ Should enforce foreign key relationships (prevent orphaned records)
  - ✅ Should validate branch_name format (feature/work-item-{id}-{slug})
  - ✅ Should validate worktree_path format when provided
  - ✅ Should enforce optimistic locking with version columns
  - ✅ Should create separate databases for local and test environments
  - ✅ Should log state transitions in state_transitions table

---

### US-002: Agent Initialization on Server Startup
**As a** system  
**I want** to reset and create agents on startup  
**So that** the system starts in a clean, predictable state  

**Acceptance Criteria:**
- **Clean State Initialization**: On server start, ensure clean scheduler state
- Agents table is cleared and recreated
- Three agents created: developer, architect, tester
- All work items have agent_id and started_at cleared (reset any interrupted assignments)
- Startup logs show successful initialization
- **Scheduler Readiness**: System ready for centralized assignment process

**Technical Notes:**
- **Centralized System Initialization**: Prepare system for single scheduler operation
- Core/Shell separation:
  - **Core**: Agent initialization logic in `src/core/workflows/agent-initialization.ts` (pure functions)
  - **IO**: API calls in `src/io/http/` to interact with endpoints
  - **Composition**: Orchestration in main server initialization
- Use API endpoints: DELETE /api/agents, POST /api/agents, PATCH /api/work-items/assignments
- **Reset Interrupted Work**: Clear any work items that were in-progress during shutdown
- Handle API call errors gracefully

**Testing Requirements:**
- **Scheduler Initialization Tests**: Verify clean state for centralized assignment
- Unit tests: API call logic and error handling
- Tests: `src/core/workflows/agent-initialization.test.ts` (pure functions), `src/io/http/agent-init.test.ts` (API integration)
  - ✅ Should call DELETE /api/agents on initialization
  - ✅ Should call POST /api/agents to create 3 agents (developer, architect, tester)
  - ✅ Should call PATCH /api/work-items/assignments to reset interrupted work
  - ✅ Should handle API call failures gracefully
  - ✅ Should leave system in ready state for scheduler operation

---

### US-003: Work Item Assignment Scheduler + Minimal API
**As a** system scheduler  
**I want** to poll for available agents and assignable work every 5 seconds, then make optimal assignments via API endpoints  
**So that** work is distributed efficiently to agents without conflicts

**Acceptance Criteria:**
- **Centralized Scheduler**: Single scheduler process runs every 5 seconds
- **Two-Phase Assignment Process**:
  1. Query available agents: `GET /api/agents/available`
  2. Query assignable work: `GET /api/work-items?assignable=true&type=X&status=Y`
  3. Match work to agents based on rules and make assignments
- **Assignment Rules**:
  - Architects → new epics (`type=epic&status=new`)
  - Developers → new user stories (`type=user_story&status=new`)
  - Testers → user stories in review (`type=user_story&status=review`)
- **Atomic Updates**: Each assignment updates work_items table atomically
- **Conflict Prevention**: Optimistic locking handles scheduler vs hook conflicts
- **Minimal API endpoints implemented:**
  - `GET /api/agents/available` - Get agents without assigned work
  - `GET /api/work-items/assignable` - Get work items ready for assignment
  - `PATCH /api/work-items/:id` - Update work item (assignment creates branch)

**Technical Notes:**
- **Centralized Scheduler Design**: Single process orchestrates all assignments
- **Two-Phase Assignment Algorithm**:
  1. Fetch available resources (agents + work)
  2. Apply matching rules and make assignments
- Core/Shell separation:
  - **Core**: Assignment matching logic in `src/core/workflows/work-assignment.ts` (pure matching algorithms)
  - **Core**: Assignment rules in `src/core/domain/assignment-rules.ts` (agent-to-work-type mapping)
  - **IO**: Scheduler orchestration in `src/io/scheduler/` (setInterval, API calls, assignment execution)
  - **IO**: Minimal API routes in `src/io/http/routes/` (agents.ts, work-items.ts - partial implementation)
- **Minimal API Implementation:**
  - Only 3 endpoints needed: available agents, assignable work, assign work
  - Proper HTTP layer with Express routes
  - Database operations via repository pattern
  - Git operations handled in assignment endpoint
- **Conflict Scenarios**: Optimistic locking protects against hook/scheduler conflicts and multiple scheduler instances

**Testing Requirements:**
- **Centralized Scheduler Tests**: Test two-phase assignment process
- Unit tests: Assignment matching logic and API orchestration
- Tests: `src/core/workflows/work-assignment.test.ts` (pure matching logic), `src/io/scheduler/scheduler.test.ts` (integration)
  - ✅ Should fetch available agents via GET /api/agents/available
  - ✅ Should fetch assignable work with correct filters: GET /api/work-items?assignable=true&type=epic&status=new
  - ✅ Should match agents to work based on assignment rules
  - ✅ Should make assignments via PATCH /api/work-items/:id
  - ✅ Should handle API call failures gracefully
  - ✅ Should respect assignment rules (architect→epic, developer→user_story, tester→review)
  - ✅ Should handle empty agent or work queues gracefully
- Integration tests: Minimal API endpoints
- Tests: `src/io/http/routes/agents.test.ts`, `src/io/http/routes/work-items.test.ts`
  - ✅ Should return available agents via GET /api/agents/available
  - ✅ Should return assignable work items via GET /api/work-items/assignable
  - ✅ Should assign work and create branch via PATCH /api/work-items/:id

---

### US-004: Comprehensive Work Tracking API
**As a** system component  
**I want** comprehensive REST endpoints for all work tracking operations  
**So that** all system services use a consistent API layer  

**Acceptance Criteria:**

**Work Items Endpoints (RESTful Design):**
- `POST /api/work-items` - Create new work item
- `GET /api/work-items` - List all work items (with filters: ?status=new&type=epic&assignable=true)
- `GET /api/work-items/:id` - Get specific work item
- `PATCH /api/work-items/:id` - Update work item (state, assignment, results, etc.)
- `PATCH /api/work-items/assignments` - Clear all agent assignments (bulk operation)
- `GET /api/work-items/:id/children` - Get child work items (for epics)
- `GET /api/work-items/:id/task-details` - Get formatted task details for agents
- `POST /api/work-items/:id/relationships/parent/validation` - Trigger parent epic completion check
- `POST /api/work-items/:id/worktrees` - Create worktree for work item
- `DELETE /api/work-items/:id/worktrees` - Remove worktree after completion
- `GET /api/work-items/:id/state-transitions` - Get state transition history

**Agents Endpoints:**
- GET /api/agents - List all agents with current assignments
- GET /api/agents/available - Get agents without assigned work
- POST /api/agents - Create new agent
- DELETE /api/agents - Clear all agents
- PATCH /api/agents/:id - Update agent (assignment, etc.)

**Query Endpoints (RESTful with filters):**
- `GET /api/work-items?assignable=true&type=epic&status=new` - Get assignable work by filters
- `GET /api/agents?type=developer` - Get agents by type using query parameter

**Enhanced Error Handling and Validation:**
- Standardized error response format with error codes
- Request payload validation middleware
- State transition validation using formal state machine
- Optimistic locking conflict detection
- Comprehensive transaction support for atomic operations

**Technical Notes:**
- **RESTful API Design**: Follow REST conventions with resource-based URLs and proper HTTP methods
- **State Machine Integration**: Add formal state machine validation in core layer
- **Error Handling Middleware**: Standardized error responses with proper HTTP status codes
- Core/Shell separation:
  - **Core**: Business logic in `src/core/workflows/` (assignment, scheduling, state management)
  - **Core**: State machine validation in `src/core/domain/state-machine.ts`
  - **Core**: Domain models in `src/core/domain/` (WorkItem, Agent, Epic entities)
  - **IO**: HTTP routes in `src/io/http/routes/` (work-items.ts, agents.ts)
  - **IO**: Database operations in `src/io/db/` (repositories, queries)
- **Enhanced Validation**: Comprehensive request validation middleware with detailed error messages
- **Optimistic Locking**: Version-based conflict detection and retry logic
- **Transaction Support**: Atomic operations for multi-table updates
- All side effects isolated to IO layer for testability

**Testing Requirements:**
- Integration tests: All API endpoints with real database operations
- Tests: `src/io/http/routes/work-items.integration.test.ts`

**Work Items API Tests:**
  - ✅ Should create work items via POST /api/work-items
  - ✅ Should list work items with filters via GET /api/work-items
  - ✅ Should get specific work item via GET /api/work-items/:id
  - ✅ Should update work item state via PATCH /api/work-items/:id
  - ✅ Should assign work item to agent via PATCH /api/work-items/:id
  - ✅ Should clear all assignments via PATCH /api/work-items/assignments
  - ✅ Should get children for epics via GET /api/work-items/:id/children
  - ✅ Should get task details via GET /api/work-items/:id/task-details
  - ✅ Should store execution results via PATCH /api/work-items/:id
  - ✅ Should trigger parent checks via POST /api/work-items/:id/parent-checks
  - ✅ Should get assignable work via GET /api/work-items/assignable
  - ✅ Should auto-create branch when assigning work item to agent
  - ✅ Should include branch/worktree info in task details
  - ✅ Should create worktree via POST /api/work-items/:id/worktrees
  - ✅ Should cleanup worktree via DELETE /api/work-items/:id/worktrees

**Agents API Tests:**
  - ✅ Should list all agents via GET /api/agents
  - ✅ Should get available agents via GET /api/agents/available
  - ✅ Should create agents via POST /api/agents
  - ✅ Should clear all agents via DELETE /api/agents
  - ✅ Should update agent assignment via PATCH /api/agents/:id
  - ✅ Should get agents by type via GET /api/agents/by-type/:type

**Enhanced Business Logic Tests:**
  - ✅ Should enforce state transition rules using formal state machine
  - ✅ Should handle concurrent assignment attempts with optimistic locking
  - ✅ Should maintain parent-child relationships
  - ✅ Should auto-complete epics when all children done
  - ✅ Should validate request payloads with detailed error messages
  - ✅ Should handle errors gracefully with standardized error response format
  - ✅ Should support database transactions for multi-table updates
  - ✅ Should log state transitions for audit trail
  - ✅ Should detect and handle version conflicts in optimistic locking
  - ✅ Should follow RESTful API conventions consistently

---


### US-005: Epic Work Item Management
**As an** architect agent  
**I want** to process epic work items  
**So that** I can break them down into user stories  

**Acceptance Criteria:**
- Architect agents pick up 'new' epics
- Epic transitions to 'in_progress' when assigned
- Epic automatically transitions to 'done' when all child user stories complete
- Parent-child relationship properly maintained

**Technical Notes:**
- Core/Shell separation:
  - **Core**: Epic completion logic in `src/core/workflows/epic-completion.ts` (pure business rules)
  - **Core**: Epic domain model in `src/core/domain/epic.ts` (entities and validation)
  - **IO**: Epic handler orchestration in `src/io/handlers/epic-handler.ts` (API calls, side effects)
- Use API endpoints: PATCH /api/work-items/:id, GET /api/work-items/:id/children
- API handles completion checking logic

**Testing Requirements:**
- Unit tests: Epic handler API interaction
- Tests: `src/core/workflows/epic-completion.test.ts` (pure logic), `src/io/handlers/epic-handler.test.ts` (integration)
  - ✅ Should call PATCH /api/work-items/:id to transition epic to 'in_progress'
  - ✅ Should call PATCH /api/work-items/:id for completion checks
  - ✅ Should handle API call failures gracefully

---

### US-006: User Story Work Item Management  
**As a** developer agent  
**I want** to process user story work items  
**So that** I can implement features  

**Acceptance Criteria:**
- Developer agents pick up 'new' user stories
- User story transitions: new → in_progress → review → done
- Proper work locking prevents double assignment
- State transitions trigger parent epic checks

**Technical Notes:**
- **Formal State Machine**: Implement state machine validation in core layer
- Core/Shell separation:
  - **Core**: User story state machine in `src/core/domain/state-machine.ts` (formal state validation)
  - **Core**: User story domain model in `src/core/domain/user-story.ts` (entities and validation)
  - **IO**: User story handler in `src/io/handlers/user-story-handler.ts` (API calls, side effects)
- Use RESTful API endpoints: `PATCH /api/work-items/:id`, `POST /api/work-items/:id/relationships/parent/validation`
- API handles state validation using formal state machine and optimistic locking

**Testing Requirements:**
- **State Machine Tests**: Comprehensive testing of state transition validation
- Unit tests: User story handler API interaction and state machine logic
- Tests: `src/core/domain/state-machine.test.ts` (pure state logic), `src/io/handlers/user-story-handler.test.ts` (integration)
  - ✅ Should validate state transitions using formal state machine
  - ✅ Should prevent invalid state transitions
  - ✅ Should call PATCH /api/work-items/:id for state transitions
  - ✅ Should call POST /api/work-items/:id/relationships/parent/validation after completion
  - ✅ Should handle API call failures gracefully
  - ✅ Should log state transitions for audit trail

---

### US-007: Claude Code Hooks Integration
**As a** system  
**I want** to use Claude Code stop hooks for state transitions  
**So that** work item states change according to agent actions and results  

**Acceptance Criteria:**
- Stop hooks configured for each agent type (developer, architect, tester)
- Hooks analyze agent output and make intelligent state transitions
- Tester hooks can decide between "pass to done" or "send back to developer"
- All hooks call API endpoints to update work item states
- Failed hooks don't corrupt data and provide clear error messages
- Hooks log all state changes and decisions

**Technical Notes:**
- **Enhanced Hook Integration**: Create `.claude/hooks/stop` script with proper error handling
- **Standardized API Calls**: All hook API calls use standardized error response format
- Hook receives JSON input with tool usage details and file paths
- Implement conditional logic for different agent types:
  ```bash
  # Enhanced hook structure with error handling
  #!/bin/bash
  set -e  # Exit on any error
  
  input=$(cat)
  agent_type=$(echo "$input" | jq -r '.context.agent_type')
  work_item_id=$(echo "$input" | jq -r '.context.work_item_id')
  
  # Function for API calls with error handling
  api_call() {
    local method="$1"
    local url="$2"
    local data="$3"
    
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [[ $http_code -ge 400 ]]; then
      echo "API Error: $body" >&2
      exit 1
    fi
    
    echo "$body"
  }
  
  case $agent_type in
    "tester")
      # Analyze test results and decide next state with proper error handling
      if [[ test_results_contain_failures ]]; then
        api_call "PATCH" "http://localhost:3000/api/work-items/$work_item_id" \
          '{"status":"in_progress","assigned_to":"developer","event":"test_failed"}'
      else
        api_call "PATCH" "http://localhost:3000/api/work-items/$work_item_id" \
          '{"status":"done","event":"test_passed"}'
      fi
      ;;
  esac
  ```
- **Error Handling**: Hook failures logged and don't corrupt data
- **State Validation**: All state transitions validated through formal state machine
- Pass agent context (type, work_item_id) to hooks via environment or input
- Reference: https://docs.anthropic.com/en/docs/claude-code/hooks#stop

**Testing Requirements:**
- Unit tests: Hook script logic and API calls
- Tests: `tests/hooks/stop-hook.test.ts`
  - ✅ Should parse agent context from hook input
  - ✅ Should call PATCH /api/work-items/:id with correct parameters
  - ✅ Should handle tester decision logic (pass→done, fail→back to developer)
  - ✅ Should handle curl/API call failures gracefully
  - ✅ Should log all decisions and API calls

---

### US-008: Agent Work Execution Integration
**As an** agent  
**I want** to execute actual work using the agent implementations  
**So that** work items are processed according to role  

**Acceptance Criteria:**
- Scheduler calls appropriate agent (developer/architect/tester)
- Agent receives work item details as task
- Agent execution results stored
- Failures handled gracefully

**Technical Notes:**
- Integrate with existing `src/services/agents/developer.ts`, etc.
- Create `src/services/work-items/agent-executor.ts`
- Use API endpoints: GET /api/work-items/:id/task-details, PATCH /api/work-items/:id
- Add execution logging and error handling

**Testing Requirements:**
- Unit tests: Agent execution and API interaction
- Tests: `src/services/work-items/agent-executor.test.ts`
  - ✅ Should call GET /api/work-items/:id/task-details to get work details
  - ✅ Should execute appropriate agent (developer/architect/tester) with task details
  - ✅ Should call PATCH /api/work-items/:id to store results
  - ✅ Should handle agent execution failures gracefully
  - ✅ Should handle API call failures gracefully
  - ✅ Should pass correct task context to agents

## Implementation Order

### **Phase 1: Minimal Viable System (Manual Implementation)**
1. **Foundation** (US-001): Database schema
2. **Initialization** (US-002): Agent initialization and startup
3. **Scheduler + Minimal API** (US-003): Scheduler with 3 essential API endpoints

### **Phase 2: Automated Development**
4. **Full API** (US-004): Complete remaining API endpoints - can be built by system
5. **Work Types** (US-005, US-006): Epic and user story handlers - built by system
6. **Automation** (US-007): Claude Code hooks - built by system  
7. **Integration** (US-008): Agent execution integration - built by system

**After 3 stories, the system can build the remaining features using its own workflow!**

## Open Questions

1. **Work Item Creation**: How are initial work items created? Via API, CLI, or seeded data?
2. **Bug Handling**: Bugs are mentioned in the schema but not in the workflow. Who handles bugs?
3. **Review Process**: Who performs reviews when user stories enter 'review' state?
4. **Scheduler Scaling**: Should we support multiple scheduler instances with coordination?
5. **Work Prioritization**: Should scheduler implement priority ordering for work assignment?
6. **Assignment Timeout**: How long before scheduler reassigns stuck work items?

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|---------|------------|
| Scheduler vs Hook conflicts | Inconsistent state transitions | Optimistic locking with version columns |
| Multiple scheduler instances | Double assignments | Single scheduler deployment, environment isolation |
| Scheduler crashes during assignment | Work items stuck in progress | Timeout mechanism, startup cleanup |
| Hook failures | Inconsistent state | Transaction rollbacks, state validation |
| External API modifications | Assignment conflicts | Optimistic locking protects all updates |
| Circular parent-child relationships | Infinite loops | Add validation, depth limits |

## Testing Strategy Summary

### **API-First Testing Approach**
All business logic and database operations are tested comprehensively in the API integration tests (27 test cases). Other components have simplified unit tests that only verify correct API usage.

### **Enhanced Testing Distribution:**
- **Database Layer** (US-001): 8 constraint validation tests (includes environment config, optimistic locking, state transitions)
- **Scheduler + Minimal API** (US-003): 10 tests (5 scheduler + 5 enhanced API endpoints with error handling)
- **Full API Layer** (US-004): 35 comprehensive integration tests covering all business logic (includes RESTful design, state machine validation, error handling, optimistic locking)
- **State Machine Logic** (US-005,006): 8 pure unit tests for state transition validation
- **Service Layer** (US-005,006,007,008): 15 focused unit tests verifying API calls and error handling

**Total: 76 test cases** with enhanced coverage for state machines, error handling, and optimistic locking.

### **Enhanced Benefits:**
- **Comprehensive State Validation**: State machine logic tested independently and in integration
- **Error Handling Coverage**: All error scenarios tested with standardized response validation
- **Concurrency Testing**: Optimistic locking and race conditions thoroughly tested
- **Environment Isolation**: Separate test databases ensure clean test state
- **Single Source of Truth**: All business logic tested in one place (API)
- **Fast Unit Tests**: Core logic tests run independently of I/O operations
- **Clear Boundaries**: Each layer tests only its responsibilities
- **Maintainable**: Layered testing approach reduces test maintenance overhead

## Success Metrics

- **Assignment Latency**: < 10 seconds from work creation to assignment
- **State Consistency**: 100% valid state transitions
- **Agent Utilization**: > 80% of agents actively working
- **System Uptime**: > 99.9% scheduler availability