# Test-Driven Development (TDD) Patterns

**Last Updated**: 2025-01-17

## Red-Green-Refactor Cycle

1. **Red**: Write the smallest failing test
2. **Green**: Write minimal code to make it pass
3. **Refactor**: Improve code while keeping tests green

## Test Structure

**AAA Pattern**:
```javascript
test('should assign work item to available agent', () => {
    // Arrange
    const workItem = { id: 1, status: 'new' };
    const agent = { id: 1, type: 'developer' };
    
    // Act
    const result = assignWorkItem(workItem, agent);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.assignment.agentId).toBe(1);
});
```

## Test Categories

**Unit Tests**:
- Test single functions
- No external dependencies
- Fast execution (<1ms)

**Integration Tests**:
- Test component interactions
- Real database/API calls
- Moderate execution time

**End-to-End Tests**:
- Test complete workflows
- Real user scenarios
- Slower execution

## Best Practices

**Test One Thing**:
- Each test validates one behavior
- Clear test names describe expected behavior
- Avoid testing implementation details

**Test Data**:
- Use realistic test data
- Avoid magic numbers
- Create test builders/factories

**Mocking Guidelines**:
- Mock external services (APIs, databases)
- Don't mock your own code
- Prefer real implementations when possible

## TDD Benefits
- Better design through testing constraints
- Confidence in refactoring
- Living documentation
- Faster debugging