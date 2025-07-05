# Optimistic Locking Patterns

**Last Updated**: 2025-01-17

## Concept
Assume conflicts are rare, check for conflicts before committing changes.

## Implementation Strategies

**Version Column**:
```sql
CREATE TABLE work_items (
    id INTEGER PRIMARY KEY,
    data TEXT,
    version INTEGER DEFAULT 1
);

-- Update with version check
UPDATE work_items 
SET data = ?, version = version + 1 
WHERE id = ? AND version = ?;
```

**Timestamp-Based**:
```sql
CREATE TABLE agents (
    id INTEGER PRIMARY KEY,
    work_item_id INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Check if record was modified
SELECT updated_at FROM agents WHERE id = ?;
-- Update only if timestamp matches
UPDATE agents SET work_item_id = ? WHERE id = ? AND updated_at = ?;
```

**Application-Level**:
```javascript
// Read current state
const current = await db.get('SELECT * FROM work_items WHERE id = ?', [id]);

// Check if available for assignment
if (current.agent_id !== null) {
    throw new Error('Work item already assigned');
}

// Atomic update
const result = await db.run(
    'UPDATE work_items SET agent_id = ? WHERE id = ? AND agent_id IS NULL',
    [agentId, id]
);

if (result.changes === 0) {
    throw new Error('Assignment failed - item taken by another agent');
}
```

## Benefits
- Better performance than pessimistic locking
- Reduces deadlocks
- Scales well with low conflict rates

## When to Use
- Web applications
- Distributed systems
- High-concurrency scenarios with rare conflicts