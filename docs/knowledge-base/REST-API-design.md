# REST API Design

**Last Updated**: 2025-01-17

## Core Principles

**Resource-Based URLs**: Use nouns, not verbs
- ✅ `/api/users` not `/api/getUsers`
- ✅ `/api/orders/{id}` not `/api/order?id=123`

**HTTP Methods**:
- `GET` - Retrieve (idempotent, no side effects)
- `POST` - Create new resources
- `PUT` - Replace entire resource
- `PATCH` - Partial updates
- `DELETE` - Remove resources

**URL Structure**: `/api/{resource}/{id}/{sub-resource}`
- `/api/users/123/orders` - orders for user 123
- `/api/work-items/456/children` - child items of work item 456

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `409` - Conflict
- `500` - Server Error

## Best Practices
- Use plural nouns for collections
- Consistent naming (kebab-case for URLs)
- No trailing slashes
- Filter via query params: `?status=active&sort=name`
- Version APIs: `/api/v1/users`

## Common Patterns
- Bulk operations: `PATCH /api/users/assignments`
- Nested resources: `GET /api/epics/{id}/stories`
- Actions: `POST /api/orders/{id}/cancel`