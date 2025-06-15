# Waddle Quick Start Guide

## Setup

1. **Install Waddle**
```bash
npm install waddle
# or clone and build from source
git clone https://github.com/yourusername/waddle.git
cd waddle
npm install
npm run build
```

2. **Configure Environment**
```bash
# Create .env file
GITHUB_TOKEN=ghp_your_github_token
GITHUB_OWNER=your_username
GITHUB_REPO=your_repo
ANTHROPIC_API_KEY=sk-ant-your_key
```

3. **Initialize Waddle**
```bash
npx waddle init
```

## Using Waddle

### Start the Orchestrator
```bash
# Start autonomous processing
npx waddle start

# The orchestrator will:
# - Check for pending work every 30 seconds
# - Progress features through development phases
# - Handle failures and retries automatically
# - Detect and resolve deadlocks
```

### Create a Feature
```bash
# Create a new feature issue
npx waddle create "Add user authentication" \
  --description "Implement JWT-based authentication" \
  --labels "priority:high,feature"

# Output: ✅ Created feature issue #42
```

### Monitor Progress
```bash
# List all features
npx waddle list

# Output:
# 📋 Features:
#    #42 - Add user authentication (requirements, open)
#    #41 - Fix navigation bug (testing, open)
#    #40 - Update documentation (done, closed)

# View feature details
npx waddle feature 42

# Output:
# 📄 Feature #42: Add user authentication
#    State: open
#    Phase: technical-design
#    Created: 12/15/2024
#    Updated: 12/15/2024
#    
#    History:
#      - requirements (12/15/2024)
#      - technical-design (12/15/2024)
#    
#    ⚡ Currently being processed
```

### Control the Orchestrator
```bash
# Pause processing
npx waddle pause

# Resume processing
npx waddle resume

# View metrics
npx waddle status

# Output:
# 📊 Orchestrator Metrics:
#    Tasks Processed: 15
#    Tasks Succeeded: 13
#    Tasks Failed: 2
#    Average Execution Time: 45.2s
#    Uptime: 120.5 minutes
#    Deadlocks Detected: 1
#    Deadlocks Resolved: 1

# Stop the orchestrator
npx waddle stop
```

## Development Workflow

1. **Feature Creation**: PM creates user story in GitHub
2. **Automatic Processing**: Orchestrator picks up and progresses
3. **Phase Progression**: 
   - Requirements → Technical Design
   - Technical Design → Development
   - Development → Code Review
   - Code Review → Testing
   - Testing → Done
4. **Continuous Monitoring**: Watch progress via CLI or GitHub

## Configuration

Edit `waddle.config.json`:
```json
{
  "orchestrator": {
    "checkIntervalMs": 30000,
    "maxConcurrentTasks": 2,
    "taskTimeoutMs": 3600000,
    "retryAttempts": 3,
    "retryDelayMs": 60000
  },
  "github": {
    "defaultLabels": ["waddle", "automated"]
  }
}
```

## Troubleshooting

- **Orchestrator not picking up tasks**: Check GitHub labels include "waddle:pending"
- **Tasks timing out**: Increase `taskTimeoutMs` in config
- **Too many retries**: Check logs for specific errors, may need manual intervention
- **Deadlocks**: Orchestrator will attempt automatic resolution, check metrics

## Next Steps

- Review the role documentation in `dev-roles/` and `review-roles/`
- Customize the phase prompts in the WaddleManager
- Integrate with your CI/CD pipeline
- Set up monitoring and alerting