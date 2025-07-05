# State Machine Patterns

**Last Updated**: 2025-01-17

## Core Concepts

**State**: Current condition of the system
**Transition**: Moving from one state to another
**Event**: Trigger that causes a transition
**Guard**: Condition that must be met for transition

## Simple State Machine

```javascript
const workItemStateMachine = {
    states: {
        new: { transitions: ['in_progress'] },
        in_progress: { transitions: ['review', 'done'] },
        review: { transitions: ['in_progress', 'done'] },
        done: { transitions: [] }
    },
    
    canTransition(currentState, targetState) {
        return this.states[currentState]?.transitions.includes(targetState);
    },
    
    transition(currentState, targetState) {
        if (!this.canTransition(currentState, targetState)) {
            throw new Error(`Invalid transition: ${currentState} -> ${targetState}`);
        }
        return targetState;
    }
};
```

## Event-Driven State Machine

```javascript
const createWorkItemMachine = (initialState = 'new') => {
    let currentState = initialState;
    
    const events = {
        START: (state) => state === 'new' ? 'in_progress' : null,
        COMPLETE: (state) => state === 'in_progress' ? 'done' : null,
        REVIEW: (state) => state === 'in_progress' ? 'review' : null,
        REJECT: (state) => state === 'review' ? 'in_progress' : null,
        APPROVE: (state) => state === 'review' ? 'done' : null
    };
    
    return {
        getCurrentState: () => currentState,
        
        send(event) {
            const nextState = events[event]?.(currentState);
            if (nextState) {
                currentState = nextState;
                return true;
            }
            return false;
        }
    };
};
```

## Database State Management

```sql
-- State tracking table
CREATE TABLE work_items (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'review', 'done')),
    previous_status TEXT,
    status_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- State transition log
CREATE TABLE state_transitions (
    id INTEGER PRIMARY KEY,
    work_item_id INTEGER,
    from_state TEXT,
    to_state TEXT,
    event TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_item_id) REFERENCES work_items(id)
);
```

## Benefits
- Predictable behavior
- Clear business rules
- Easy to test and debug
- Prevents invalid states
- Audit trail of changes

## Use Cases
- Workflow management
- User interface states
- Order processing
- Game states
- Authentication flows