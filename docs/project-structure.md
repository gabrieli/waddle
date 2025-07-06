# Project Structure Guide

## Core/Shell Architecture

This project follows the **Core/Shell architecture** pattern to achieve clear separation between pure business logic and side effects, enabling better testability and maintainability.

## Directory Structure

```
src/
├── core/              # Pure business logic
│   ├── agents/        # Agent prompt preparation and orchestration
│   ├── workflows/     # Pure workflow orchestration
│   ├── domain/        # Domain models and business rules
│   ├── repositories/  # Repository interfaces (when needed)
│   └── validation/    # Input validation logic
├── io/                # All side effects
│   ├── clients/       # External API clients (Claude, GitHub, etc.)
│   ├── db/            # Database infrastructure (connection, migrations, config)
│   ├── repositories/  # Data persistence implementations (when needed)
│   ├── http/          # HTTP server and routes
│   ├── fs/            # File system operations
│   └── config/        # Configuration management
├── lib/               # Utilities
│   ├── fp/            # Functional programming utilities (pipe, compose)
│   ├── result/        # Result type for error handling
│   ├── types/         # TypeScript type definitions
│   └── test/          # Test utilities and fixtures
└── index.js           # Composition root

docs/                  # Documentation
scripts/               # Build and utility scripts
```

## Core/IO Architecture Principles

### Core Layer (`src/core/`)
The core contains **pure business logic** with no side effects:
- **Agents**: Prompt preparation and pure orchestration logic
- **Domain models**: Business entities and rules
- **Workflows**: Pure workflow orchestration
- **Validation**: Input validation without I/O
- **Deterministic**: Same input always produces same output
- **Testable**: Easy to unit test with no mocks needed

```typescript
// ✅ Good - Pure agent prompt preparation
export function prepareDeveloperPrompt(task: DeveloperTask, context: ProjectContext): Prompt {
  const taskDescription = formatTaskDescription(task);
  const contextInfo = extractRelevantContext(context);
  return combinePromptElements(taskDescription, contextInfo);
}

// ✅ Good - Pure workflow orchestration
export function planDevelopmentWorkflow(requirements: Requirements): WorkflowPlan {
  const validatedReqs = validateRequirements(requirements);
  const tasks = decomposeTasks(validatedReqs);
  return optimizeTaskOrder(tasks);
}
```

### IO Layer (`src/io/`)
The IO layer handles **all side effects** and external interactions:
- **Clients**: External API integrations (Claude, GitHub, etc.)
- **Database**: Data persistence operations
- **HTTP**: Server endpoints and middleware
- **File System**: File operations
- **Config**: Environment and configuration management

```typescript
// ✅ Good - Side effects in IO layer
export async function executeAgentTask(prompt: Prompt): Promise<AgentResult> {
  await logger.logTaskStart(prompt.id);
  const response = await claudeClient.generateResponse(prompt); // Side effect
  await taskRepository.saveResult(response); // Side effect
  return response;
}
```

### Repository Pattern (Future)
When the need arises for data persistence beyond simple database setup:

**Core Layer** defines repository interfaces:
```typescript
// src/core/repositories/work-item-repository.ts
export interface WorkItemRepository {
  findById(id: number): Promise<WorkItem | null>;
  findAssignable(type: WorkItemType, status: WorkItemStatus): Promise<WorkItem[]>;
  create(workItem: CreateWorkItemRequest): Promise<WorkItem>;
  assign(id: number, agentId: number, version: number): Promise<boolean>;
}
```

**IO Layer** implements concrete repositories:
```typescript
// src/io/repositories/sqlite-work-item-repository.ts
export class SQLiteWorkItemRepository implements WorkItemRepository {
  constructor(private db: Database) {}
  
  async findById(id: number): Promise<WorkItem | null> {
    // SQLite-specific query implementation
  }
  // ... other methods
}
```

**Current State**: 
- `src/io/db/` contains database infrastructure (connection, migrations)
- Repository pattern will be added when query complexity justifies it
- Keep it simple until the need is clear

