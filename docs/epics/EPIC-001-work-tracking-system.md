# Epic: Work Item Tracking System with Agent Assignment

**Epic ID**: EPIC-001  
**Status**: New  
**Type**: Epic  
**Assigned To**: Architect Role  
**Created**: 2025-01-17  

## Executive Summary

Implement a work item tracking system using SQLite that automatically assigns work to available agents (Developer, Architect, Tester) and tracks work through multiple development stages. The system will use a polling mechanism to continuously assign work and leverage Claude Code hooks for state transitions.

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_item_id) REFERENCES work_items(id)
);
```

### Technical Decisions

1. **SQLite**: Chosen for simplicity, zero configuration, and serverless operation
2. **Polling Interval**: 5-second interval balances responsiveness with resource usage
3. **Work Locking**: Using `agent_id` and `started_at` as optimistic locking mechanism
4. **State Management**: Claude Code hooks for state transitions ensure proper workflow
5. **Agent Reset**: Clear agents on startup to ensure clean state

### Architecture Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   HTTP Server   │────▶│  Work Scheduler  │────▶│  SQLite DB      │
│   (Express)     │     │  (5s interval)   │     │  - work_items   │
└─────────────────┘     └──────────────────┘     │  - agents       │
         │                       │                └─────────────────┘
         │                       │                         ▲
         ▼                       ▼                         │
┌─────────────────┐     ┌──────────────────┐             │
│  Claude Hooks   │     │  Agent Workers   │─────────────┘
│  (State Trans.) │     │  (Dev/Arch/Test) │
└─────────────────┘     └──────────────────┘
```

## Goals

### Primary Goals
1. **Automated Work Assignment**: Agents automatically pick up work based on role and availability
2. **State Tracking**: Clear visibility into work item progress through defined states
3. **Role-Based Assignment**: Work items assigned to appropriate roles (architect → epic, developer → user story)
4. **Parent-Child Relationships**: Epics contain user stories, completion tracked automatically

### Success Criteria
- Agents successfully pick up and process work items
- State transitions occur correctly via hooks
- Epic completion tracked when all child user stories complete
- System recovers cleanly on restart

## User Stories

### US-001: Database Setup and Schema Creation
**As a** system administrator  
**I want** to initialize the SQLite database with proper schema  
**So that** work items and agents can be stored persistently  

**Acceptance Criteria:**
- SQLite database file created in project root
- Tables created with proper constraints and foreign keys
- Database migrations system in place for future changes
- Connection pooling configured for concurrent access

**Technical Notes:**
- Use better-sqlite3 for synchronous API and better performance
- Create `src/services/database/` module
- Implement schema versioning for migrations

**Testing Requirements:**
- Unit tests: Business rule validation via database constraints
- Tests: `src/services/database/constraints.test.ts`
  - ✅ Should enforce work_items status constraints (reject invalid status values)
  - ✅ Should enforce foreign key relationships (prevent orphaned records)

---

### US-002: Comprehensive Work Tracking API
**As a** system component  
**I want** comprehensive REST endpoints for all work tracking operations  
**So that** all system services use a consistent API layer  

**Acceptance Criteria:**

**Work Items Endpoints:**
- POST /api/work-items - Create new work item
- GET /api/work-items - List all work items (with filters)
- GET /api/work-items/:id - Get specific work item
- PUT /api/work-items/:id/state - Update work item state and assignment
- PUT /api/work-items/:id/assign - Assign work item to agent
- PUT /api/work-items/clear-assignments - Clear all agent assignments
- GET /api/work-items/:id/children - Get child work items (for epics)
- GET /api/work-items/:id/task-details - Get formatted task details for agents
- PUT /api/work-items/:id/execution-result - Store agent execution results
- POST /api/work-items/:id/trigger-parent-check - Trigger parent epic completion check
- PUT /api/work-items/:id/auto-complete - Auto-complete epic if all children done

**Agents Endpoints:**
- GET /api/agents - List all agents with current assignments
- GET /api/agents/available - Get agents without assigned work
- POST /api/agents - Create new agent
- DELETE /api/agents - Clear all agents
- PUT /api/agents/:id/assign - Assign work item to specific agent

**Query Endpoints (for scheduler):**
- GET /api/work-items/assignable?type=epic&status=new - Get assignable work by type/status
- GET /api/agents/by-type/:type - Get agents by type (developer/architect/tester)

**Proper error handling, validation, and transaction support**

**Technical Notes:**
- Add routes to Express server
- Create `src/server/routes/work-items.ts`
- Create `src/server/routes/agents.ts`
- Add comprehensive request validation middleware
- All database operations go through API layer
- Transaction support for multi-table updates
- Optimistic locking support for concurrent updates

