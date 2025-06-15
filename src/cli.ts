#!/usr/bin/env node

import { Command } from 'commander';
import { WaddleManager } from './waddle-manager';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const program = new Command();

program
  .name('waddle')
  .description('Autonomous development orchestrator')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize Waddle in the current directory')
  .action(async () => {
    const configPath = path.join(process.cwd(), 'waddle.config.json');
    
    if (fs.existsSync(configPath)) {
      console.log('Waddle already initialized in this directory');
      return;
    }

    const defaultConfig = {
      orchestrator: {
        checkIntervalMs: 30000,
        maxConcurrentTasks: 1,
        taskTimeoutMs: 3600000,
        retryAttempts: 3,
        retryDelayMs: 60000
      },
      github: {
        defaultLabels: ['waddle']
      }
    };

    await fs.promises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('Created waddle.config.json');
    
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      const envContent = `# Waddle Configuration
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
ANTHROPIC_API_KEY=your_anthropic_api_key
`;
      await fs.promises.writeFile(envPath, envContent);
      console.log('Created .env template - please update with your credentials');
    }
  });

program
  .command('start')
  .description('Start the autonomous orchestrator')
  .action(async () => {
    const manager = await createManager();
    
    manager.on('orchestrator:started', () => {
      console.log('✅ Orchestrator started');
    });

    manager.on('task:started', ({ task }) => {
      console.log(`🚀 Started task: ${task.issue.title} (Phase: ${task.state.phase})`);
    });

    manager.on('task:completed', ({ task }) => {
      console.log(`✅ Completed task: ${task.issue.title}`);
    });

    manager.on('task:failed', ({ task, error }) => {
      console.error(`❌ Failed task: ${task.issue.title} - ${error.message}`);
    });

    await manager.initialize();
    await manager.start();
    
    console.log('Waddle is running. Press Ctrl+C to stop.');
    
    process.on('SIGINT', async () => {
      console.log('\nStopping Waddle...');
      await manager.stop();
      process.exit(0);
    });
  });

program
  .command('stop')
  .description('Stop the autonomous orchestrator')
  .action(async () => {
    const manager = await createManager();
    await manager.initialize();
    await manager.stop();
    console.log('✅ Orchestrator stopped');
  });

program
  .command('pause')
  .description('Pause the autonomous orchestrator')
  .action(async () => {
    const manager = await createManager();
    await manager.initialize();
    await manager.pause();
    console.log('⏸️  Orchestrator paused');
  });

program
  .command('resume')
  .description('Resume the autonomous orchestrator')
  .action(async () => {
    const manager = await createManager();
    await manager.initialize();
    await manager.resume();
    console.log('▶️  Orchestrator resumed');
  });

program
  .command('status')
  .description('Show orchestrator status and metrics')
  .action(async () => {
    const manager = await createManager();
    await manager.initialize();
    
    const metrics = manager.getMetrics();
    
    console.log('\n📊 Orchestrator Metrics:');
    console.log(`   Tasks Processed: ${metrics.tasksProcessed}`);
    console.log(`   Tasks Succeeded: ${metrics.tasksSucceeded}`);
    console.log(`   Tasks Failed: ${metrics.tasksFailed}`);
    console.log(`   Average Execution Time: ${(metrics.averageExecutionTime / 1000).toFixed(2)}s`);
    console.log(`   Uptime: ${(metrics.uptime / 60).toFixed(2)} minutes`);
    console.log(`   Deadlocks Detected: ${metrics.deadlocksDetected}`);
    console.log(`   Deadlocks Resolved: ${metrics.deadlocksResolved}`);
  });

program
  .command('create <title>')
  .description('Create a new feature')
  .option('-d, --description <description>', 'Feature description')
  .option('-l, --labels <labels>', 'Comma-separated labels')
  .action(async (title, options) => {
    const manager = await createManager();
    await manager.initialize();
    
    const labels = options.labels ? options.labels.split(',').map((l: string) => l.trim()) : [];
    const issueNumber = await manager.createFeature(
      title,
      options.description || '',
      labels
    );
    
    console.log(`✅ Created feature issue #${issueNumber}`);
  });

program
  .command('list')
  .description('List all features')
  .option('-s, --state <state>', 'Filter by state (open, closed, all)', 'open')
  .option('-p, --phase <phase>', 'Filter by phase')
  .action(async (options) => {
    const manager = await createManager();
    await manager.initialize();
    
    const features = await manager.listFeatures({ state: options.state });
    
    console.log('\n📋 Features:');
    for (const feature of features) {
      if (options.phase && feature.state?.phase !== options.phase) {
        continue;
      }
      
      const phase = feature.state?.phase || 'unknown';
      const status = feature.issue.state;
      console.log(`   #${feature.issue.number} - ${feature.issue.title} (${phase}, ${status})`);
    }
  });

program
  .command('feature <number>')
  .description('Show feature details')
  .action(async (number) => {
    const manager = await createManager();
    await manager.initialize();
    
    const status = await manager.getFeatureStatus(parseInt(number));
    
    console.log(`\n📄 Feature #${status.issue.number}: ${status.issue.title}`);
    console.log(`   State: ${status.issue.state}`);
    console.log(`   Phase: ${status.state?.phase || 'unknown'}`);
    console.log(`   Created: ${new Date(status.issue.created_at).toLocaleDateString()}`);
    console.log(`   Updated: ${new Date(status.issue.updated_at).toLocaleDateString()}`);
    
    if (status.state?.history && status.state.history.length > 0) {
      console.log('\n   History:');
      for (const entry of status.state.history) {
        console.log(`     - ${entry.phase} (${new Date(entry.timestamp).toLocaleDateString()})`);
      }
    }
    
    if (status.isActive) {
      console.log('\n   ⚡ Currently being processed');
    }
  });

async function createManager(): Promise<WaddleManager> {
  const requiredEnvVars = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO', 'ANTHROPIC_API_KEY'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Error: ${envVar} environment variable is required`);
      console.error('Please set it in your .env file or environment');
      process.exit(1);
    }
  }

  return new WaddleManager({
    github: {
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!
    },
    llm: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: process.env.ANTHROPIC_MODEL
    },
    workingDir: process.cwd()
  });
}

program.parse();