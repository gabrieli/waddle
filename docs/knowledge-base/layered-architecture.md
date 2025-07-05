# Layered Architecture (Core/Shell Pattern)

**Last Updated**: 2025-01-17

## Core Concept
Separate business logic (Core) from infrastructure concerns (Shell/IO).

## Layer Structure

**Core Layer**:
- Pure business logic
- Domain models
- No external dependencies
- Easily testable

**Shell/IO Layer**:
- Database operations
- HTTP requests/responses
- File system operations
- External API calls

## Example Structure
```
src/
├── core/
│   ├── domain/          # Entities, value objects
│   └── workflows/       # Business logic
├── io/
│   ├── db/             # Database operations
│   ├── http/           # API routes
│   └── scheduler/      # External integrations
└── lib/
    ├── fp/             # Functional programming utilities
    └── result/         # Error handling
```

## Benefits
- **Testability**: Core logic tests run fast (no I/O)
- **Maintainability**: Clear separation of concerns
- **Flexibility**: Easy to swap infrastructure
- **Reliability**: Business logic independent of external systems

## Implementation Pattern
```javascript
// Core - pure business logic
const assignWorkItem = (workItem, agent) => {
    if (workItem.status !== 'new') {
        return { error: 'Work item not available' };
    }
    return { 
        success: true, 
        assignment: { workItemId: workItem.id, agentId: agent.id }
    };
};

// Shell - orchestrates I/O
const assignWorkItemHandler = async (workItemId, agentId) => {
    const workItem = await db.getWorkItem(workItemId);
    const agent = await db.getAgent(agentId);
    
    const result = assignWorkItem(workItem, agent);
    
    if (result.success) {
        await db.updateWorkItem(result.assignment);
    }
    
    return result;
};
```

## Testing Strategy
- Core: Fast unit tests with pure functions
- Shell: Integration tests with real infrastructure
- Composition: End-to-end tests