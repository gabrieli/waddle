#!/usr/bin/env node
/**
 * Waddle CLI - AI development team that waddles so your projects can run 🐧
 */

import { Command } from 'commander';
import { version } from '../../package.json';
import { WaddleManager } from '../orchestrator';
import { MCPServer } from '../mcp-server';
import { Database as SQLiteDatabase } from '../database';
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync } from 'fs';

const program = new Command();
let manager: WaddleManager | null = null;
let mcpServer: MCPServer | null = null;

program
  .name('waddle')
  .description('AI development team that waddles so your projects can run 🐧')
  .version(version);

program
  .command('start')
  .description('Start the Waddle Manager')
  .option('-d, --daemon', 'Run in background')
  .option('-p, --port <port>', 'MCP server port', '5173')
  .option('-w, --web-port <port>', 'Web UI port', '8080')
  .option('--db <path>', 'Database path', './waddle.db')
  .action(async (options) => {
    try {
      console.log('🐧 Starting Waddle Manager...');
      
      // Check if database exists
      const dbPath = join(process.cwd(), options.db);
      if (!existsSync(dbPath)) {
        console.error('❌ Database not found. Run migrations first:');
        console.error('   npm run db:migrate');
        process.exit(1);
      }
      
      // Open database
      const db = new Database(dbPath);
      const sqliteDb = new SQLiteDatabase(dbPath);
      
      // Create and initialize manager
      manager = new WaddleManager();
      await manager.initialize(db, {
        checkIntervalMs: 30000,
        maxConcurrentTasks: 20, // Global limit (must be >= highest role limit)
        maxConcurrentByRole: {
          architect: 20,
          developer: 1,
          reviewer: 5
        },
        taskTimeoutMs: 3600000,
        maxTaskAttempts: 3,
        selfHealingEnabled: true,
        mcpServerUrl: `http://localhost:${options.port}`,
        claudePath: '/Users/gabrielionescu/.claude/local/claude'
      });
      
      // Set up event handlers
      manager.on('task:started', ({ task }) => {
        console.log(`🚀 Started: ${task.role} task for feature ${task.featureId}`);
      });
      
      manager.on('task:completed', ({ task }) => {
        console.log(`✅ Completed: ${task.role} task for feature ${task.featureId}`);
      });
      
      manager.on('task:failed', ({ task, error }) => {
        console.log(`❌ Failed: ${task.role} task for feature ${task.featureId} - ${error}`);
      });
      
      manager.on('feature:completed', ({ featureId }) => {
        console.log(`🎉 Feature completed: ${featureId}`);
      });
      
      manager.on('self-healing:created', ({ type, description }) => {
        console.log(`🔧 Self-healing: ${type} - ${description}`);
      });
      
      // Start MCP server
      mcpServer = new MCPServer(sqliteDb, manager, parseInt(options.port));
      await mcpServer.start();
      
      // Start the manager
      await manager.start();
      
      console.log('✅ Waddle Manager started successfully');
      console.log(`📊 MCP Server: http://localhost:${options.port}`);
      console.log(`🌐 Web UI: http://localhost:${options.webPort}`);
      console.log('\n📝 Interactive commands:');
      console.log('  start-dev  - Start development mode (begin processing tasks)');
      console.log('  stop-dev   - Stop development mode (pause task processing)');
      console.log('  status     - Show current status');
      console.log('  pause      - Pause all operations');
      console.log('  resume     - Resume operations');
      console.log('  exit       - Stop Waddle and exit\n');
      
      // Set up interactive mode
      if (!options.daemon) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          prompt: 'waddle> '
        });
        
        rl.prompt();
        
        rl.on('line', async (line: string) => {
          const cmd = line.trim().toLowerCase();
          
          switch (cmd) {
            case 'start-dev':
              if (manager) {
                manager.startDevelopment();
                console.log('✅ Development mode started');
              }
              break;
              
            case 'stop-dev':
              if (manager) {
                manager.stopDevelopment();
                console.log('🛑 Development mode stopped');
              }
              break;
              
            case 'status':
              if (manager) {
                const devMode = manager.isDevelopmentMode();
                const metrics = manager.getMetrics();
                console.log(`\n📊 Status: ${devMode ? 'Development Mode Active' : 'MCP Server Only'}`);
                console.log(`Running tasks: ${manager.getRunningTasks().length}`);
                console.log(`Pending tasks: ${metrics.tasks.pending}`);
              }
              break;
              
            case 'pause':
              if (manager) {
                await manager.pause();
                console.log('⏸️  Operations paused');
              }
              break;
              
            case 'resume':
              if (manager) {
                await manager.resume();
                console.log('▶️  Operations resumed');
              }
              break;
              
            case 'exit':
              console.log('👋 Goodbye!');
              if (mcpServer) {
                await mcpServer.stop();
              }
              if (manager) {
                await manager.stop();
                db.close();
              }
              process.exit(0);
              break;
              
            case 'help':
              console.log('\n📝 Available commands:');
              console.log('  start-dev  - Start development mode');
              console.log('  stop-dev   - Stop development mode');
              console.log('  status     - Show current status');
              console.log('  pause      - Pause all operations');
              console.log('  resume     - Resume operations');
              console.log('  exit       - Stop and exit\n');
              break;
              
            default:
              if (cmd) {
                console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
              }
          }
          
          rl.prompt();
        });
        
        rl.on('close', async () => {
          console.log('\n👋 Goodbye!');
          if (mcpServer) {
            await mcpServer.stop();
          }
          if (manager) {
            await manager.stop();
            db.close();
          }
          process.exit(0);
        });
      }
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping Waddle Manager...');
        if (mcpServer) {
          await mcpServer.stop();
        }
        if (manager) {
          await manager.stop();
          db.close();
        }
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Failed to start:', error);
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the Waddle Manager')
  .action(async () => {
    console.log('🛑 Stopping Waddle Manager...');
    if (mcpServer) {
      await mcpServer.stop();
    }
    if (manager) {
      await manager.stop();
    }
    process.exit(0);
  });

