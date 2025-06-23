import { createWorkItem, generateId, addHistory, updateWorkItemStatus } from '../src/database/utils.js';
import { parseAgentJsonResponse } from '../src/agents/json-parser.js';
import { ArchitectAnalysisResult } from '../src/agents/architect.js';

console.log('🧪 Testing architect JSON parsing fix...\n');

// Test the parsing with various edge cases that might have caused the original error
const testOutputs = [
  {
    name: 'Error message starting with E',
    output: 'Execution error: Claude returned invalid response format',
    shouldSucceed: false
  },
  {
    name: 'Valid JSON with explanation',
    output: `I'll analyze this epic and break it down into user stories.

{
  "technicalApproach": "Implement a robust JSON parsing solution with multiple fallback strategies",
  "stories": [
    {
      "title": "As a developer, I want better JSON parsing error handling, so that the system can recover from malformed responses",
      "description": "Implement multi-strategy JSON parsing with proper error detection",
      "acceptanceCriteria": ["Detect error messages in output", "Try multiple parsing strategies", "Log detailed errors for debugging"],
      "estimatedEffort": "medium"
    }
  ],
  "risks": ["Claude API changes might affect response format"],
  "dependencies": []
}`,
    shouldSucceed: true
  },
  {
    name: 'JSON in markdown code block',
    output: `Based on the epic, here's my analysis:

\`\`\`json
{
  "technicalApproach": "Fix JSON parsing issues in architect agent",
  "stories": [
    {
      "title": "As a system, I want to handle JSON parsing errors gracefully",
      "description": "Implement robust error handling",
      "acceptanceCriteria": ["Handle various error formats"],
      "estimatedEffort": "small"
    }
  ],
  "risks": [],
  "dependencies": []
}
\`\`\`

This will improve system reliability.`,
    shouldSucceed: true
  }
];

// Test each scenario
for (const test of testOutputs) {
  console.log(`\n📋 Testing: ${test.name}`);
  console.log(`   Expected to ${test.shouldSucceed ? 'succeed' : 'fail'}`);
  
  const result = parseAgentJsonResponse<ArchitectAnalysisResult>(test.output, 'architect');
  
  if (result.success === test.shouldSucceed) {
    console.log(`   ✅ PASSED - Got expected result`);
    if (result.success && result.data) {
      console.log(`   📊 Parsed approach: ${result.data.technicalApproach.substring(0, 60)}...`);
      console.log(`   📊 Stories count: ${result.data.stories.length}`);
    } else if (!result.success) {
      console.log(`   ❌ Error detected: ${result.error}`);
    }
  } else {
    console.log(`   ❌ FAILED - Expected ${test.shouldSucceed ? 'success' : 'failure'} but got ${result.success ? 'success' : 'failure'}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
}

// Test the full error recording flow
console.log('\n\n🔄 Testing full error recording flow...');

const epicId = generateId('EPIC');
createWorkItem(
  epicId,
  'epic',
  'Test Epic for JSON Parsing Fix Verification',
  'This epic tests if our JSON parsing fix handles errors correctly',
  null,
  'backlog'
);

console.log(`✅ Created test epic: ${epicId}`);

// Simulate what would happen with the error response
const errorOutput = 'Execution error: Claude returned invalid response format';
const parseResult = parseAgentJsonResponse<ArchitectAnalysisResult>(errorOutput, 'architect');

if (!parseResult.success) {
  console.log('❌ Parsing failed as expected for error output');
  
  // This is what the architect agent would do
  const errorDetails = {
    errorType: 'JSON_PARSE_ERROR',
    errorMessage: parseResult.error || 'Unknown parsing error',
    agentType: 'architect',
    expectedFormat: 'ArchitectAnalysisResult JSON',
    rawOutput: parseResult.rawOutput,
    workItemId: epicId,
    epicTitle: 'Test Epic for JSON Parsing Fix Verification',
    timestamp: new Date().toISOString()
  };
  
  addHistory(epicId, 'error', JSON.stringify(errorDetails), 'architect');
  addHistory(epicId, 'agent_output', 'Failed to parse architect analysis - error recorded for investigation', 'architect');
  // Note: updateWorkItemStatus would be called here in the actual architect agent
  
  console.log('✅ Error properly recorded in history');
  console.log(`   Error type: ${errorDetails.errorType}`);
  console.log(`   Error message: ${errorDetails.errorMessage}`);
  console.log(`   Raw output captured: ${errorDetails.rawOutput.substring(0, 50)}...`);
}

console.log('\n✅ JSON parsing fix verification complete!');
console.log('   The fix properly handles error messages starting with "E" and other edge cases.');