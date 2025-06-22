import { parseAgentJsonResponse } from '../src/agents/json-parser.js';
import { ArchitectAnalysisResult } from '../src/agents/architect.js';

console.log('🧪 Testing JSON parsing functionality...\n');

// Test cases
const testCases = [
  {
    name: 'Valid JSON',
    input: `{
      "technicalApproach": "Test approach",
      "stories": [{"title": "Test story", "description": "Test", "acceptanceCriteria": ["AC1"], "estimatedEffort": "small"}],
      "risks": [],
      "dependencies": []
    }`,
    expectSuccess: true
  },
  {
    name: 'JSON with markdown code block',
    input: `Here's the analysis:
    
\`\`\`json
{
  "technicalApproach": "Test approach",
  "stories": [{"title": "Test story", "description": "Test", "acceptanceCriteria": ["AC1"], "estimatedEffort": "small"}],
  "risks": [],
  "dependencies": []
}
\`\`\``,
    expectSuccess: true
  },
  {
    name: 'JSON with explanation text',
    input: `I've analyzed the epic and here's my response:

{
  "technicalApproach": "Test approach",
  "stories": [{"title": "Test story", "description": "Test", "acceptanceCriteria": ["AC1"], "estimatedEffort": "small"}],
  "risks": [],
  "dependencies": []
}

This will create 1 story.`,
    expectSuccess: true
  },
  {
    name: 'Error message starting with E',
    input: 'Execution error: Claude returned invalid response format',
    expectSuccess: false
  },
  {
    name: 'Error with colon',
    input: 'Error: Unable to process the request',
    expectSuccess: false
  },
  {
    name: 'Malformed JSON',
    input: '{ "technicalApproach": "Test", "stories": [',
    expectSuccess: false
  },
  {
    name: 'No JSON present',
    input: 'This is just plain text without any JSON',
    expectSuccess: false
  },
  {
    name: 'Nested JSON objects',
    input: `{
      "technicalApproach": "Complex approach",
      "stories": [{
        "title": "Story with nested data",
        "description": "Test",
        "acceptanceCriteria": ["AC1"],
        "estimatedEffort": "medium",
        "metadata": { "priority": "high", "tags": ["test", "nested"] }
      }],
      "risks": ["Risk with {braces} in text"],
      "dependencies": []
    }`,
    expectSuccess: true
  }
];

// Run tests
let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`\n📋 Test: ${testCase.name}`);
  console.log(`   Input: ${testCase.input.substring(0, 50)}...`);
  
  const result = parseAgentJsonResponse<ArchitectAnalysisResult>(testCase.input, 'test');
  
  if (result.success === testCase.expectSuccess) {
    console.log(`   ✅ PASSED - Expected ${testCase.expectSuccess ? 'success' : 'failure'} and got it`);
    if (result.success && result.data) {
      console.log(`   📊 Parsed data: ${JSON.stringify(result.data).substring(0, 100)}...`);
    }
    passed++;
  } else {
    console.log(`   ❌ FAILED - Expected ${testCase.expectSuccess ? 'success' : 'failure'} but got ${result.success ? 'success' : 'failure'}`);
    console.log(`   Error: ${result.error}`);
    failed++;
  }
}

console.log('\n📊 Test Results:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Total: ${testCases.length}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed!');
} else {
  console.log('\n⚠️  Some tests failed. Please review the results above.');
}