# Historical Context Injection Feature

## Overview

The Historical Context Injection feature enhances AI agent decision-making by providing relevant historical context from past work items, agent interactions, and outcomes. This feature enables agents to learn from previous experiences and make more informed decisions.

## Key Components

### 1. Context Manager (`context-manager.ts`)
Responsible for retrieving and managing historical context for work items.

**Features:**
- Fetches work item history from the database
- Retrieves related work items (parent, children, siblings)
- Extracts success and error patterns
- Calculates agent performance metrics
- Provides caching for performance optimization

**Configuration:**
```typescript
const contextManager = new ContextManager({
  maxHistoryItems: 10,      // Maximum history entries to include
  maxRelatedItems: 5,       // Maximum related work items
  lookbackHours: 168,       // How far back to look (1 week)
  enableCaching: true,      // Enable context caching
  cacheTTLMinutes: 15      // Cache TTL in minutes
});
```

### 2. Relevance Scorer (`relevance-scorer.ts`)
Implements a sophisticated scoring algorithm to rank historical context by relevance.

**Scoring Factors:**
- **Recency**: More recent items score higher (exponential decay)
- **Action Type**: Different actions have different relevance weights
- **Agent Type**: Same agent type gets higher scores
- **Content Similarity**: Text similarity between items
- **Error Relevance**: Relevant errors for the work item type
- **Success Patterns**: Successfully completed items
- **Related Work Items**: Bonus for directly related items

**Configurable Weights:**
```typescript
const weights = {
  recency: 0.25,
  actionType: 0.20,
  agentType: 0.15,
  contentSimilarity: 0.15,
  errorRelevance: 0.10,
  successRelevance: 0.10,
  relatedWorkItem: 0.05
};
```

### 3. Prompt Enhancement
All agent prompts now support historical context injection:

```typescript
const promptConfig: PromptConfig = {
  enableHistoricalContext: true,
  maxContextLength: 2000,
  contextManager: contextManager
};

const prompt = await buildArchitectPrompt(epic, promptConfig);
```

### 4. A/B Testing (`ab-testing.ts`)
Enables controlled experiments to measure the impact of historical context.

**Features:**
- Deterministic variant assignment based on work item ID
- Metrics collection (execution time, success rate, context size)
- Statistical analysis and reporting
- Configurable percentage split

**Configuration:**
```json
{
  "abTesting": {
    "enabled": true,
    "contextEnabledPercent": 60,  // 60% get context
    "seed": 42                     // For reproducibility
  }
}
```

## Usage

### Basic Usage

1. **Enable in Configuration:**
```json
{
  "enableHistoricalContext": true,
  "maxContextLength": 2000,
  "contextLookbackHours": 168,
  "contextCacheTTLMinutes": 15
}
```

2. **Context is Automatically Injected:**
When enabled, all agents will receive relevant historical context in their prompts.

### Advanced Usage

#### Custom Context Retrieval
```typescript
// Get context for a specific work item
const context = await contextManager.getContextForWorkItem(workItemId);

// Get agent-specific context
const agentContext = await contextManager.getContextForAgent('developer', workItemId);
```

#### Relevance Scoring
```typescript
const scorer = new RelevanceScorer();
const scoredHistory = scorer.scoreHistory(
  historyItems,
  currentWorkItem,
  'developer',
  relatedItemIds
);

// Filter by minimum score
const relevant = scorer.filterByRelevance(scoredHistory, 50, 10);
```

#### A/B Testing
```typescript
// Check if context should be enabled
const abResult = abTestManager.shouldEnableContext(workItemId, agentType);

// Record metrics
abTestManager.recordMetrics({
  variant: abResult.variant,
  workItemId: workItemId,
  agentType: agentType,
  executionTimeMs: executionTime,
  success: true,
  contextSize: contextLength,
  timestamp: new Date()
});

// Generate report
const report = abTestManager.generateReport();
```

## Context Format

Historical context is injected into prompts in the following format:

```
HISTORICAL CONTEXT:

RELEVANT HISTORY:
- 2024-01-15T10:30:00Z: agent_output by architect: Technical approach defined
- 2024-01-15T09:15:00Z: status_change by manager: {"from":"backlog","to":"ready"}

SUCCESS PATTERNS:
- Successfully completed by: developer, reviewer
- Passed 2 quality reviews

COMMON ERRORS TO AVOID:
- JSON_PARSE_ERROR: Invalid JSON structure
- TIMEOUT: Request timed out after 30000ms

AGENT PERFORMANCE METRICS (developer):
- Success rate: 85.0%
- Average execution time: 120s
- Common errors: JSON_PARSE_ERROR, TIMEOUT
```

## Performance Considerations

1. **Caching**: Context is cached for 15 minutes by default to reduce database queries
2. **Query Optimization**: Indexes on work_history table for efficient retrieval
3. **Context Limits**: Maximum context length prevents prompt bloat
4. **Batch Processing**: Related items fetched in single query

## Testing

Run the comprehensive test suite:
```bash
npm test -- context-injection.test.ts
```

Run the demo script:
```bash
npm run demo:context-injection
```

## Monitoring

Monitor context injection effectiveness through:
1. A/B test reports comparing with/without context
2. Agent success rates over time
3. Context cache hit rates in logs
4. Execution time metrics

## Future Enhancements

1. **Semantic Similarity**: Use embeddings for better content matching
2. **Pattern Learning**: Automatically identify and store successful patterns
3. **Context Summarization**: Use AI to summarize long contexts
4. **Cross-Agent Learning**: Share learnings between agent types
5. **Adaptive Weighting**: Automatically adjust relevance weights based on outcomes