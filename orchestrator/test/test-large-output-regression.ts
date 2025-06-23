import { executeClaudeAgent } from '../src/agents/claude-executor.js';
import { OrchestratorConfig } from '../src/orchestrator/config.js';
import { expect } from 'chai';

describe('Large Output Regression Tests', () => {
  const mockConfig: OrchestratorConfig = {
    pollingInterval: 30000,
    claudeExecutable: 'echo', // Use echo for testing
    workingDirectory: process.cwd(),
    database: ':memory:',
    maxBufferMB: 200, // Large buffer to handle big outputs
    agents: {
      manager: { model: 'test' },
      architect: { model: 'test' },
      developer: { model: 'test' }
    }
  };

  it('should handle outputs larger than 10MB without error', async () => {
    // Create a large output (15MB)
    const largeOutput = 'x'.repeat(15 * 1024 * 1024);
    mockConfig.claudeExecutable = `node -e "console.log('${largeOutput}')"`;
    
    const result = await executeClaudeAgent('test', 'test prompt', mockConfig);
    
    expect(result.success).to.be.true;
    expect(result.output.length).to.be.greaterThan(10 * 1024 * 1024);
    expect(result.error).to.be.undefined;
  });

  it('should respect custom maxBuffer settings', async () => {
    // Test with small buffer (should fail)
    const smallBufferConfig = { ...mockConfig, maxBufferMB: 1 };
    const largeOutput = 'y'.repeat(2 * 1024 * 1024); // 2MB
    smallBufferConfig.claudeExecutable = `node -e "console.log('${largeOutput}')"`;
    
    const result = await executeClaudeAgent('test', 'test prompt', smallBufferConfig);
    
    expect(result.success).to.be.false;
    expect(result.error).to.include('maxBuffer');
  });

  it('should use default maxBuffer when not specified', async () => {
    const configWithoutMaxBuffer = { ...mockConfig };
    delete configWithoutMaxBuffer.maxBufferMB;
    
    // Default is 100MB, so 50MB should work
    const mediumOutput = 'z'.repeat(50 * 1024 * 1024);
    configWithoutMaxBuffer.claudeExecutable = `node -e "console.log('${mediumOutput}')"`;
    
    const result = await executeClaudeAgent('test', 'test prompt', configWithoutMaxBuffer);
    
    expect(result.success).to.be.true;
    expect(result.output.length).to.be.greaterThan(40 * 1024 * 1024);
  });
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  import('mocha').then(({ default: Mocha }) => {
    const mocha = new Mocha();
    mocha.addFile(import.meta.url.replace('file://', ''));
    mocha.run(failures => {
      process.exit(failures ? 1 : 0);
    });
  });
}