### Lib Layer (`src/lib/`)
Shared utilities and foundational code:
- **FP**: Functional programming utilities (pipe, compose, curry)
- **Result**: Result type for functional error handling
- **Types**: TypeScript definitions used across layers
- **Test**: Testing utilities and fixtures

### Organization Principles

**Clear layer boundaries:**
- ✅ `core/agents/`, `io/clients/`, `lib/fp/`
- ❌ Mixing pure and impure code in same directory

**Co-locate related functionality:**
- Keep tests alongside their modules
- Group domain concepts together
- Maintain feature cohesion

**Growth guidelines:**
- **Start simple**: Create subdirectories only when needed (3+ related files)
- **Domain-driven**: Organize by business domain, not technical concerns
- **Shallow nesting**: Maximum 3 levels deep (`src/core/agents/developer.ts`)

## Functional Programming in Core/IO

### Core Layer Guidelines
- **Pure functions only**: No I/O, logging, or external calls
- **Immutable data**: Prefer immutable operations
- **Composable**: Small functions that combine well
- **Single responsibility**: Each function has one clear purpose

```typescript
// ✅ Good - Pure core function
export function calculateTaskPriority(task: Task, context: ProjectContext): Priority {
  const urgencyScore = calculateUrgency(task.deadline, context.currentDate);
  const impactScore = calculateImpact(task.dependencies, context.tasks);
  return combinePriorityScores(urgencyScore, impactScore);
}

// ✅ Good - Pure agent prompt preparation
export function prepareArchitectPrompt(requirements: Requirements): ArchitectPrompt {
  const structuredReqs = structureRequirements(requirements);
  const designConstraints = extractConstraints(requirements);
  return buildArchitectPrompt(structuredReqs, designConstraints);
}

// ❌ Bad - Side effects in core
export function calculateTaskPriorityWithLog(task: Task): Priority {
  console.log('Calculating priority...'); // Side effect!
  return task.priority;
}
```

### IO Layer Guidelines
- **Handle all side effects**: I/O, API calls, logging, mutations
- **Depend on core**: Use core functions for business logic
- **Error boundaries**: Proper error handling and recovery

```typescript
// ✅ Good - IO orchestrating core logic with side effects
export async function processDevelopmentTask(taskId: string): Promise<TaskResult> {
  const task = await taskRepository.findById(taskId); // Side effect
  const priority = calculateTaskPriority(task, await getProjectContext()); // Core logic
  
  await taskLogger.logProcessingStart(taskId); // Side effect
  const prompt = prepareDeveloperPrompt(task, priority); // Core logic
  const result = await claudeClient.execute(prompt); // Side effect
  await taskRepository.save(result); // Side effect
  
  return result;
}
```

## File Organization

