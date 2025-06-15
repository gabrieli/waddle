#!/usr/bin/env ts-node

import Database from 'better-sqlite3';
import { join } from 'path';
import { FeatureRepository, TaskRepository } from '../src/database/repositories';

async function createTestArchitectFeature() {
  const dbPath = join(__dirname, '..', 'waddle.db');
  const db = new Database(dbPath);
  
  try {
    const featureRepo = new FeatureRepository(db);
    const taskRepo = new TaskRepository(db);
    
    // Create a simple test feature
    const feature = featureRepo.create({
      description: `Test Architect Discovery: Create a simple "Hello World" technical discovery system
      
      This is a test feature to validate that:
      1. The architect can create technical discoveries
      2. User stories are properly generated
      3. Architecture decisions are documented
      4. The system correctly stores and links all artifacts
      
      Requirements:
      - Create at least one technical discovery
      - Create at least one architecture decision  
      - Create at least one user story
      - All artifacts should be about a simple "Hello World" system`,
      priority: 'low',
      metadata: {
        type: 'test',
        purpose: 'validate-architect-artifacts',
        expectedCompletionTime: '30 seconds'
      }
    });
    
    // Create architect task
    const task = taskRepo.create({
      featureId: feature.id,
      role: 'architect',
      description: 'Design a simple Hello World technical discovery system with proper artifacts'
    });
    
    console.log(`✅ Created test feature: ${feature.id}`);
    console.log(`📋 Created architect task: ${task.id}`);
    console.log(`\n🧪 Test Feature: "${feature.description.split('\\n')[0]}" has been added!`);
    console.log(`\nThis feature should complete quickly and demonstrate:`);
    console.log(`- Technical discovery creation`);
    console.log(`- Architecture decision recording`);
    console.log(`- User story generation`);
    console.log(`\nRun Waddle in development mode to process this test.`);
    
    db.close();
  } catch (error) {
    console.error('❌ Error creating test feature:', error);
    db.close();
    process.exit(1);
  }
}

createTestArchitectFeature().catch(console.error);