program
  .command('status')
  .description('Check Waddle Manager status')
  .option('--db <path>', 'Database path', './waddle.db')
  .action(async (options) => {
    try {
      const dbPath = join(process.cwd(), options.db);
      if (!existsSync(dbPath)) {
        console.error('❌ Database not found');
        process.exit(1);
      }
      
      const db = new Database(dbPath);
      const tempManager = new WaddleManager();
      await tempManager.initialize(db, {
        claudePath: '/Users/gabrielionescu/.claude/local/claude'
      });
      
      const metrics = tempManager.getMetrics();
      
      console.log('📊 Waddle Manager Status\n');
      console.log('Features:');
      console.log(`  Total: ${metrics.features.total}`);
      console.log(`  Pending: ${metrics.features.pending}`);
      console.log(`  In Progress: ${metrics.features.inProgress}`);
      console.log(`  Complete: ${metrics.features.complete}`);
      console.log(`  Failed: ${metrics.features.failed}`);
      console.log('\nTasks:');
      console.log(`  Total: ${metrics.tasks.total}`);
      console.log(`  Pending: ${metrics.tasks.pending}`);
      console.log(`  In Progress: ${metrics.tasks.inProgress}`);
      console.log(`  Complete: ${metrics.tasks.complete}`);
      console.log(`  Failed: ${metrics.tasks.failed}`);
      console.log('\nOrchestrator:');
      console.log(`  Running: ${metrics.orchestrator.running}`);
      console.log(`  Paused: ${metrics.orchestrator.paused}`);
      console.log(`  Active Tasks: ${metrics.orchestrator.runningTasks}/${metrics.orchestrator.maxConcurrent}`);
      
      db.close();
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage Waddle configuration')
  .argument('[key]', 'Configuration key')
  .argument('[value]', 'Configuration value')
  .action((key?: string, value?: string) => {
    if (!key) {
      // eslint-disable-next-line no-console
      console.log('📋 Current configuration');
    } else if (!value) {
      // eslint-disable-next-line no-console
      console.log(`📋 Config ${key}:`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`✅ Set ${key} = ${value}`);
    }
  });

program.parse();

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});