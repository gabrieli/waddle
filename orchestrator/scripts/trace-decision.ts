#!/usr/bin/env node
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';
import { getWorkItem, getWorkHistory } from '../src/database/utils.js';
import { 
  getPatternsByFilter, 
  getADRsByWorkItem,
  getReviewsByWorkItem,
  getMessagesForAgent
} from '../src/database/knowledge.js';
import { WorkHistory } from '../src/types/index.js';
import { Pattern, ADR, Review, AgentCommunication } from '../src/types/knowledge.js';

interface DecisionContext {
  workItem: any;
  history: WorkHistory[];
  patterns: Pattern[];
  adrs: ADR[];
  reviews: Review[];
  messages: AgentCommunication[];
}

function printUsage() {
  console.log('Usage: npm run trace-decision -- <work-item-id> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --export, -e     Export decision trace to JSON file');
  console.log('  --verbose, -v    Show detailed context information');
  console.log('');
  console.log('Examples:');
  console.log('  npm run trace-decision -- STORY-ABC123');
  console.log('  npm run trace-decision -- TASK-XYZ789 --verbose');
  console.log('  npm run trace-decision -- BUG-123 --export');
}

function parseArgs(args: string[]): { workItemId?: string; export?: boolean; verbose?: boolean } {
  const result: { workItemId?: string; export?: boolean; verbose?: boolean } = {};
  
  // First non-option arg is the work item ID
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (!arg.startsWith('--') && !arg.startsWith('-') && !result.workItemId) {
      result.workItemId = arg;
    } else if (arg === '--export' || arg === '-e') {
      result.export = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    }
  }
  
  return result;
}

function extractPatternsFromHistory(history: WorkHistory[]): string[] {
  const patternIds: Set<string> = new Set();
  
  // Look for pattern references in agent outputs and decisions
  history.forEach(entry => {
    if (entry.content) {
      // Simple pattern matching for pattern IDs (PATTERN-XXXXXX)
      const matches = entry.content.match(/PATTERN-[A-Z0-9]+/g);
      if (matches) {
        matches.forEach(id => patternIds.add(id));
      }
    }
  });
  
  return Array.from(patternIds);
}

function analyzeDecisionFlow(context: DecisionContext): {
  timeline: any[];
  influencingFactors: any[];
  agentInvolvement: any;
} {
  const timeline: any[] = [];
  const influencingFactors: any[] = [];
  const agentInvolvement: Record<string, number> = {};
  
  // Build timeline from history
  context.history.forEach(entry => {
    timeline.push({
      timestamp: entry.created_at,
      action: entry.action,
      agent: entry.created_by,
      summary: entry.content ? entry.content.substring(0, 200) + '...' : 'No content'
    });
    
    // Track agent involvement
    agentInvolvement[entry.created_by] = (agentInvolvement[entry.created_by] || 0) + 1;
  });
  
  // Identify influencing patterns
  context.patterns.forEach(pattern => {
    if (pattern.usage_count > 0) {
      influencingFactors.push({
        type: 'pattern',
        id: pattern.id,
        agent: pattern.agent_role,
        effectiveness: pattern.effectiveness_score,
        context: pattern.context
      });
    }
  });
  
  // Identify influencing ADRs
  context.adrs.forEach(adr => {
    if (adr.status === 'accepted') {
      influencingFactors.push({
        type: 'adr',
        id: adr.id,
        title: adr.title,
        decision: adr.decision
      });
    }
  });
  
  // Identify influencing reviews
  context.reviews.forEach(review => {
    influencingFactors.push({
      type: 'review',
      id: review.id,
      reviewer: review.reviewer_role,
      status: review.status,
      feedback: review.feedback
    });
  });
  
  return { timeline, influencingFactors, agentInvolvement };
}

