# Environment Separation and Setup

## Overview

The Waddle project uses environment-based configuration to separate development, testing, and production concerns. This ensures that tests run in isolation, development doesn't interfere with production data, and each environment has appropriate settings.

## Environment Detection

### How It Works

Environment detection is based on the `NODE_ENV` environment variable:

```typescript
// In src/io/db/database.ts:12-13
const environment = process.env.NODE_ENV === 'test' ? 'test' : 'local';
```

### Environment Types

- **`test`**: When `NODE_ENV=test` is set
- **`local`**: Default for all other cases (development, production, etc.)

## Database Configuration

### Current Implementation

Located in `src/io/db/database.ts`:

```typescript
export function getDatabaseConfig(): DatabaseConfig {
  const environment = process.env.NODE_ENV === 'test' ? 'test' : 'local';
  
  const config: DatabaseConfig = {
    environment,
    path: environment === 'test' 
      ? ':memory:' // Use in-memory database for tests
      : join(process.cwd(), 'data', 'waddle-local.db')
  };

  return config;
}
```

### Database Paths by Environment

| Environment | Database Path | Type | Purpose |
|-------------|---------------|------|---------|
| **test** | `:memory:` | In-memory SQLite | Fast, isolated test execution |
| **local** | `./data/waddle-local.db` | File-based SQLite | Development and production |

### Database Settings by Environment

#### Test Environment
- **Path**: `:memory:` (in-memory database)
- **WAL Mode**: Disabled (not applicable for in-memory)
- **Foreign Keys**: Enabled
- **Synchronous Mode**: Not explicitly set (uses SQLite defaults)
- **Benefits**: 
  - Fastest possible execution
  - Complete isolation between test runs
  - No cleanup required
  - No file system dependencies

#### Local Environment  
- **Path**: `./data/waddle-local.db` (file-based)
- **WAL Mode**: Enabled (better concurrency)
- **Foreign Keys**: Enabled
- **Synchronous Mode**: NORMAL (balance of safety and speed)
- **Benefits**:
  - Persistent data across sessions
  - Better concurrency with WAL mode
  - Production-like behavior

## Setting Up Environments

### Running Tests (Automatic)

Tests automatically use the test environment via npm scripts:

```bash
# These commands automatically set NODE_ENV=test
npm run test           # All unit tests
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests only
npm run test:all       # Both unit and integration tests
```

**Implementation in package.json:**
```json
{
  "test:unit": "env NODE_ENV=test find src -name '*.test.ts' -not -name '*.integration.test.ts' | xargs env NODE_ENV=test node --test --experimental-strip-types"
}
```

### Manual Environment Control

You can manually control the environment:

```bash
# Force test environment
NODE_ENV=test node src/server.js

# Force local environment (default)
NODE_ENV=local node src/server.js
# or simply
node src/server.js
```

### Verifying Environment Configuration

To check which environment and database configuration is active:

```typescript
import { getDatabaseConfig } from './src/io/db/database.ts';

const config = getDatabaseConfig();
console.log('Environment:', config.environment);
console.log('Database path:', config.path);
```

**Expected Output:**
```
// With NODE_ENV=test
Environment: test
Database path: :memory:

// With NODE_ENV=local or unset
Environment: local  
Database path: /Users/username/projects/waddle/data/waddle-local.db
```

## Database Initialization

### Singleton Pattern

The database uses a singleton pattern to ensure one instance per process:

```typescript
// In src/io/db/index.ts
let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    return initializeDatabase();
  }
  return dbInstance;
}
```

### Initialization Flow

1. **Environment Detection**: Check `NODE_ENV` to determine configuration
2. **Database Creation**: Create SQLite database (file or in-memory)
3. **Migration Execution**: Run schema migrations to current version
4. **Configuration**: Apply environment-specific SQLite settings

### Test Environment Reset

For tests, use `resetDatabase()` to get a fresh database instance:

```typescript
import { resetDatabase } from './src/io/db/index.ts';

// In test setup
beforeEach(() => {
  resetDatabase(); // Clean slate for each test
});
```

## Logging by Environment

### Current Behavior

Logging is controlled by the database initialization:

- **Test Environment**: Minimal logging (only migration info)
- **Local Environment**: Full logging including initialization details

**Log Examples:**

```bash
# Test environment logs
Running migration 1: initial_schema
Database schema up to date (version 1)

# Local environment logs  
Initializing local database at /Users/.../waddle/data/waddle-local.db
Running migration 1: initial_schema
Database schema up to date (version 1)
Database initialized successfully for local environment
```

## File Structure

```
src/io/
├── db/
│   ├── index.ts          # Main database interface & singleton
│   ├── database.ts       # Environment configuration (ACTIVE)
│   └── migrations.ts     # Schema migrations
├── config/
│   └── database.ts       # Unused configuration file (LEGACY)
└── repositories/
    └── *.ts              # Repository implementations
```

## Best Practices

### For Development
- Use default environment (no NODE_ENV needed)
- Database persists in `./data/waddle-local.db`
- Check this file into `.gitignore` to avoid committing data

### For Testing
- Always use npm scripts (they set NODE_ENV automatically)
- Don't set NODE_ENV manually for tests
- Use `resetDatabase()` in test setup for isolation

### For Production
- Set appropriate NODE_ENV (not 'test')
- Ensure `./data/` directory exists and is writable
- Consider database backup strategies for file-based storage

## Common Issues and Solutions

### Issue: Tests Using Wrong Database
**Symptoms**: Tests show "Initializing local database" instead of "Initializing test database"
**Solution**: Ensure using npm test scripts, not direct node commands

### Issue: Database File Permission Errors
**Symptoms**: EACCES or ENOENT errors when starting server
**Solution**: 
```bash
mkdir -p ./data
chmod 755 ./data
```

### Issue: Tests Interfering with Each Other
**Symptoms**: Test failures that depend on execution order
**Solution**: Use `resetDatabase()` in test setup

### Issue: Database Schema Out of Date
**Symptoms**: SQL errors about missing tables/columns
**Solution**: Migrations run automatically, but check migration files in `src/io/db/migrations.ts`

## Future Considerations

- **Production Environment**: Consider adding explicit production configuration
- **Multiple Test DBs**: For parallel test execution, consider unique database names
- **Configuration Validation**: Add runtime validation of environment settings
- **Environment-Specific Migrations**: Support for environment-specific schema changes