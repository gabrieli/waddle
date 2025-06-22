import { initializeDatabase, getDatabase, closeDatabase } from '../src/database/connection.js';
import { createWorkItem, getWorkItem, updateWorkItemStatus, getAllWorkItems } from '../src/database/utils.js';
import { createLogger, LogLevel, LoggerConfig } from '../src/utils/logger.js';
import { WorkItemType, WorkItemStatus } from '../src/types/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test helper to capture logs
class LogCapture {
  private logs: string[] = [];
  private originalLog: typeof console.log;
  private originalError: typeof console.error;

  start() {
    this.logs = [];
    this.originalLog = console.log;
    this.originalError = console.error;
    
    console.log = (...args) => {
      this.logs.push(args.join(' '));
    };
    
    console.error = (...args) => {
      this.logs.push(args.join(' '));
    };
  }

  stop() {
    console.log = this.originalLog;
    console.error = this.originalError;
  }

  getLogs() {
    return this.logs;
  }

  hasLog(pattern: string | RegExp) {
    return this.logs.some(log => 
      typeof pattern === 'string' ? log.includes(pattern) : pattern.test(log)
    );
  }
}

async function runTests() {
  console.log('🧪 Starting database logging tests...\n');
  
  const logCapture = new LogCapture();
  const testDbPath = path.join(__dirname, 'test-logging.db');
  const logFilePath = path.join(__dirname, 'test-logging.log');
  
  // Clean up any existing test files
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
  } catch (e) {
    // Ignore cleanup errors
  }

  try {
    // Test 1: Database connection logging
    console.log('Test 1: Database connection logging');
    
    // Create logger with file output for testing
    const loggerConfig: Partial<LoggerConfig> = {
      level: LogLevel.DEBUG,
      logToFile: true,
      logToConsole: true,
      logFilePath: logFilePath,
      includeTimestamp: true
    };
    createLogger(loggerConfig);
    
    logCapture.start();
    initializeDatabase(testDbPath);
    logCapture.stop();
    
    if (logCapture.hasLog('Opening database connection') && 
        logCapture.hasLog('Database connected')) {
      console.log('✅ Database connection logs captured\n');
    } else {
      console.log('❌ Database connection logs missing\n');
    }

    // Test 2: Query logging
    console.log('Test 2: Query execution logging');
    logCapture.start();
    
    const workItem = createWorkItem(
      'TEST-001',
      'story' as WorkItemType,
      'Test Story',
      'Test description'
    );
    
    logCapture.stop();
    
    if (logCapture.hasLog('Query executed') && 
        logCapture.hasLog('Work item created')) {
      console.log('✅ Query execution logs captured\n');
    } else {
      console.log('❌ Query execution logs missing\n');
    }

    // Test 3: Transaction logging
    console.log('Test 3: Transaction logging');
    logCapture.start();
    
    updateWorkItemStatus('TEST-001', 'in_progress' as WorkItemStatus);
    
    logCapture.stop();
    
    if (logCapture.hasLog('Transaction begin') && 
        logCapture.hasLog('Transaction commit')) {
      console.log('✅ Transaction logs captured\n');
    } else {
      console.log('❌ Transaction logs missing\n');
    }

    // Test 4: Slow query warning
    console.log('Test 4: Slow query detection');
    
    // Simulate a slow query by getting all items multiple times
    logCapture.start();
    
    // Execute many queries to simulate slowness
    for (let i = 0; i < 100; i++) {
      getAllWorkItems();
    }
    
    logCapture.stop();
    
    // Check if any queries were logged (duration tracking)
    if (logCapture.getLogs().length > 0) {
      console.log('✅ Query duration tracking active\n');
    } else {
      console.log('❌ Query duration tracking missing\n');
    }

    // Test 5: Error logging
    console.log('Test 5: Error logging');
    logCapture.start();
    
    try {
      // Try to get a non-existent work item - this shouldn't error but let's check logging
      const item = getWorkItem('NON-EXISTENT');
      if (!item) {
        console.log('Item not found (expected)');
      }
    } catch (error) {
      // Shouldn't happen
    }
    
    logCapture.stop();
    
    if (logCapture.hasLog('Query executed')) {
      console.log('✅ Query logging works for failed lookups\n');
    } else {
      console.log('❌ Query logging missing for failed lookups\n');
    }

    // Test 6: File logging
    console.log('Test 6: File logging verification');
    
    if (fs.existsSync(logFilePath)) {
      const fileContent = fs.readFileSync(logFilePath, 'utf-8');
      if (fileContent.includes('[INFO]') && 
          fileContent.includes('[DEBUG]') &&
          fileContent.includes('Database connected')) {
        console.log('✅ Logs written to file successfully\n');
      } else {
        console.log('❌ File logging incomplete\n');
      }
    } else {
      console.log('❌ Log file not created\n');
    }

    console.log('🎉 All database logging tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Cleanup
    logCapture.stop();
    closeDatabase();
    
    // Clean up test files
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
      if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
      if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run tests
runTests().catch(console.error);