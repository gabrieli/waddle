# 🐧 Waddle

> An AI-powered software development team that waddles through multiple stages of software development. Software engineering best practices at your fingertips and tiny feet.

## Overview

Waddle is a comprehensive development workflow framework that simulates a complete software development team using AI. It enforces industry best practices through structured roles, automated reviews, and quality-first principles. The autonomous orchestrator continuously manages development tasks, progressing features through each phase automatically.

## 🎯 Key Features

- **5 Development Roles**: Product Manager, Technical Architect, Developer, Security Expert, and QA Tester
- **6 Review Specialists**: Architectural, Security, Testing, Documentation, DevOps, and UX reviews
- **Autonomous Orchestration**: Continuous loop that automatically progresses work through phases
- **AI-Powered Decision Making**: Intelligent task routing and deadlock resolution
- **Test-Driven Development**: Enforced red-green-refactor cycle
- **Automated Pre-commit Validation**: Never bypass quality checks
- **GitHub Integration**: Issues and Projects for state tracking
- **Security First**: Zero-trust principles and data protection

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/waddle.git
cd waddle

# Install dependencies
npm install

# Build the project
npm run build

# Create a .env file with your credentials
cp .env.example .env
# Edit .env with your GitHub token and Anthropic API key
```

### Configuration

Create a `.env` file with:
```env
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repository_name
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### Initialize Waddle

```bash
# Initialize Waddle in your project
npx waddle init

# Start the autonomous orchestrator
npx waddle start
```

## 🤖 CLI Commands

- `waddle init` - Initialize Waddle in the current directory
- `waddle start` - Start the autonomous orchestrator
- `waddle stop` - Stop the orchestrator
- `waddle pause` - Pause task execution
- `waddle resume` - Resume task execution
- `waddle status` - Show metrics and current status
- `waddle create <title>` - Create a new feature
- `waddle list` - List all features
- `waddle feature <number>` - Show feature details

## 📋 Development Workflow

### 1. Product Management Phase
- Gather user-centric requirements
- Create epics and user stories
- Define acceptance criteria

### 2. Architecture Phase
- Design scalable systems
- Create technical specifications
- Define implementation approach

### 3. Development Phase
- Follow TDD practices
- Implement in small iterations
- Use functional programming principles

### 4. Security Review
- Validate data protection
- Check for vulnerabilities
- Ensure API security

### 5. QA Testing
- Comprehensive test coverage
- Cross-platform validation
- User experience verification

## 🛡️ Core Principles

- **Quality Over Speed**: Better to delay than deliver subpar experience
- **User-Centric Design**: Every decision prioritizes user value
- **No Shortcuts**: Technical debt compounds exponentially
- **Continuous Verification**: Always test before declaring completion

## 📁 Project Structure

```
waddle/
├── src/
│   ├── orchestrator/   # Autonomous orchestration engine
│   ├── services/       # GitHub and LLM services
│   ├── state/          # State management
│   ├── cli.ts          # Command-line interface
│   └── index.ts        # Main exports
├── dev-roles/          # Development team role definitions
├── review-roles/       # Automated review role specifications
├── CLAUDE.md          # AI assistant guidelines
└── README.md          # This file
```

## 🔧 How It Works

1. **Feature Creation**: Create a GitHub issue for a new feature
2. **Autonomous Processing**: The orchestrator picks up the issue and progresses it through phases
3. **Phase Transitions**: AI determines the next appropriate phase based on results
4. **Deadlock Resolution**: Automatic detection and resolution of blocking dependencies
5. **Continuous Loop**: Runs every 30 seconds (configurable) to check for pending work

## ⚙️ Configuration Options

Edit `waddle.config.json` to customize:

```json
{
  "orchestrator": {
    "checkIntervalMs": 30000,      // How often to check for work
    "maxConcurrentTasks": 1,        // Parallel task limit
    "taskTimeoutMs": 3600000,       // 1 hour task timeout
    "retryAttempts": 3,             // Retry failed tasks
    "retryDelayMs": 60000           // Wait between retries
  }
}
```

## 🤝 Contributing

Follow the workflow defined in the role documentation. All contributions must pass automated reviews and maintain the quality standards defined in this framework.

## 📜 License

See LICENSE file for details.
