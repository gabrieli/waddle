# Currying Patterns in Functional Programming

## Overview

Currying is a functional programming technique where a function that takes multiple arguments is transformed into a sequence of functions, each taking a single argument. This enables partial application and creates more composable, reusable code.

## Why Use Currying?

### Dependency Injection
Instead of passing dependencies repeatedly:
```typescript
// Without currying - repetitive
clearAllAgents(db, options)
createAgent(db, type)
updateAgent(db, id, data)

// With currying - clean partial application
const agentOps = createAgentOperations(db)
agentOps.clearAll(options)
agentOps.create(type)
agentOps.update(id, data)
```

### Function Composition
Curried functions compose naturally:
```typescript
const processAgents = pipe(
  validateAgents(rules),
  transformAgents(mapper),
  persistAgents(db)
)
```

### Configuration Separation
Separate configuration concerns from business logic:
```typescript
// Configure once
const withDatabase = createDatabaseOperations(db)
const withLogging = createLoggingOperations(logger)

// Use anywhere
const result = withDatabase.findUser(id)
withLogging.info('User found', result)
```

## Implementation Patterns

### Simple Currying
```typescript
// Traditional function
function add(a: number, b: number): number {
  return a + b
}

// Curried version
function curriedAdd(a: number) {
  return function(b: number): number {
    return a + b
  }
}

// Usage
const add5 = curriedAdd(5)
const result = add5(3) // 8
```

### Database Operations Currying
```typescript
// Curry database operations
function createUserOperations(db: Database) {
  return {
    findById: (id: string) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
    create: (userData: UserData) => db.prepare('INSERT INTO users ...').run(userData),
    update: (id: string) => (data: Partial<UserData>) => 
      db.prepare('UPDATE users SET ... WHERE id = ?').run(data, id)
  }
}

// Configure once, use everywhere
const userOps = createUserOperations(database)
const user = userOps.findById('123')
const updateUser = userOps.update('123')
updateUser({ name: 'New Name' })
```

### Arrow Function Currying
```typescript
// Concise arrow function syntax
const createValidator = (rules: ValidationRules) => 
  (data: any): ValidationResult => validate(data, rules)

const createMapper = (schema: Schema) =>
  (input: any): MappedOutput => mapWithSchema(input, schema)

const createPersister = (db: Database) =>
  (entity: Entity): PersistResult => persistToDatabase(entity, db)
```

### Async Currying
```typescript
// Handle async operations
const createAsyncOperations = (config: Config) => ({
  fetchUser: async (id: string): Promise<User> => 
    await apiCall(`/users/${id}`, config),
  
  saveUser: (user: User) => async (): Promise<SaveResult> =>
    await apiCall('/users', { ...config, method: 'POST', body: user }),
    
  updateUser: (id: string) => async (updates: Partial<User>): Promise<User> =>
    await apiCall(`/users/${id}`, { ...config, method: 'PATCH', body: updates })
})
```

## Best Practices

### 1. Curry Dependencies, Not Data
Curry configuration and dependencies (database, config, logger), not the primary data being processed:

```typescript
// Good - curry the dependency
const createUserService = (db: Database) => ({
  findUser: (id: string) => db.query('SELECT * FROM users WHERE id = ?', id),
  createUser: (userData: UserData) => db.query('INSERT INTO users ...', userData)
})

// Avoid - currying the primary data
const findUser = (id: string) => (db: Database) => db.query('...', id)
```

### 2. Use TypeScript for Type Safety
```typescript
// Type-safe currying
function createTypedOperations<T>(db: Database) {
  return {
    find: (id: string): T | null => db.prepare('SELECT * FROM table WHERE id = ?').get(id) as T,
    create: (data: Omit<T, 'id'>): number => db.prepare('INSERT INTO table ...').run(data).lastInsertRowid,
    update: (id: string) => (data: Partial<T>): boolean => 
      db.prepare('UPDATE table SET ... WHERE id = ?').run(data, id).changes > 0
  }
}
```

### 3. Consistent Currying Order
Place stable dependencies first, frequently changing parameters last:

```typescript
// Good - stable deps first, changing data last
const createService = (db: Database) => (logger: Logger) => (config: Config) =>
  (userData: UserData) => processUser(userData, config, logger, db)

// Better - group by stability
const createService = (dependencies: { db: Database, logger: Logger, config: Config }) =>
  (userData: UserData) => processUser(userData, dependencies)
```

### 4. Partial Application Helpers
```typescript
// Utility for easier partial application
const partial = <T extends any[], R>(fn: (...args: T) => R) =>
  <P extends Partial<T>>(...partialArgs: P) =>
    (...remainingArgs: Drop<T, P>) =>
      fn(...partialArgs, ...remainingArgs)

// Usage
const processData = (db: Database, logger: Logger, config: Config, data: Data) => { /* ... */ }
const withDeps = partial(processData)(database, logger, defaultConfig)
const result = withDeps(userData) // Only need to pass data
```

## Common Patterns in Repository Layer

### Repository Operations
```typescript
const createRepositoryOperations = (db: Database) => ({
  // Simple operations
  clearAll: (table: string) => () => 
    db.prepare(`DELETE FROM ${table}`).run().changes,
    
  // Parameterized operations  
  create: (table: string) => (data: Record<string, any>) =>
    db.prepare(`INSERT INTO ${table} ...`).run(data).lastInsertRowid,
    
  // Complex operations with validation
  createWithValidation: (table: string) => (validator: (data: any) => boolean) => 
    (data: Record<string, any>) => {
      if (!validator(data)) throw new Error('Invalid data')
      return db.prepare(`INSERT INTO ${table} ...`).run(data).lastInsertRowid
    }
})
```

This approach makes the repository layer highly composable and testable while maintaining clean separation of concerns.