**Testing Requirements:**
- Integration tests: All API endpoints with real database operations
- Tests: `src/server/routes/work-items.integration.test.ts`

**Work Items API Tests:**
  - ✅ Should create work items via POST /api/work-items
  - ✅ Should list work items with filters via GET /api/work-items
  - ✅ Should get specific work item via GET /api/work-items/:id
  - ✅ Should update work item state via PUT /api/work-items/:id/state
  - ✅ Should assign work item to agent via PUT /api/work-items/:id/assign
  - ✅ Should clear all assignments via PUT /api/work-items/clear-assignments
  - ✅ Should get children for epics via GET /api/work-items/:id/children
  - ✅ Should get task details via GET /api/work-items/:id/task-details
  - ✅ Should store execution results via PUT /api/work-items/:id/execution-result
  - ✅ Should trigger parent checks via POST /api/work-items/:id/trigger-parent-check
  - ✅ Should auto-complete epics via PUT /api/work-items/:id/auto-complete
  - ✅ Should get assignable work via GET /api/work-items/assignable

**Agents API Tests:**
  - ✅ Should list all agents via GET /api/agents
  - ✅ Should get available agents via GET /api/agents/available
  - ✅ Should create agents via POST /api/agents
  - ✅ Should clear all agents via DELETE /api/agents
  - ✅ Should assign work to agent via PUT /api/agents/:id/assign
  - ✅ Should get agents by type via GET /api/agents/by-type/:type

**Business Logic Tests:**
  - ✅ Should enforce state transition rules
  - ✅ Should handle concurrent assignment attempts
  - ✅ Should maintain parent-child relationships
  - ✅ Should auto-complete epics when all children done
  - ✅ Should validate request payloads
  - ✅ Should handle errors gracefully with proper HTTP status codes
  - ✅ Should support database transactions for multi-table updates

---

### US-003: Agent Initialization on Server Startup
**As a** system  
**I want** to reset and create agents on startup  
**So that** the system starts in a clean, predictable state  

**Acceptance Criteria:**
- On server start, agents table is cleared
- Three agents created: developer, architect, tester
- All work items have agent_id and started_at cleared
- Startup logs show successful initialization

**Technical Notes:**
- Add initialization to `src/server/index.js`
- Create `src/services/agents/agent-manager.ts`
- Use API endpoints: DELETE /api/agents, POST /api/agents, PUT /api/work-items/clear-assignments
- Handle API call errors gracefully

**Testing Requirements:**
- Unit tests: API call logic and error handling
- Tests: `src/services/agents/agent-manager.test.ts`
  - ✅ Should call DELETE /api/agents on initialization
  - ✅ Should call POST /api/agents to create 3 agents (developer, architect, tester)
  - ✅ Should call PUT /api/work-items/clear-assignments
  - ✅ Should handle API call failures gracefully

---

### US-004: Work Item Assignment Scheduler
**As a** system  
**I want** to check for idle agents every 5 seconds  
**So that** available agents are assigned work automatically  

**Acceptance Criteria:**
- Scheduler runs every 5 seconds
- Finds agents without assigned work
- Assigns appropriate work items based on rules:
  - Architects → new epics
  - Developers → new user stories  
  - Testers → user stories in review
- Updates both agents and work_items tables atomically
- Handles race conditions with optimistic locking

**Technical Notes:**
- Use setInterval with error handling
- Create `src/services/scheduler/work-scheduler.ts`
- Use API endpoints: GET /api/agents/available, GET /api/work-items/assignable, PUT /api/work-items/:id/assign
- API handles atomic updates and race conditions

**Testing Requirements:**
- Unit tests: Scheduler logic and API interaction
- Tests: `src/services/scheduler/work-scheduler.test.ts`
  - ✅ Should call GET /api/agents/available to find idle agents
  - ✅ Should call GET /api/work-items/assignable with correct filters for each agent type
  - ✅ Should call PUT /api/work-items/:id/assign for matching work
  - ✅ Should handle API call failures gracefully
  - ✅ Should respect assignment rules (architect→epic, developer→user story, tester→review)

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
- Create `src/services/work-items/epic-handler.ts`
- Use API endpoints: PUT /api/work-items/:id/state, GET /api/work-items/:id/children, PUT /api/work-items/:id/auto-complete
- API handles completion checking logic

**Testing Requirements:**
- Unit tests: Epic handler API interaction
- Tests: `src/services/work-items/epic-handler.test.ts`
  - ✅ Should call PUT /api/work-items/:id/state to transition epic to 'in_progress'
  - ✅ Should call PUT /api/work-items/:id/auto-complete for completion checks
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
- Create `src/services/work-items/user-story-handler.ts`
- Use API endpoints: PUT /api/work-items/:id/state, POST /api/work-items/:id/trigger-parent-check
- API handles state validation and locking

