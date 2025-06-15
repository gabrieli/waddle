#!/usr/bin/env ts-node

/**
 * Script to load the Waddle epic and all user stories into the database
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { FeatureRepository, TaskRepository } from '../src/database/repositories';

// Epic and user stories data
const EPIC = {
  id: 'epic-001',
  description: `Epic: AI-Powered Software Development Team

Build a comprehensive development workflow framework that simulates a complete software development team using AI. The system will enforce industry best practices through structured roles, automated reviews, and quality-first principles.

Key Features:
- 5 Development Roles: Product Manager, Technical Architect, Developer, Security Expert, and QA Tester  
- 6 Review Specialists: Architectural, Security, Testing, Documentation, DevOps, and UX reviews
- Autonomous Orchestration: Continuous loop that automatically progresses work through phases
- AI-Powered Decision Making: Intelligent task routing and deadlock resolution
- Test-Driven Development: Enforced red-green-refactor cycle
- Automated Pre-commit Validation: Never bypass quality checks
- Self-Healing: Automatic recovery and improvement

The system should be able to work autonomously, progressing features through all development phases without human intervention.`,
  priority: 'urgent' as const
};

const USER_STORIES = [
  {
    id: 'story-001',
    description: 'As a developer, I want to define development team roles so that AI agents can simulate different team members',
    status: 'complete'
  },
  {
    id: 'story-002', 
    description: 'As a developer, I want to define review specialist roles so that code quality is automatically enforced',
    status: 'complete'
  },
  {
    id: 'story-003',
    description: 'As a developer, I want project structure and initial documentation so that the framework is well-organized',
    status: 'complete'
  },
  {
    id: 'story-004',
    description: 'As a developer, I want AI guidelines (CLAUDE.md) so that AI assistants follow best practices',
    status: 'complete'
  },
  {
    id: 'story-005',
    description: 'As a developer, I want an autonomous orchestrator engine so that work progresses automatically',
    status: 'complete'
  },
  {
    id: 'story-006',
    description: 'As a PM, I want to create and manage features through a CLI so I can track development progress',
    status: 'pending'
  },
  {
    id: 'story-007',
    description: 'As a developer, I want the system to automatically create technical designs from requirements',
    status: 'pending'
  },
  {
    id: 'story-008',
    description: 'As a developer, I want the system to implement code based on technical designs',
    status: 'pending'
  },
  {
    id: 'story-009',
    description: 'As a reviewer, I want automated code reviews to ensure quality standards',
    status: 'pending'
  },
  {
    id: 'story-010',
    description: 'As a QA tester, I want automated testing of implemented features',
    status: 'pending'
  },
  {
    id: 'story-011',
    description: 'As a developer, I want database persistence for tracking feature and task states',
    status: 'complete'
  },
  {
    id: 'story-012',
    description: 'As a developer, I want MCP server integration for Claude tool usage',
    status: 'complete'
  },
  {
    id: 'story-013',
    description: 'As a developer, I want self-healing capabilities so the system can fix its own issues',
    status: 'pending'
  },
  {
    id: 'story-014',
    description: 'As a developer, I want comprehensive logging and monitoring of the autonomous system',
    status: 'pending'
  },
  {
    id: 'story-015',
    description: 'As a developer, I want performance metrics and optimization for the orchestrator',
    status: 'pending'
  }
];

async function loadEpicAndStories() {
  // Open database
  const dbPath = join(__dirname, '..', 'waddle.db');
  const db = new Database(dbPath);
  
  // Initialize repositories
  const featureRepo = new FeatureRepository(db);
  const taskRepo = new TaskRepository(db);
  
  console.log('🐧 Loading Waddle epic and user stories...\n');
  
  // Create the epic as a feature
  const epic = featureRepo.create({
    description: EPIC.description,
    priority: EPIC.priority,
    metadata: { 
      type: 'epic',
      originalId: EPIC.id 
    }
  });
  
  console.log(`✅ Created epic: ${epic.id}`);
  
  // Create user stories as features
  for (const story of USER_STORIES) {
    try {
      const feature = featureRepo.create({
        description: story.description,
        priority: 'high',
        metadata: {
          type: 'user-story',
          originalId: story.id,
          epicId: epic.id,
          initialStatus: story.status
        }
      });
      
      console.log(`✅ Created story ${story.id}: ${feature.id}`);
      
      // If story is pending, create initial architect task
      if (story.status === 'pending') {
        const task = taskRepo.create({
          featureId: feature.id,
          role: 'architect',
          description: `Create technical design for: ${story.description}`
        });
        
        console.log(`   📋 Created architect task: ${task.id}`);
      } else if (story.status === 'complete') {
        // Mark feature as complete
        featureRepo.update(feature.id, { 
          status: 'complete',
          completedAt: new Date()
        });
      }
    } catch (error) {
      console.error(`❌ Failed to create story ${story.id}:`, error);
    }
  }
  
  // Get metrics
  const features = featureRepo.findAll();
  const tasks = taskRepo.findAll();
  
  console.log('\n📊 Summary:');
  console.log(`   Total features: ${features.length}`);
  console.log(`   Pending features: ${features.filter(f => f.status === 'pending').length}`);
  console.log(`   Complete features: ${features.filter(f => f.status === 'complete').length}`);
  console.log(`   Total tasks: ${tasks.length}`);
  console.log(`   Pending tasks: ${tasks.filter(t => t.status === 'pending').length}`);
  
  // Close database
  db.close();
  
  console.log('\n✅ Epic and stories loaded successfully!');
  console.log('🚀 You can now start Waddle to begin autonomous processing.');
}

// Run the script
loadEpicAndStories().catch(error => {
  console.error('Failed to load epic and stories:', error);
  process.exit(1);
});