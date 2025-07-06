# EPIC-002: Task-Based Workflow Implementation

## Epic Overview
Transform the current user story workflow into a task-based system where each user story spawns a chain of tasks (development → testing → code review → done), with automatic task generation based on agent outputs.

## Background
Currently, user stories move back and forth between different statuses. This epic implements a new approach where:
- Each user story starts with 1 development task
- Tasks generate summaries when completed
- Hooks or agents automatically generate subsequent tasks
- User stories are marked done when all tasks complete successfully

## Architecture Design

### 1. Task Entity Model
```typescript
interface Task {
  id: string;
  user_story_id: string;        // Reference to parent user story
  parent_task_id?: string;       // Reference to previous task in chain
  type: 'development' | 'testing' | 'review';
  status: 'new' | 'in_progress' | 'done';        
  summary?: string;              // Markdown summary from agent
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  metadata?: Record<string, any>; // For storing task-specific data
}
```

### 2. Simplified User Story Model
```typescript
interface UserStory {
  id: string;
  title: string;
  description: string;
  done: boolean;                 // Only tracking completion
  epic_id?: string;
  created_at: Date;
  completed_at?: Date;
}
```

### 3. Task Generation Flow
```
User Story Created → Development Task
    ↓ (on completion)
Development Task → Testing Task
    ↓ (on completion)
Testing Task → Code Review Task (if tests pass)
         ↓                  ↓ (if tests fail)
         ↓              New Development Task
         ↓
Code Review Task → Done (if approved)
         ↓ (if improvements needed)
    New Development Task
```

## Implementation Approach

### Phase 1: Core Task System
1. **Database Schema**
   - Create `tasks` table with proper relationships
   - Simplify `work_items` table (remove agent/locking fields)
   - Add indexes for efficient querying

2. **Domain Models**
   - Implement Task domain model
   - Update WorkItem model to simplified version
   - Create TaskFactory for task generation

3. **Task Assignment Rules**
   - Development tasks → developers
   - Testing tasks → testers
   - Code review tasks → architects (initially)

### Phase 2: Agent Integration
1. **Agent Output Processing**
   - Parse agent summaries for task completion
   - Extract success/failure indicators
   - Store summaries in database

2. **Hook Integration Options**
   - **Option A**: Use Claude Code hooks to call REST APIs
   - **Option B**: Have agents directly create next tasks
   - Config flag to enable/disable automatic task generation

3. **Task Generation Service**
   - Rule-based task creation based on previous task outcome
   - Handle edge cases (parallel issues, retries)

### Phase 3: Scheduler Updates
1. **Task-Based Assignment**
   - Update scheduler to work with tasks instead of work items
   - **Developer Pool Management**: Scheduler only manages developer capacity (X developers = X concurrent development tasks)
   - **Unlimited Capacity**: Testing and review tasks start immediately without capacity constraints
   - Non-development tasks bypass the scheduler queue

2. **Task Completion Workflow**
   - Mark task as completed
   - Generate summary
   - Trigger next task creation

## Technical Decisions

### 1. State Management
- Tasks are immutable once completed
- No state transitions within tasks (only the status moves and acts as lock)
- User story completion determined by task chain completion

### 2. Hook vs Direct Creation
- Start with direct agent creation for simplicity
- Add hook support as enhancement
- Use config flag for flexibility

### 3. Error Handling
- Failed tasks spawn new development tasks
- Maintain task chain integrity
- Log all task transitions

### 4. Key Design Principles
- Tasks never go backwards in the flow
- Each task has exactly one outcome
- Summaries are write-once, never updated
- Clear parent-child relationships between tasks
- Small, incremental, testable changes
- Start simple: developer → tester → reviewer flow

## Migration Strategy
1. Keep existing system running
2. Implement new task system alongside
3. Add feature flag for task-based workflow
4. Migrate incrementally

## Success Criteria
- User stories automatically progress through task chain
- No manual status updates required
- Clear audit trail via task summaries
- Reduced back-and-forth between statuses
- Hooks can trigger automated task generation
- Support for multiple concurrent agents per role

## User Stories

### US-001: Core Task System and Database Setup
As a system architect, I want to implement the core task entity and database schema so that we can track tasks separately from work items.

**Acceptance Criteria:**
- Tasks table created with all required fields
- Task domain model implemented
- Database migrations created and tested

### US-002: Developer Task Completion with Test Generation
As a developer agent, I want to complete a simple development task, update the summary, and automatically create a testing task.

**Acceptance Criteria:**
- Developer can pick up a development task
- Task summary is saved when work completes
- Testing task is automatically created with reference to parent
- Integration test proves the flow works end-to-end

### US-003: Tester Task Completion Flow
As a tester agent, I want to complete testing tasks and generate appropriate follow-up tasks based on test results.

**Acceptance Criteria:**
- Tester can pick up testing tasks immediately (no capacity limit)
- If tests pass: create review task
- If tests fail: create new development task
- Test summaries are properly stored

### US-004: Reviewer Task Completion Flow
As a reviewer agent, I want to complete review tasks and determine the next action based on review outcome.

**Acceptance Criteria:**
- Reviewer can pick up review tasks immediately (no capacity limit)
- If approved: mark user story as done
- If improvements needed: create new development task
- Review feedback is captured in summary

### US-005: Scheduler Pool Management
As a system administrator, I want the scheduler to respect developer capacity while allowing unlimited testing and review tasks.

**Acceptance Criteria:**
- Scheduler only queues development tasks based on developer count
- Testing and review tasks start immediately when created
- Configuration supports variable developer pool size

### US-006: Task Assignment and Scheduling
As a system administrator, I want the scheduler to automatically assign tasks to appropriate agents based on task type.

### US-007: Hook System Integration
As a system administrator, I want to configure whether task generation happens via Claude Code hooks or direct agent actions.

### US-008: User Story Simplification
As a project manager, I want user stories to only track completion status without complex state transitions.

## Open Questions
1. How should we handle tasks that need human intervention?
2. Should we support custom task types beyond development/testing/code_review?
3. How do we handle task timeouts or abandoned tasks?
4. Should task summaries be searchable/indexed?

## Dependencies
- Existing work item system
- Agent system
- Scheduler system
- Claude Code hooks (optional)

## Risks
- Breaking changes to existing workflow
- Agent output parsing complexity
- Hook reliability and error handling
- Performance impact of task chains

## Timeline Estimate
- Phase 1 (Core Task System): 1 week
- Phase 2 (Agent Integration): 1 week
- Phase 3 (Scheduler Updates): 3-4 days
- Testing and Migration: 3-4 days

Total: ~3 weeks