**Testing Requirements:**
- Unit tests: User story handler API interaction
- Tests: `src/services/work-items/user-story-handler.test.ts`
  - ✅ Should call PUT /api/work-items/:id/state for state transitions
  - ✅ Should call POST /api/work-items/:id/trigger-parent-check after completion
  - ✅ Should handle API call failures gracefully

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
- Create `.claude/hooks/stop` script (runs when any agent finishes)
- Hook receives JSON input with tool usage details and file paths
- Implement conditional logic for different agent types:
  ```bash
  # Example hook structure
  #!/bin/bash
  input=$(cat)
  agent_type=$(echo "$input" | jq -r '.context.agent_type')
  work_item_id=$(echo "$input" | jq -r '.context.work_item_id')
  
  case $agent_type in
    "tester")
      # Analyze test results and decide next state
      if [[ test_results_contain_failures ]]; then
        # Send back to developer
        curl -X PUT http://localhost:3000/api/work-items/$work_item_id/state \
          -d '{"status":"in_progress","assigned_to":"developer"}'
      else
        # Mark as done
        curl -X PUT http://localhost:3000/api/work-items/$work_item_id/state \
          -d '{"status":"done"}'
      fi
      ;;
  esac
  ```
- Hook can execute shell commands (curl) to call API endpoints
- Pass agent context (type, work_item_id) to hooks via environment or input
- Reference: https://docs.anthropic.com/en/docs/claude-code/hooks#stop

**Testing Requirements:**
- Unit tests: Hook script logic and API calls
- Tests: `tests/hooks/stop-hook.test.ts`
  - ✅ Should parse agent context from hook input
  - ✅ Should call PUT /api/work-items/:id/state with correct parameters
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
- Use API endpoints: GET /api/work-items/:id/task-details, PUT /api/work-items/:id/execution-result
- Add execution logging and error handling

**Testing Requirements:**
- Unit tests: Agent execution and API interaction
- Tests: `src/services/work-items/agent-executor.test.ts`
  - ✅ Should call GET /api/work-items/:id/task-details to get work details
  - ✅ Should execute appropriate agent (developer/architect/tester) with task details
  - ✅ Should call PUT /api/work-items/:id/execution-result to store results
  - ✅ Should handle agent execution failures gracefully
  - ✅ Should handle API call failures gracefully
  - ✅ Should pass correct task context to agents

## Implementation Order

1. **Foundation** (US-001): Database schema
2. **API Layer** (US-002): REST API endpoints (everything else uses this)
3. **System Services** (US-003, US-004): Agent initialization and scheduler (using API)
4. **Work Types** (US-005, US-006): Epic and user story handlers (using API)
5. **Automation** (US-007): Claude Code hooks (using API)
6. **Integration** (US-008): Connect to agent implementations (using API)

## Open Questions

1. **Work Item Creation**: How are initial work items created? Via API, CLI, or seeded data?
2. **Bug Handling**: Bugs are mentioned in the schema but not in the workflow. Who handles bugs?
3. **Review Process**: Who performs reviews when user stories enter 'review' state?
4. **Failure Handling**: What happens if an agent fails to process a work item?
5. **Work Prioritization**: Should we implement priority ordering for work assignment?

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|---------|------------|
| Database locking under high concurrency | Work assignment failures | Use WAL mode, implement retry logic |
| Agent crashes during work | Work items stuck in progress | Timeout mechanism, health checks |
| Hook failures | Inconsistent state | Transaction rollbacks, state validation |
| Circular parent-child relationships | Infinite loops | Add validation, depth limits |

## Testing Strategy Summary

### **API-First Testing Approach**
All business logic and database operations are tested comprehensively in the API integration tests (23 test cases). Other components have simplified unit tests that only verify correct API usage.

### **Testing Distribution:**
- **API Layer** (US-002): 23 comprehensive integration tests covering all business logic
- **Service Layer** (US-003,004,005,006,007,008): 18 focused unit tests verifying API calls
- **Database Layer** (US-001): 2 constraint validation tests

**Total: 43 test cases** with clear separation of concerns and no duplication of business logic testing.

### **Benefits:**
- **Single Source of Truth**: All business logic tested in one place (API)
- **Fast Unit Tests**: Service tests mock API calls, run quickly
- **Clear Boundaries**: Each layer tests only its responsibilities
- **Maintainable**: Changes to business logic only require updating API tests

## Success Metrics

- **Assignment Latency**: < 10 seconds from work creation to assignment
- **State Consistency**: 100% valid state transitions
- **Agent Utilization**: > 80% of agents actively working
- **System Uptime**: > 99.9% scheduler availability