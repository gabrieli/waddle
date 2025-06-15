#!/usr/bin/env ts-node

import Database from 'better-sqlite3';
import { join } from 'path';
import { ContextRepository } from '../src/database/repositories';

async function addAcceptanceCriteria() {
  const dbPath = join(__dirname, '..', 'waddle.db');
  const db = new Database(dbPath);
  
  try {
    const contextRepo = new ContextRepository(db);
    
    // Add detailed acceptance criteria as context
    const acceptanceCriteria = contextRepo.create({
      featureId: '0819c29a-baa3-4e73-8e76-7f19a40c12f3',
      type: 'architecture',
      author: 'system',
      content: `# Acceptance Criteria for MCP Server Connection Fix

## Feature ID: 0819c29a-baa3-4e73-8e76-7f19a40c12f3

### 1. MCP Server Functionality
- [ ] MCP server must start successfully on port 5173
- [ ] Server must log startup confirmation with exact URL: http://localhost:5173
- [ ] Server must handle MCP protocol handshake correctly
- [ ] Server must respond to health check requests

### 2. Claude Instance Communication
- [ ] Claude instances must be able to connect to the MCP server without errors
- [ ] Connection status must show "✓ connected" instead of "✘ failed"
- [ ] Claude must be able to call all available MCP tools successfully
- [ ] Error handling must provide clear, actionable error messages

### 3. Validation Test
Once the fix is implemented, validate by having a Claude instance:
1. Connect to the MCP server successfully
2. Use the createFeature tool to insert a test feature with the following properties:
   - Description: "Test Feature: MCP Server Connection Validation"
   - Priority: "low"
   - Metadata: { "type": "test", "purpose": "validate-mcp-fix" }
3. Verify the feature appears in the database
4. Confirm the feature can be retrieved via the listFeatures tool

### 4. Test Script Validation
- [ ] The test-mcp-connection.js script must pass all tests
- [ ] Add new tests to verify:
  - Connection establishment
  - Tool invocation
  - Error recovery
  - Reconnection logic

### 5. Monitoring & Debugging
- [ ] Implement connection status endpoint: GET /status
- [ ] Add detailed logging for:
  - Connection attempts
  - Protocol messages
  - Tool invocations
  - Errors with stack traces
- [ ] Create debugging guide in MCP_SERVER_DEBUG.md

### 6. Performance Requirements
- [ ] Connection must be established within 5 seconds
- [ ] Tool invocations must respond within 2 seconds
- [ ] Server must handle at least 10 concurrent Claude connections

### 7. Documentation
- [ ] Update README with MCP server setup instructions
- [ ] Document all available MCP tools and their parameters
- [ ] Include troubleshooting section for common issues
- [ ] Add example code for testing MCP connections

## Definition of Done
- All acceptance criteria checkboxes are marked complete
- Code review approved by reviewer role
- All tests pass in CI/CD pipeline
- Claude instance successfully creates test feature
- Documentation is complete and accurate`
    });
    
    console.log(`✅ Added acceptance criteria with context ID: ${acceptanceCriteria.id}`);
    console.log(`\n📋 Acceptance criteria has been added to the feature context!`);
    console.log(`\nThe architect will see this when working on the task.`);
    
    // Also add a reference to the feature metadata
    const featureUpdateQuery = db.prepare(`
      UPDATE features 
      SET metadata = json_patch(metadata, json('{"acceptanceCriteriaContextId": ?}'))
      WHERE id = ?
    `);
    
    featureUpdateQuery.run(acceptanceCriteria.id, '0819c29a-baa3-4e73-8e76-7f19a40c12f3');
    
    db.close();
  } catch (error) {
    console.error('❌ Error adding acceptance criteria:', error);
    db.close();
    process.exit(1);
  }
}

addAcceptanceCriteria().catch(console.error);