### Naming Conventions
- **Files**: kebab-case (`user-service.ts`, `email-validator.ts`)
- **Functions**: camelCase (`validateEmail`, `processPayment`)
- **Types**: PascalCase (`UserData`, `PaymentResult`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_BASE_URL`, `DEFAULT_TIMEOUT`)

### Module Structure
```typescript
// Each module exports focused functionality
export { validateEmail, normalizeEmail } from './email-validator';
export { calculateTax, formatCurrency } from './financial-utils';
export type { EmailValidationResult } from './types';
```

### Import/Export Patterns
```typescript
// ✅ Explicit named exports
export function processOrder(order: Order): OrderResult { }
export function validateOrder(order: Order): ValidationResult { }

// ✅ Grouped imports
import { validateEmail, normalizeEmail } from '../utils/email-validator';
import { logError, logInfo } from '../services/logger';
import type { User, Order, ValidationResult } from '../types';

// ❌ Avoid default exports for better refactoring
```

## Testing Structure

### Test Categories
- **Unit Tests**: `*.test.ts` - Pure function tests, fast execution
- **Integration Tests**: `*.integration.test.ts` - External dependencies, slower
- **Test Scripts**:
  - `npm test` - Unit tests only
  - `npm run test:integration` - Integration tests only
  - `npm run test:all` - All tests

### Test Organization
```typescript
// Co-located tests
src/
├── utils/
│   ├── email-validator.ts
│   └── email-validator.test.ts
├── clients/
│   ├── claude.ts
│   └── claude.integration.test.ts
```

## Data Flow Architecture

### Core/IO Data Flow
```
Input → IO (validation) → Core (business logic) → IO (side effects) → Output
```

1. **Input handling**: IO receives and validates input
2. **Business logic**: Core processes data with pure functions
3. **Side effects**: IO executes I/O operations
4. **Output**: IO formats and returns results

### Example Flow
```typescript
// IO: Input validation and orchestration
export async function handleCreateProject(request: CreateProjectRequest): Promise<ProjectResponse> {
  const validatedData = validateProjectRequest(request); // Could be core if pure
  
  // Core: Business logic
  const projectPlan = createProjectPlan(validatedData);
  const taskBreakdown = generateTaskBreakdown(projectPlan);
  const agentPrompts = prepareAgentPrompts(taskBreakdown);
  
  // IO: Side effects
  const savedProject = await projectRepository.save(projectPlan);
  const agentResults = await claudeClient.executeBatch(agentPrompts);
  await notificationService.notifyTeam(savedProject);
  
  return formatProjectResponse(savedProject, agentResults);
}

### Error Handling
```typescript
// Functional error handling with Result types
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export function validateUser(userData: unknown): Result<User, ValidationError> {
  // Pure validation logic
}

export async function saveUser(user: User): Promise<Result<UserId, SaveError>> {
  // Side effect with error handling
}
```

## Development Guidelines

### For Architects
- Design core interfaces as pure functions first
- Keep all side effects in shell layer
- Define clear contracts between core and shell
- Plan for testability and composability
- **Update this documentation when changing architecture**

### For Developers
- **Core**: Write pure functions only - no I/O, no mutations
- **IO**: Handle all side effects and external interactions
- **Lib**: Create reusable utilities and type definitions
- Test core with fast unit tests (no mocks needed)
- Test IO with integration tests for side effects
- **Organize by domain when you have 3+ related files**

### Documentation Maintenance
- **Always update this file when modifying the structure**
- Document new subdirectories and their purpose
- Keep examples current with actual implementation
- Update the directory tree when adding new areas

## Layer Dependencies

```
┌─────────────┐    ┌─────────────┐
│     IO      │───▶│    Core     │
│             │    │             │
│ • Clients   │    │ • Agents    │
│ • Database  │    │ • Domain    │
│ • HTTP      │    │ • Workflows │
│ • Config    │    │ • Validation│
│ • FS        │    │             │
└─────────────┘    └─────────────┘
       │                  │
       ▼                  ▼
┌─────────────────────────────────┐
│            Lib                  │
│                                 │
│ • FP  • Result  • Types  • Test │
└─────────────────────────────────┘
```

**Dependency Rules:**
- **Core**: Can only depend on lib (types, pure utils)
- **IO**: Can depend on core and lib
- **Lib**: Self-contained, minimal external dependencies

## Speculative Evolution (When Needed)

As the project grows, consider these extensions:

### Advanced Core Structure
```
src/core/
├── domain/
│   ├── project/     # Project management domain
│   ├── task/        # Task management domain
│   └── agent/       # Agent behavior domain
├── workflows/
│   ├── development/ # Development workflows
│   ├── testing/     # Testing workflows
│   └── deployment/  # Deployment workflows
└── policies/        # Business rules and policies
```

### Advanced IO Structure
```
src/io/
├── adapters/        # External service adapters
├── repositories/    # Data persistence adapters
├── events/          # Event handling and messaging
└── infrastructure/  # Platform-specific code
```

### When to Evolve
- **5+ files in a directory**: Consider subdirectories
- **Complex domains emerge**: Split into focused modules
- **Integration complexity**: Add adapter layers
- **Cross-cutting concerns**: Add infrastructure layer

This architecture promotes:
- **Testability**: Core is pure, IO is isolated
- **Maintainability**: Clear separation of concerns
- **Flexibility**: Easy to swap IO implementations
- **Performance**: Fast core tests, targeted integration tests