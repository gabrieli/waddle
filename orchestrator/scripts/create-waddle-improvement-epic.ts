import { createWorkItem, generateId, addHistory } from '../src/database/utils.js';

const epicId = generateId('EPIC');
const epic = createWorkItem(
  epicId,
  'epic',
  'Enhance Waddle Agent Communication and Context Management System',
  `This epic establishes the foundation for transforming Waddle into a sophisticated autonomous development system where agents can effectively communicate, share context, and continuously improve their collaboration.

## Current Challenges
- Agents work in isolation without sharing discoveries or decisions
- No persistent storage for architectural decisions, technical findings, or code reviews
- Limited context passing between different agent roles
- No mechanism for agents to suggest system improvements based on their experiences

## Key Objectives
1. **Persistent Knowledge Base**: Design and implement a system to store and retrieve:
   - Architecture Decision Records (ADRs) from architects
   - Technical discoveries and implementation patterns
   - Code review feedback with line-based comments
   - Agent learnings and best practices

2. **Enhanced Agent Communication**: Enable agents to:
   - Share context between handoffs (architect → developer → reviewer)
   - Reference previous decisions and patterns
   - Build upon each other's work incrementally

3. **Review System Enhancement**: Implement sophisticated code review storage:
   - Line-by-line comment system linked to specific code changes
   - Review history and resolution tracking
   - Pattern recognition for common issues

4. **Continuous Improvement Loop**: Create mechanisms for:
   - Agents to analyze their effectiveness and suggest improvements
   - Automatic creation of improvement stories based on agent feedback
   - Performance metrics and success tracking

## Success Criteria
- Architects can create and reference ADRs that persist across sessions
- Developers can access architectural context and previous implementation patterns
- Reviewers can provide detailed, line-specific feedback that developers can act upon
- System automatically generates improvement stories based on agent observations
- Measurable improvement in agent collaboration efficiency

## Technical Considerations
- Database schema extensions for new data types
- Context retrieval and ranking algorithms
- Integration points between agents and knowledge base
- Performance implications of context-aware operations`,
  null,
  'backlog'
);

console.log(`✅ Created epic: ${epicId} - ${epic.title}`);
addHistory(epicId, 'decision', 'Epic created to enhance agent communication and context management', 'manual');

console.log('\nEpic created successfully! The architect agent should analyze this and create appropriate user stories.');
console.log('Run "npm start" to let the agents begin working on this epic.');