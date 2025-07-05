# Git Branching Strategies

**Last Updated**: 2025-01-17

## Feature Branch Workflow

**Branch Naming**: `feature/work-item-{id}-{short-description}`
- `feature/work-item-123-user-authentication`
- `feature/work-item-456-payment-integration`

**Workflow**:
1. Create branch from main: `git checkout -b feature/work-item-123-auth`
2. Work on feature with atomic commits
3. Push branch: `git push -u origin feature/work-item-123-auth`
4. Create pull request
5. Review and merge
6. Delete branch after merge

## Git Worktree

**Use Cases**:
- Work on multiple features simultaneously
- Switch context without stashing
- Parallel development

**Commands**:
```bash
# Create worktree
git worktree add ../project-feature-auth feature/work-item-123-auth

# List worktrees
git worktree list

# Remove worktree
git worktree remove ../project-feature-auth
```

## Best Practices

**Commit Messages**:
- Use conventional commits: `feat:`, `fix:`, `docs:`
- Keep first line under 50 characters
- Include work item reference

**Branch Management**:
- Keep branches small and focused
- Regular rebasing to keep history clean
- Delete merged branches promptly

**Merge Strategy**:
- Squash feature commits for clean history
- Use merge commits for tracking features
- Avoid force pushing to shared branches

## Automation
- Pre-commit hooks for code quality
- CI/CD pipeline triggers on push
- Automatic branch deletion after merge