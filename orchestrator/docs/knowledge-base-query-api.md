# Knowledge Base Query API Documentation

## Overview

The Knowledge Base Query API provides comprehensive access to patterns, Architecture Decision Records (ADRs), reviews, agent communications, and decision tracing capabilities. It includes advanced features like decision tracing, context retrieval, and access control for sensitive patterns.

## CLI Commands

### Basic Usage

```bash
npm run query-knowledge -- <command> [options]
```

### Available Commands

#### 1. `patterns` - Search and view patterns

```bash
# Search all patterns
npm run query-knowledge -- patterns

# Filter by agent role
npm run query-knowledge -- patterns --agent developer

# Filter by pattern type
npm run query-knowledge -- patterns --type solution

# Search with text
npm run query-knowledge -- patterns --search "error handling"

# Export results to JSON
npm run query-knowledge -- patterns --export

# Access sensitive patterns with role
npm run query-knowledge -- patterns --role architect

# Access sensitive patterns with API key
npm run query-knowledge -- patterns --api-key "your-api-key"
```

#### 2. `adrs` - Search and view Architecture Decision Records

```bash
# View all ADRs
npm run query-knowledge -- adrs

# Filter by status
npm run query-knowledge -- adrs --status accepted

# Filter by work item
npm run query-knowledge -- adrs --work-item STORY-ABC123

# Search ADRs
npm run query-knowledge -- adrs --search "microservices"
```

#### 3. `reviews` - View reviews for a work item

```bash
# Get reviews for a work item
npm run query-knowledge -- reviews --work-item STORY-ABC123

# Export reviews
npm run query-knowledge -- reviews --work-item STORY-ABC123 --export
```

#### 4. `messages` - View agent communications

```bash
# Get messages for an agent
npm run query-knowledge -- messages --agent developer

# Export messages
npm run query-knowledge -- messages --agent developer --export
```

#### 5. `trace` - Trace decision making process

```bash
# Trace decisions for a work item
npm run query-knowledge -- trace --work-item STORY-ABC123

# Export decision trace with full context
npm run query-knowledge -- trace --work-item STORY-ABC123 --export --include-context
```

#### 6. `context` - Show historical context

```bash
# Get historical context for a work item
npm run query-knowledge -- context --work-item STORY-ABC123

# Export context
npm run query-knowledge -- context --work-item STORY-ABC123 --export
```

### CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--type` | `-t` | Pattern type (solution, approach, tool_usage, error_handling, optimization) |
| `--agent` | `-a` | Agent role (manager, architect, developer, reviewer, bug-buster) |
| `--status` | `-s` | ADR status (proposed, accepted, deprecated, superseded) |
| `--work-item` | `-w` | Work item ID |
| `--min-score` | | Minimum effectiveness score for patterns (0.0-1.0) |
| `--limit` | `-l` | Maximum number of results |
| `--search` | | Search text in patterns/ADRs |
| `--export` | `-e` | Export results to JSON file |
| `--decision` | | Decision ID to trace |
| `--include-context` | | Include full historical context in export |
| `--role` | | User role for access control |
| `--api-key` | | API key for accessing sensitive patterns |

## REST API Endpoints

### Base URL

```
http://localhost:3000/api
```

### Pattern Endpoints

#### GET /api/patterns

Search and retrieve patterns.

**Query Parameters:**
- `agent_role` - Filter by agent role
- `pattern_type` - Filter by pattern type
- `min_score` - Minimum effectiveness score (0.0-1.0)
- `limit` - Maximum results to return
- `search` - Text search in pattern content
- `include_embeddings` - Include embedding data (default: false)

**Headers:**
- `x-user-role` - User role for access control
- `x-api-key` - API key for sensitive patterns

**Response:**
```json
{
  "success": true,
  "count": 10,
  "patterns": [
    {
      "id": "pattern-123",
      "agent_role": "developer",
      "pattern_type": "solution",
      "context": "When implementing REST APIs",
      "solution": "Use OpenAPI specification",
      "effectiveness_score": 0.85,
      "usage_count": 15,
      "metadata": "{\"tags\":[\"api\",\"rest\"]}"
    }
  ]
}
```

#### GET /api/patterns/:id

Get a specific pattern by ID.

#### POST /api/patterns/:id/use

Increment pattern usage count.

#### PUT /api/patterns/:id/effectiveness

Update pattern effectiveness score.

**Request Body:**
```json
{
  "score": 0.95,
  "increment_usage": true
}
```

#### GET /api/patterns/access/status

Get access control configuration status.

### Decision Tracing Endpoints

#### GET /api/decisions/:id/trace

Get decision trace for a work item.

