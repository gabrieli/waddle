#!/usr/bin/env node
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Initializing orchestrator database...');
  
  try {
    // Use default database path
    const dbPath = path.join(__dirname, '../orchestrator.db');
    
    initializeDatabase(dbPath);
    
    console.log(`✅ Database initialized successfully at: ${dbPath}`);
    console.log('✅ Created tables: work_items, work_history');
    console.log('✅ Created indices for performance optimization');
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();