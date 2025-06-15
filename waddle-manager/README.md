# @waddle.run/mcp 🐧

> AI development team that waddles so your projects can run

## What is Waddle?

Waddle is an autonomous development orchestration system that manages software development workflows by coordinating AI agents through different development phases. It eliminates the need for constant human interaction by intelligently routing work between architecture, development, and review phases.

## Features

- 🤖 **Autonomous Development** - Describe features in natural language and let AI implement them
- 🔄 **Intelligent Orchestration** - Automatic workflow management through development phases
- 🛠️ **MCP Integration** - Seamless integration with Claude Code and other MCP-compatible tools
- 📊 **Real-time Monitoring** - Web dashboard to track progress and intervene when needed
- 💾 **Persistent Context** - Maintains project knowledge across sessions
- 🎯 **Role-based Execution** - Specialized AI agents for architecture, development, and review

## Quick Start

### Installation

```bash
npm install -g @waddle.run/mcp
```

### Basic Usage

1. Start Waddle:
```bash
waddle
```

2. In another terminal, use Claude Code to create features:
```bash
claude

You: waddle create feature "Add user authentication with OAuth"
```

3. Monitor progress at http://localhost:8080

## Requirements

- Node.js 20+
- Claude CLI installed and configured
- Unix-like environment (macOS, Linux, WSL)

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Configuration](./docs/configuration.md)
- [API Reference](./docs/api.md)
- [Architecture](./docs/architecture.md)

## Development

```bash
# Clone the repository
git clone https://github.com/waddle-run/mcp.git
cd mcp

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## License

MIT © Waddle

## Support

- 🐛 [Report Issues](https://github.com/waddle-run/mcp/issues)
- 💬 [Discussions](https://github.com/waddle-run/mcp/discussions)
- 📧 [Email](mailto:support@waddle.run)

---

Built with 🐧🐧🐧🐧🐧 by Waddle

## Enhanced Orchestrator with Self-Healing

The enhanced orchestrator now provides autonomous operation with self-healing capabilities:

### Features

- **Autonomous Processing**: Continuously polls for pending tasks and processes them
- **Self-Healing**: Automatically detects and recovers from failures
- **Local Database**: Uses SQLite for all state management (no GitHub dependency)
- **Intelligent Task Routing**: Uses headless Claude for AI reasoning
- **Concurrent Execution**: Manages multiple tasks in parallel
- **Automatic Recovery**: Retries failed tasks with enriched context

### Task Pipeline

1. **Architect** → Creates technical design
2. **Developer** → Implements based on design  
3. **Reviewer** → Reviews implementation
4. Feature marked complete when all tasks pass

### Configuration

```typescript
const config: OrchestratorConfig = {
  checkIntervalMs: 30000,      // How often to check for work
  maxConcurrentTasks: 2,       // Parallel execution limit
  taskTimeoutMs: 3600000,      // 1 hour timeout
  maxTaskAttempts: 3,          // Retry limit
  selfHealingEnabled: true,    // Enable self-healing
  claudePath: 'claude',        // Path to Claude CLI
  mcpServerUrl: 'http://localhost:5173'
};
```

### Loading Epic and User Stories

To load all Waddle development tasks:

```bash
npx ts-node scripts/load-epic-to-waddle.ts
```

This will:
- Create the main epic in the database
- Add all 15 user stories as features
- Create initial architect tasks for pending stories
- Mark completed stories as done

### Starting Autonomous Processing

```bash
npm start
```

Waddle will now:
- Process all pending tasks automatically
- Progress features through the development pipeline
- Self-heal when encountering issues
- Create improvement tasks for itself

### Monitoring

The orchestrator provides real-time metrics:

```javascript
const metrics = orchestrator.getMetrics();
// Returns:
// {
//   features: { total, pending, inProgress, complete, blocked },
//   tasks: { total, pending, inProgress, complete, failed },
//   orchestrator: { running, paused, runningTasks, maxConcurrent }
// }
```

## Ready for Full Autonomous Operation

✅ **Confirmed**: Waddle is now ready to autonomously complete the remaining project tasks:

1. **Local Database Management** - No GitHub dependencies
2. **Headless Claude Integration** - AI reasoning powered by Claude
3. **Self-Healing Capabilities** - Automatically recovers from failures
4. **Task Pipeline** - Architect → Developer → Reviewer workflow
5. **Concurrent Processing** - Handles multiple tasks efficiently
6. **Automatic Task Creation** - Creates follow-up tasks as needed

Simply run `npm start` and Waddle will autonomously process all remaining user stories!