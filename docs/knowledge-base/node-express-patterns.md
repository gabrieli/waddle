# Node.js Express Patterns

**Last Updated**: 2025-01-17

## Project Structure
```
src/
├── routes/          # Route handlers
├── middleware/      # Custom middleware
├── services/        # Business logic
├── models/          # Data models
└── utils/           # Utilities
```

## Route Organization

**Resource-Based Routes**:
```javascript
// routes/users.js
const express = require('express');
const router = express.Router();

router.get('/', getAllUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
```

**Route Registration**:
```javascript
// app.js
app.use('/api/users', require('./routes/users'));
app.use('/api/orders', require('./routes/orders'));
```

## Error Handling

**Error Middleware**:
```javascript
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

app.use(errorHandler);
```

**Async Error Handling**:
```javascript
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/:id', asyncHandler(async (req, res) => {
    const user = await getUserById(req.params.id);
    res.json(user);
}));
```

## Middleware Patterns

**Validation Middleware**:
```javascript
const validateUser = (req, res, next) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email required' });
    }
    next();
};
```

**Authentication Middleware**:
```javascript
const authenticate = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    // Verify token logic
    next();
};
```

## Best Practices
- Use express.Router() for modular routes
- Implement proper error handling
- Validate input data
- Use middleware for cross-cutting concerns
- Keep route handlers thin