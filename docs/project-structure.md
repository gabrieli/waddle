# Project Structure Guide

## Directory Structure

```
src/
├── core/           # Pure business logic functions
├── services/       # Side effects, external integrations
│   ├── agents/     # AI agents and autonomous services
│   ├── database/   # Database operations
│   ├── auth/       # Authentication services
│   └── ...         # Other service categories
├── clients/        # External API/CLI clients
│   ├── claude/     # Claude-specific clients
│   ├── github/     # GitHub API clients
│   └── ...         # Other external service clients
├── utils/          # Utility functions (pure)
│   ├── validation/ # Input validation utilities
│   ├── formatting/ # Data formatting utilities
│   └── ...         # Other utility categories
├── types/          # TypeScript type definitions
├── config/         # Configuration management
└── server/         # Server/HTTP layer
    ├── routes/     # Route handlers
    ├── middleware/ # Express middleware
    └── ...         # Other server components

tests/              # Test utilities and fixtures
docs/               # Documentation
scripts/            # Build and utility scripts
```

### Subdirectory Organization Principles

**Organize by domain, not by file type:**
- ✅ `services/agents/`, `services/auth/`, `services/database/`
- ❌ `services/interfaces/`, `services/implementations/`

**Keep related files together:**
- Co-locate tests with their modules
- Group related utilities in subdirectories
- Maintain feature cohesion within directories

**When to create subdirectories:**
- **3+ related files**: Create subdirectory when you have 3 or more files serving the same domain
- **Clear boundaries**: When functionality has distinct boundaries (auth, database, agents)
- **Growth expectation**: When you expect the area to grow significantly
- **Avoid deep nesting**: Maximum 3 levels deep (`src/services/agents/developer.ts`)

### Agents Directory (`src/services/agents/`)

Agents are autonomous services that:
- Execute complex workflows
- Make decisions based on context
- Coordinate multiple operations
- Have side effects (API calls, file operations, etc.)

**Agent Categories:**
- **Developer Agent**: Code generation, testing, debugging
- **Architect Agent**: System design, structure planning
- **QA Agent**: Testing, validation, quality assurance
- **Manager Agent**: Workflow coordination, task delegation

**Agent Structure:**
```typescript
// src/services/agents/developer.ts
export async function executeTask(task: DeveloperTask): Promise<TaskResult> {
  // Agent implementation with side effects
}

// src/services/agents/developer.test.ts
// Co-located tests for the agent
```

## Functional Programming Principles

### Pure Functions (src/core/)
- **No side effects**: Functions should not mutate external state
- **Deterministic**: Same input always produces same output
- **Composable**: Functions should be easily combinable
- **Single responsibility**: Each function does one thing well

```typescript
// ✅ Good - Pure function
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Bad - Side effects
export function calculateTotalWithLog(items: Item[]): number {
  console.log('Calculating total...'); // Side effect
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Side Effects (src/services/, src/clients/)
- **Isolated**: All I/O, logging, external calls go here
- **Testable**: Return promises or use dependency injection
- **Error handling**: Proper error boundaries and recovery

```typescript
// ✅ Good - Side effects isolated
export async function saveUserData(userData: UserData): Promise<void> {
  await database.users.insert(userData);
  await auditLogger.log('USER_CREATED', userData.id);
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

### Functional Composition
```
Input → Pure Functions (core) → Side Effects (services) → Output
```

1. **Input validation** (utils)
2. **Business logic** (core) - pure functions
3. **External operations** (services/clients)
4. **Response formatting** (utils)

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
- Design pure function interfaces first
- Isolate side effects to service boundaries
- Define clear type contracts
- Plan composition patterns
- **Update this documentation when changing project structure**

### For Developers
- Write pure functions in `src/core/`
- Put side effects in `src/services/` or `src/clients/`
- Test pure functions with unit tests
- Test side effects with integration tests
- Follow single responsibility principle
- Prefer composition over inheritance
- **Organize files into subdirectories by domain when you have 3+ related files**
- **Update project structure documentation when adding new directories**

### Documentation Maintenance
- **Always update this file when modifying the directory structure**
- Document new subdirectories and their purpose
- Update examples to reflect current structure
- Keep the tree structure in sync with actual project layout

## Dependencies
- **Core modules**: No dependencies on services/clients
- **Services**: Can depend on core and utils
- **Clients**: Can depend on core and utils
- **Utils**: Self-contained, minimal dependencies

This structure promotes:
- **Testability**: Pure functions are easy to test
- **Maintainability**: Clear separation of concerns
- **Reusability**: Composable functions
- **Performance**: Fast unit tests, isolated integration tests