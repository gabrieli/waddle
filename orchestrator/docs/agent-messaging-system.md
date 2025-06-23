# Agent Messaging System

## Overview

The Agent Messaging System enables asynchronous communication between agents in the orchestrator system. It provides structured message types, priority routing, automatic retry handling, and dead letter queue functionality for undeliverable messages.

## Features

### Message Types

The system supports four structured message types:

1. **Question** - Agents ask questions to get clarification or technical guidance
2. **Insight** - Agents share insights, discoveries, or progress updates
3. **Warning** - Agents alert others about issues, risks, or concerns
4. **Handoff** - Agents transfer work items to other agents

### Priority Levels

Messages can be sent with different priority levels:
- **urgent** - Immediate attention required
- **high** - Important, process soon
- **medium** - Normal priority (default)
- **low** - Process when convenient

### Key Components

#### MessageService (`src/services/messaging.ts`)
- Core service for sending and processing messages
- Handles retry logic with exponential backoff
- Manages dead letter queue for failed messages
- Provides message statistics and metrics

#### AgentMessaging (`src/services/agent-messaging.ts`)
- High-level API for agents to send and receive messages
- Automatic message checking at configurable intervals
- Priority filtering support
- Convenience methods for common communication patterns

#### BaseAgent (`src/agents/base-agent.ts`)
- Abstract base class for agents with integrated messaging
- Automatic message checking during work item processing
- Default handlers for all message types
- Lifecycle management

## Usage Examples

### Sending Messages

```typescript
// Ask a question
await agentMessaging.askQuestion(
  'architect',
  'Technical Question',
  'How should I implement authentication?',
  workItemId,
  'high'
);

// Share an insight
await agentMessaging.shareInsight(
  'manager',
  'Progress Update',
  'Feature is 80% complete',
  workItemId
);

// Send a warning
await agentMessaging.sendWarning(
  'developer',
  'Security Issue',
  'Found SQL injection vulnerability',
  workItemId,
  'urgent'
);

// Handoff work
await agentMessaging.handoffWork(
  'reviewer',
  'Ready for Review',
  'All tests passing, please review',
  workItemId
);
```

### Receiving Messages

```typescript
const agentMessaging = new AgentMessaging({
  agentRole: 'developer',
  handlers: {
    question: async (message) => {
      // Handle questions
      console.log(`Question from ${message.from_agent}: ${message.content}`);
    },
    warning: async (message) => {
      // Handle warnings
      console.log(`Warning: ${message.content}`);
    }
  },
  checkIntervalMs: 30000 // Check every 30 seconds
});

// Start message checking
agentMessaging.start();
```

## API Endpoints

### Messages API (`/api/messages`)

- `GET /api/messages` - Get messages for an agent
- `POST /api/messages` - Send a new message
- `PUT /api/messages/:id/delivered` - Mark message as delivered
- `GET /api/messages/agent/:agent/unread` - Get unread message count
- `POST /api/messages/broadcast` - Send message to multiple agents
- `GET /api/messages/metrics` - Get communication metrics
- `GET /api/messages/dead-letter` - Get dead letter queue messages
- `POST /api/messages/:id/resurrect` - Resurrect message from dead letter
- `DELETE /api/messages/dead-letter/cleanup` - Clean up old dead letters

## Dead Letter Queue

Messages that fail processing after the maximum retry attempts (default: 3) are moved to the dead letter queue. These messages:

- Are marked with `is_dead_letter = true`
- Have status set to `failed`
- Include error details and retry history
- Can be manually resurrected for reprocessing
- Are automatically cleaned up after 30 days (configurable)

## Metrics and Monitoring

The system provides comprehensive metrics including:

- Message counts by status (pending, delivered, processed, failed)
- Message distribution by priority and type
- Communication patterns between agents
- Average processing times
- Dead letter queue health

Access metrics via: `GET /api/messages/metrics`

## Database Schema

The `agent_communications` table stores all messages with fields for:
- Message routing (from_agent, to_agent)
- Message content and metadata
- Status tracking and timestamps
- Retry handling (retry_count, last_retry_at, error_message)
- Dead letter queue flag

## Integration with Existing Agents

To integrate messaging into an existing agent:

1. Extend `BaseAgent` class for automatic messaging support
2. Or use `AgentMessaging` directly for more control
3. Implement message handlers for relevant message types
4. Start the messaging system when the agent starts

See `EnhancedDeveloperAgent` in `src/agents/developer-enhanced.ts` for a complete example.