**Response:**
```json
{
  "success": true,
  "trace": {
    "work_item": {
      "id": "STORY-123",
      "title": "Implement feature X",
      "type": "story",
      "status": "in_progress"
    },
    "decision_timeline": [
      {
        "timestamp": "2024-01-15T10:30:00Z",
        "agent": "architect",
        "action": "decision",
        "decision": "Use microservices",
        "rationale": "Better scalability"
      }
    ],
    "influencing_context": {
      "success_patterns": ["Pattern 1", "Pattern 2"],
      "error_patterns": ["Error pattern 1"],
      "relevant_history_count": 5,
      "related_items_count": 3
    },
    "patterns_used": [],
    "architecture_decisions": [],
    "agent_performance": []
  }
}
```

#### GET /api/decisions/:id/context

Get full historical context for a work item.

**Query Parameters:**
- `include_details` - Include full history details (default: false)

### ADR Endpoints

#### GET /api/adrs

Search ADRs.

**Query Parameters:**
- `work_item` - Filter by work item ID
- `status` - Filter by status
- `search` - Text search
- `limit` - Maximum results

#### GET /api/adrs/:id

Get specific ADR.

#### POST /api/adrs

Create new ADR.

**Request Body:**
```json
{
  "title": "Use Event-Driven Architecture",
  "context": "Need for real-time updates",
  "decision": "Implement event bus",
  "consequences": "Increased complexity",
  "created_by": "architect",
  "work_item_id": "STORY-123"
}
```

#### PUT /api/adrs/:id/status

Update ADR status.

#### POST /api/adrs/:id/supersede

Supersede ADR with another.

### Review Endpoints

#### GET /api/reviews

Search reviews.

**Query Parameters:**
- `work_item` - Filter by work item ID
- `status` - Filter by status
- `type` - Filter by review type
- `reviewer` - Filter by reviewer role
- `min_quality_score` - Minimum quality score

#### GET /api/reviews/:id

Get specific review.

#### POST /api/reviews

Create new review.

#### GET /api/reviews/work-item/:id/summary

Get review summary for a work item.

### Message Endpoints

#### GET /api/messages

Get messages for an agent.

**Query Parameters:**
- `agent` - Agent to get messages for (required)
- `undelivered_only` - Only undelivered messages
- `work_item` - Filter by work item
- `priority` - Filter by priority
- `type` - Filter by message type

#### POST /api/messages

Send a new message.

#### PUT /api/messages/:id/delivered

Mark message as delivered.

#### GET /api/messages/agent/:agent/unread

Get unread message count.

#### POST /api/messages/broadcast

Send message to multiple agents.

## Access Control

### Overview

The system implements access control for sensitive patterns to protect confidential information like API keys, credentials, and security-related patterns.

### How It Works

1. **Pattern Classification**: Patterns are automatically classified as sensitive based on:
   - Tags: `security`, `credentials`, `api-keys`, `secrets`, `sensitive`
   - Pattern types: `security`, `authentication`
   - Content keywords: `password`, `secret`, `api_key`, `token`, `credential`
   - Metadata flag: `sensitive: true`

2. **Access Methods**:
   - **Role-based**: Users with roles `architect` or `security` can access sensitive patterns
   - **API Key**: Valid API key grants access to all patterns
   - **Default**: Without proper access, sensitive patterns show `[REDACTED]` content

3. **Configuration**: Access control can be configured via environment variables:
   - `ENABLE_ACCESS_CONTROL` - Enable/disable access control (default: true)
   - `REQUIRE_API_KEY` - Require API key for sensitive operations (default: false)
   - `KNOWLEDGE_BASE_API_KEY` - Set custom API key

### Using Access Control

#### CLI Access
```bash
# Access with role
npm run query-knowledge -- patterns --role architect

# Access with API key
npm run query-knowledge -- patterns --api-key "your-api-key"
```

#### API Access
```bash
# Access with role header
curl -H "x-user-role: architect" http://localhost:3000/api/patterns

# Access with API key header
curl -H "x-api-key: your-api-key" http://localhost:3000/api/patterns
```

## Testing

Run the test suites:

```bash
# Test knowledge base queries
cd orchestrator
./test/test-knowledge-query.ts

# Test API endpoints (requires supertest)
npm install --save-dev supertest @types/supertest
./test/test-api-endpoints.ts
```

## Examples

### Example 1: Find High-Value Developer Patterns
```bash
npm run query-knowledge -- patterns --agent developer --min-score 0.8 --type solution
```

### Example 2: Trace Decision Making
```bash
npm run query-knowledge -- trace --work-item EPIC-PROJECT-X --export
```

### Example 3: Get Security Reviews
```bash
curl "http://localhost:3000/api/reviews?type=security&status=needs_revision"
```

### Example 4: Access Sensitive Security Patterns
```bash
# Via CLI with role
npm run query-knowledge -- patterns --search security --role architect

# Via API with header
curl -H "x-user-role: security" "http://localhost:3000/api/patterns?search=api%20key"
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid parameters)
- `403` - Forbidden (access control)
- `404` - Not Found
- `500` - Internal Server Error