function displayDecisionTrace(context: DecisionContext, verbose: boolean) {
  const { timeline, influencingFactors, agentInvolvement } = analyzeDecisionFlow(context);
  
  console.log(`\n🔍 DECISION TRACE: ${context.workItem.id}`);
  console.log('='.repeat(80));
  console.log(`\nWork Item: ${context.workItem.title}`);
  console.log(`Type: ${context.workItem.type} | Status: ${context.workItem.status}`);
  
  if (context.workItem.description) {
    console.log(`Description: ${context.workItem.description}`);
  }
  
  // Agent involvement summary
  console.log('\n👥 Agent Involvement:');
  Object.entries(agentInvolvement).forEach(([agent, count]) => {
    console.log(`   ${agent}: ${count} action(s)`);
  });
  
  // Timeline
  console.log('\n📅 Decision Timeline:');
  timeline.forEach((event, index) => {
    console.log(`\n${index + 1}. ${new Date(event.timestamp).toLocaleString()}`);
    console.log(`   Agent: ${event.agent} | Action: ${event.action}`);
    if (verbose) {
      console.log(`   Details: ${event.summary}`);
    }
  });
  
  // Influencing factors
  if (influencingFactors.length > 0) {
    console.log('\n💡 Influencing Factors:');
    
    const patterns = influencingFactors.filter(f => f.type === 'pattern');
    if (patterns.length > 0) {
      console.log('\n   Patterns Used:');
      patterns.forEach(pattern => {
        console.log(`   - ${pattern.id} (${pattern.agent}, ${(pattern.effectiveness * 100).toFixed(1)}% effective)`);
        if (verbose) {
          console.log(`     Context: ${pattern.context}`);
        }
      });
    }
    
    const adrs = influencingFactors.filter(f => f.type === 'adr');
    if (adrs.length > 0) {
      console.log('\n   Architecture Decisions:');
      adrs.forEach(adr => {
        console.log(`   - ${adr.id}: ${adr.title}`);
        if (verbose) {
          console.log(`     Decision: ${adr.decision}`);
        }
      });
    }
    
    const reviews = influencingFactors.filter(f => f.type === 'review');
    if (reviews.length > 0) {
      console.log('\n   Reviews:');
      reviews.forEach(review => {
        console.log(`   - ${review.id} by ${review.reviewer} (${review.status})`);
        if (verbose) {
          console.log(`     Feedback: ${review.feedback}`);
        }
      });
    }
  }
  
  // Related communications
  if (context.messages.length > 0) {
    console.log('\n💬 Related Communications:');
    console.log(`   Total messages: ${context.messages.length}`);
    if (verbose) {
      context.messages.slice(0, 5).forEach(msg => {
        console.log(`   - ${msg.from_agent} → ${msg.to_agent}: ${msg.subject}`);
      });
    }
  }
  
  console.log('\n' + '─'.repeat(80));
  console.log('Summary:');
  console.log(`  Total actions: ${timeline.length}`);
  console.log(`  Agents involved: ${Object.keys(agentInvolvement).length}`);
  console.log(`  Influencing factors: ${influencingFactors.length}`);
  console.log(`  Related messages: ${context.messages.length}`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  const options = parseArgs(args);
  
  if (!options.workItemId) {
    console.error('❌ Error: Work item ID is required');
    printUsage();
    process.exit(1);
  }
  
  try {
    // Initialize database
    initializeDatabase();
    
    // Get work item
    const workItem = getWorkItem(options.workItemId);
    if (!workItem) {
      console.error(`❌ Error: Work item ${options.workItemId} not found`);
      process.exit(1);
    }
    
    // Get work history
    const history = getWorkHistory(options.workItemId);
    
    // Extract pattern references from history
    const patternIds = extractPatternsFromHistory(history);
    
    // Get related patterns (those used by the agents involved)
    const involvedAgents = [...new Set(history.map(h => h.created_by))];
    const patterns: Pattern[] = [];
    
    involvedAgents.forEach(agent => {
      const agentPatterns = getPatternsByFilter({
        agent_role: agent as any,
        max_results: 10
      });
      patterns.push(...agentPatterns);
    });
    
    // Get ADRs for this work item
    const adrs = getADRsByWorkItem(options.workItemId);
    
    // Get reviews for this work item
    const reviews = getReviewsByWorkItem(options.workItemId);
    
    // Get messages related to this work item
    const messages: AgentCommunication[] = [];
    involvedAgents.forEach(agent => {
      const agentMessages = getMessagesForAgent(agent);
      const relatedMessages = agentMessages.filter(
        msg => msg.work_item_id === options.workItemId
      );
      messages.push(...relatedMessages);
    });
    
    const context: DecisionContext = {
      workItem,
      history,
      patterns,
      adrs,
      reviews,
      messages
    };
    
    // Display trace
    displayDecisionTrace(context, options.verbose || false);
    
    // Export if requested
    if (options.export) {
      const filename = `decision-trace-${options.workItemId}-${Date.now()}.json`;
      const fs = await import('fs');
      fs.writeFileSync(filename, JSON.stringify(context, null, 2));
      console.log(`\n✅ Exported to ${filename}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to trace decision:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();