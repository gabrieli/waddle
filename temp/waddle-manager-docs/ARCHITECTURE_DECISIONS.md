# Architecture Decisions - Waddle Manager

## Overview
This document captures key architectural decisions made during the design of Waddle Manager, including the rationale and trade-offs considered.

## Decision Log

### ADR-001: TypeScript as Primary Language

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: Need to choose between Python and TypeScript for implementation.

**Decision**: Use TypeScript with Node.js runtime.

**Rationale**:
- Better integration with npm ecosystem for distribution
- Type safety reduces runtime errors
- Seamless MCP protocol implementation
- Single language for backend and web UI
- Better async/await support for concurrent operations

**Consequences**:
- ✅ Easier npm distribution
- ✅ Type safety throughout codebase
- ✅ Better IDE support
- ❌ Slightly larger runtime footprint than Python
- ❌ Need to transpile before execution

---

### ADR-002: SQLite as Database

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: Need persistent storage for features, tasks, and context.

**Decision**: Use SQLite with better-sqlite3 driver.

**Rationale**:
- Zero configuration required
- Embedded database (no separate process)
- Single file backup/restore
- Sufficient for single-instance deployment
- Good performance for our use case

**Consequences**:
- ✅ Simple deployment
- ✅ No database server to manage
- ✅ Easy backup (copy file)
- ❌ Limited concurrent writes
- ❌ No network access (local only)

---

### ADR-003: Headless Claude Execution

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: Need to execute AI tasks autonomously without human interaction.

**Decision**: Spawn Claude CLI in headless mode (-p flag) for each task.

**Rationale**:
- Clean process isolation
- Full tool access in headless mode
- No need for complex AI agent framework
- Leverages existing Claude Code installation
- Easy to debug and monitor

**Consequences**:
- ✅ Simple implementation
- ✅ Process isolation for safety
- ✅ Easy to add timeout/resource limits
- ❌ Process spawn overhead
- ❌ Requires Claude CLI installed

---

### ADR-004: MCP Server for Integration

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: Need a way for Claude Code to interact with Manager.

**Decision**: Implement MCP server protocol for tool exposure.

**Rationale**:
- Standard protocol for AI tool integration
- Native support in Claude Code
- Enables natural interaction pattern
- Supports future AI providers
- Clean API boundary

**Consequences**:
- ✅ Seamless Claude Code integration
- ✅ Standards-based approach
- ✅ Extensible for other clients
- ❌ Need to implement full protocol
- ❌ Additional complexity vs REST API

---

### ADR-005: AI-Powered Orchestration

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: Need intelligent task routing and deadlock resolution.

**Decision**: Use AI reasoning for orchestration decisions instead of rigid state machine.

**Rationale**:
- Handles edge cases better
- Adapts to unexpected situations
- Can detect and resolve deadlocks
- More human-like project management
- Self-improving with examples

**Consequences**:
- ✅ Flexible workflow handling
- ✅ Better error recovery
- ✅ Natural decision making
- ❌ Less predictable behavior
- ❌ Requires AI calls for decisions

---

### ADR-006: Single Instance Architecture

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: Deciding between single instance vs distributed architecture.

**Decision**: Design for single instance deployment initially.

**Rationale**:
- Simpler implementation
- Easier deployment for users
- No coordination overhead
- Sufficient for individual developers
- Can evolve to distributed later

**Consequences**:
- ✅ Simple architecture
- ✅ Easy to debug
- ✅ No network complexity
- ❌ Limited scalability
- ❌ Single point of failure

---

### ADR-007: Web UI Technology Stack

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: Need to choose web UI framework.

**Decision**: React with TypeScript and Vite.

**Rationale**:
- Modern development experience
- Fast build times with Vite
- Large ecosystem
- TypeScript consistency
- Good real-time update support

**Consequences**:
- ✅ Fast development
- ✅ Modern tooling
- ✅ Type safety in UI
- ❌ Additional build step
- ❌ Larger bundle size

---

### ADR-008: Process Management Strategy

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: How to manage long-running Manager process.

**Decision**: Use native Node.js with optional systemd/launchd integration.

**Rationale**:
- Cross-platform compatibility
- No additional dependencies
- Users can choose their process manager
- Simple for development
- Production-ready options available

**Consequences**:
- ✅ Flexible deployment
- ✅ No forced dependencies
- ✅ Developer friendly
- ❌ Users must manage process
- ❌ No built-in restart on crash

---

### ADR-009: Configuration Management

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: How to handle configuration for various deployment scenarios.

**Decision**: JSON config file with environment variable overrides.

**Rationale**:
- Simple and familiar format
- Easy to version control
- Environment overrides for containers
- No additional parsing libraries
- IDE support for JSON

**Consequences**:
- ✅ Simple configuration
- ✅ Good IDE support
- ✅ Container friendly
- ❌ No comments in JSON
- ❌ Limited to JSON types

---

### ADR-010: Error Handling Philosophy

**Status**: Accepted  
**Date**: 2024-01-15

**Context**: How to handle failures in autonomous execution.

**Decision**: Fail gracefully with retry logic and dead letter queue.

**Rationale**:
- System should continue operating
- Transient failures are common
- Need visibility into failures
- Manual intervention as last resort
- Prevent cascade failures

**Consequences**:
- ✅ Resilient system
- ✅ Self-healing for transient issues
- ✅ Clear failure visibility
- ❌ Complex error handling
- ❌ Need failure analysis tools

---

## Future Considerations

### Potential Future Decisions

1. **Multi-Provider Support**: Supporting OpenAI, Gemini, etc.
   - Would require provider abstraction layer
   - Different capabilities per provider
   - Cost optimization opportunities

2. **Distributed Architecture**: Multiple worker nodes
   - Would enable higher throughput
   - Requires work queue (Redis/RabbitMQ)
   - Complex coordination logic

3. **Cloud Deployment**: Managed service offering
   - Would need authentication/authorization
   - Multi-tenancy considerations
   - Data isolation requirements

4. **Plugin System**: Extensible workflows
   - Custom steps in pipeline
   - Third-party integrations
   - Security considerations

### Review Schedule

These decisions should be reviewed:
- After first 10 production deployments
- When scaling beyond single developer use
- If performance becomes an issue
- When adding major features