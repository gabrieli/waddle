# Git Worktree Management for Concurrent Development

## Overview
Git worktrees enable multiple branches to be checked out simultaneously in different directories, allowing concurrent development work on the same repository without branch switching conflicts.

## Waddle Implementation Pattern

### Worktree Path Convention
- **Standard Path**: `./worktrees/{branch_name}/`
- **Example**: `./worktrees/feature-us-002-task-assignment-flow/`
- **Computed From**: Task `branch_name` field in database

### Task-Based Worktree Workflow

#### For Developers
```bash
# Get branch_name from assigned task
BRANCH_NAME="feature-us-002-task-assignment-flow"
WORKTREE_PATH="./worktrees/${BRANCH_NAME}"

# Create worktree if it doesn't exist
git worktree add "${WORKTREE_PATH}" "${BRANCH_NAME}"

# Or create new branch if needed
git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}"

# Always work in the worktree
cd "${WORKTREE_PATH}"

# Verify correct branch
git branch --show-current
```

#### For Testers
```bash
# Navigate to worktree for testing
cd "./worktrees/${BRANCH_NAME}"

# Install dependencies in worktree
npm install

# Run tests in the specific branch environment
npm test
npm run test:integration
```

#### For Reviewers
```bash
# Review code in the correct worktree
cd "./worktrees/${BRANCH_NAME}"

# Pull latest changes
git pull origin "${BRANCH_NAME}"

# Build and test before review
npm run build
npm test
```

## Worktree Commands Reference

### Creating Worktrees
```bash
# Add worktree for existing branch
git worktree add ./worktrees/branch-name branch-name

# Create new branch and worktree
git worktree add -b new-branch ./worktrees/new-branch

# Create worktree from specific commit
git worktree add ./worktrees/branch-name commit-hash
```

### Managing Worktrees
```bash
# List all worktrees
git worktree list

# Remove worktree (after deleting directory)
git worktree remove ./worktrees/branch-name

# Prune deleted worktrees
git worktree prune
```

### Cleanup
```bash
# Remove worktree directory and git reference
rm -rf ./worktrees/branch-name
git worktree prune
```

## Benefits for Waddle

### Concurrent Development
- Multiple agents can work on different branches simultaneously
- No branch switching conflicts or lost work
- Each task has its own isolated environment

### Environment Isolation
- Dependencies can be different per branch
- Build artifacts don't interfere
- Database migrations can be tested independently

### Testing Reliability
- Tests run in correct branch context
- No cross-contamination between features
- Reviewers see exact code being reviewed

## Best Practices

### Directory Structure
```
waddle/
├── src/                    # Main repository
├── worktrees/
│   ├── feature-us-001/     # Task 1 worktree
│   ├── feature-us-002/     # Task 2 worktree
│   └── bugfix-issue-123/   # Bug fix worktree
└── ...
```

### Task Assignment Workflow
1. Agent receives task with `branch_name` field
2. Compute worktree path: `./worktrees/{branch_name}/`
3. Create worktree if needed
4. Navigate to worktree before starting work
5. All development/testing/review happens in worktree

### Cleanup Strategy
- Keep worktrees after task completion for potential reuse
- Remove worktrees when branch is merged and deleted
- Use `git worktree prune` to clean up orphaned references

## Integration with Waddle Task System

### Database Schema
Tasks table includes `branch_name` field:
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  branch_name TEXT,  -- Used to compute worktree path
  -- ... other fields
);
```

### Service Layer
Task service computes worktree paths from branch_name:
```typescript
function getWorktreePath(branchName: string): string {
  return `./worktrees/${branchName}/`;
}
```

### Agent Instructions
All role guides include worktree setup instructions:
- Developers: Create worktree before development
- Testers: Use worktree for testing specific branch
- Reviewers: Review code in appropriate worktree

## Troubleshooting

### Common Issues
1. **Worktree already exists**: Use existing worktree or remove and recreate
2. **Branch doesn't exist**: Create branch first or use `-b` flag
3. **Permission issues**: Ensure write access to worktrees directory
4. **Disk space**: Monitor disk usage as worktrees duplicate repository

### Recovery Commands
```bash
# Force remove corrupted worktree
git worktree remove --force ./worktrees/branch-name

# Repair missing worktree
git worktree repair ./worktrees/branch-name

# List and clean up all worktrees
git worktree list
git worktree prune
```

## Performance Considerations
- Each worktree uses additional disk space
- Consider using git's built-in file deduplication
- Monitor total disk usage across all worktrees
- Clean up merged branches promptly

---
*Last Updated: 2025-07-06*