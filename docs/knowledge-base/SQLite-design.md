# SQLite Database Design

**Last Updated**: 2025-01-17

## Key Characteristics
- Serverless, zero-configuration
- ACID compliant
- Cross-platform file format
- Excellent for embedded applications

## Schema Design

**Primary Keys**: Always use `INTEGER PRIMARY KEY AUTOINCREMENT`
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Foreign Keys**: Enable with `PRAGMA foreign_keys = ON`
```sql
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Constraints**: Use CHECK constraints for validation
```sql
status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'done'))
```

## Performance
- **Indexes**: Create on frequently queried columns
- **WAL Mode**: `PRAGMA journal_mode = WAL` for better concurrency
- **Synchronous**: `PRAGMA synchronous = NORMAL` for production

## Concurrency
- **Read Locks**: Multiple readers can access simultaneously
- **Write Locks**: Only one writer at a time
- **Optimistic Locking**: Use version columns or timestamps

## Best Practices
- Keep schema simple and normalized
- Use transactions for multi-table operations
- Regular `VACUUM` for maintenance
- Backup strategies for production data