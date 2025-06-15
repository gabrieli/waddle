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