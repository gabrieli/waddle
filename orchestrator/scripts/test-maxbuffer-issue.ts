import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test maxBuffer limit
async function testMaxBufferLimit() {
  console.log('🧪 Testing maxBuffer limit issue...');
  
  // Create a script that outputs large amount of data
  const testScript = path.join(__dirname, 'generate-large-output.js');
  const scriptContent = `
    // Generate output larger than 10MB
    const size = 15 * 1024 * 1024; // 15MB
    const chunk = 'x'.repeat(1024); // 1KB chunk
    let output = '';
    
    while (output.length < size) {
      output += chunk;
    }
    
    console.log(output);
    console.log('Total output size:', output.length);
  `;
  
  fs.writeFileSync(testScript, scriptContent);
  
  console.log('📝 Created test script that generates 15MB of output');
  
  // Test with default 10MB buffer (should fail)
  console.log('\n🔴 Testing with 10MB buffer (should fail)...');
  exec(`node ${testScript}`, {
    maxBuffer: 10 * 1024 * 1024 // 10MB
  }, (error, stdout, stderr) => {
    if (error) {
      console.log('❌ Failed as expected:', error.message);
      if (error.message.includes('maxBuffer') || error.message.includes('stdout maxBuffer')) {
        console.log('🐛 BUG CONFIRMED: maxBuffer exceeded error');
      }
    } else {
      console.log('✅ Unexpected success - buffer was not exceeded');
    }
    
    // Test with larger buffer (should succeed)
    console.log('\n🟢 Testing with 20MB buffer (should succeed)...');
    exec(`node ${testScript}`, {
      maxBuffer: 20 * 1024 * 1024 // 20MB
    }, (error2, stdout2, stderr2) => {
      if (error2) {
        console.log('❌ Failed:', error2.message);
      } else {
        console.log('✅ Success! Larger buffer handled the output');
        console.log(`📊 Output size: ${(stdout2.length / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // Clean up
      fs.unlinkSync(testScript);
      console.log('\n🧹 Cleaned up test script');
    });
  });
}

// Test with promisified exec (as used in claude-executor)
async function testPromisifiedExec() {
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  console.log('\n🧪 Testing promisified exec (as used in claude-executor)...');
  
  // Create a script that simulates Claude output
  const testScript = path.join(__dirname, 'simulate-claude-output.js');
  const scriptContent = `
    // Simulate a large Claude response
    const response = {
      status: 'completed',
      implementationNotes: 'x'.repeat(5 * 1024 * 1024), // 5MB of notes
      filesChanged: new Array(1000).fill('file.ts'), // Many files
      testsAdded: true,
      blockers: []
    };
    
    // Add more data to exceed 10MB
    response.largeData = 'y'.repeat(6 * 1024 * 1024); // 6MB more
    
    console.log(JSON.stringify(response, null, 2));
  `;
  
  fs.writeFileSync(testScript, scriptContent);
  
  try {
    console.log('🔴 Testing with 10MB buffer...');
    const result = await execAsync(`node ${testScript}`, {
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    console.log('❌ Unexpected success - should have failed');
  } catch (error: any) {
    console.log('✅ Failed as expected:', error.message);
    if (error.message.includes('maxBuffer')) {
      console.log('🐛 CONFIRMED: This is the issue - Claude output exceeds maxBuffer');
    }
  }
  
  // Clean up
  fs.unlinkSync(testScript);
}

// Run all tests
async function runAllTests() {
  await testMaxBufferLimit();
  setTimeout(async () => {
    await testPromisifiedExec();
  }, 2000);
}

runAllTests().catch(console.error);