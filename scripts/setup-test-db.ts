#!/usr/bin/env node

// This script creates test data for development and testing
// Run with: npx tsx scripts/setup-test-db.ts

import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.join(process.cwd(), 'waddle-test.db');
console.log(`Setting up test database at: ${dbPath}`);

const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS work_items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('epic', 'story', 'task', 'bug')),
    parent_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('backlog', 'ready', 'in_progress', 'review', 'done')),
    assigned_role TEXT CHECK(assigned_role IN ('manager', 'architect', 'developer', 'reviewer', 'bug-buster')),
    processing_started_at TIMESTAMP,
    processing_agent_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES work_items(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_work_items_parent_id ON work_items(parent_id);
  CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
  CREATE INDEX IF NOT EXISTS idx_work_items_assigned_role ON work_items(assigned_role);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS work_history (
    id TEXT PRIMARY KEY,
    work_item_id TEXT NOT NULL,
    action TEXT NOT NULL,
    agent_id TEXT,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_item_id) REFERENCES work_items(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_work_history_work_item_id ON work_history(work_item_id);
  CREATE INDEX IF NOT EXISTS idx_work_history_created_at ON work_history(created_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    work_item_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_item_id) REFERENCES work_items(id)
  );

  CREATE INDEX IF NOT EXISTS idx_agents_work_item_id ON agents(work_item_id);
  CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
`);

// Clear existing data
db.exec('DELETE FROM work_history');
db.exec('DELETE FROM agents');
db.exec('DELETE FROM work_items');

// Insert test data
const epicId = uuidv4();
const storyId = uuidv4();
const taskId1 = uuidv4();
const taskId2 = uuidv4();

const insertWorkItem = db.prepare(`
  INSERT INTO work_items (id, type, parent_id, title, description, status, assigned_role)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Epic
insertWorkItem.run(
  epicId,
  'epic',
  null,
  'Implement User Authentication',
  'Add complete user authentication system',
  'ready',
  'manager'
);

// Story
insertWorkItem.run(
  storyId,
  'story',
  epicId,
  'Create Login Page',
  'Implement login page with email and password',
  'ready',
  'architect'
);

// Tasks
insertWorkItem.run(
  taskId1,
  'task',
  storyId,
  'Create Login Form Component',
  'Build React component for login form with validation',
  'ready',
  'developer'
);

insertWorkItem.run(
  taskId2,
  'task',
  storyId,
  'Implement Authentication API',
  'Create backend API endpoints for login',
  'ready',
  'developer'
);

console.log('Test database setup complete!');
console.log('Created work items:');
console.log(`  Epic: ${epicId}`);
console.log(`  Story: ${storyId}`);
console.log(`  Task 1: ${taskId1}`);
console.log(`  Task 2: ${taskId2}`);

db.close();