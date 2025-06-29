# Waddle Agent System

This is the new agent-based architecture for Waddle, replacing the old orchestrator system.

## Architecture

The new system consists of:
- **Waddle Server**: TCP server that listens for commands
- **Agent System**: Modular agents that perform specific tasks
- **Database**: SQLite database for tracking work items and agent state
- **Claude Integration**: Executes Claude CLI with role-specific instructions

## Directory Structure

```
src/
├── server/          # Waddle server implementation
├── agents/          # Agent implementations
├── database/        # Database layer
├── claude/          # Claude CLI integration
└── config/          # Configuration management
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm run dev
   ```

3. In another terminal, use the client:
   ```bash
   npm run client
   ```

## Available Commands

- `ping` - Test server connection
- `status` - Get system status
- `developer:assign <work_id>` - Assign developer to work item
- `developer:status` - Get developer agents status
- `developer:complete` - Info about work completion

## Environment Support

The system supports two environments:
- `local` - Uses `waddle.db`
- `test` - Uses `waddle-test.db`

Set environment with: `WADDLE_ENV=test`

## Configuration

Copy `waddle.config.example.json` to `waddle.config.json` and adjust settings.

## Testing

Run all tests:
```bash
npm test
```

Run integration tests only:
```bash
npm run test:integration
```

## Developer Agent

The developer agent:
- Uses `claude -p` to execute tasks
- Follows instructions from `dev-roles/ROLE_DEVELOPER.md`
- Automatically locks/unlocks work items
- Updates work item status on completion
- Records all actions in work history

## Database Schema

The system maintains compatibility with the existing work_items schema and adds:
- `agents` table - Tracks active agents and their assignments
- Enhanced work_history tracking
- Automatic cleanup of stale locks