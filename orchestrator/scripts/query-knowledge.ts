#!/usr/bin/env node
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';
import { 
  getPatternsByFilter, 
  getADRsByStatus, 
  getADRsByWorkItem,
  getReviewsByWorkItem,
  getMessagesForAgent,
  incrementPatternUsage
} from '../src/database/knowledge.js';
import { 
  Pattern, 
  ADR, 
  Review, 
  AgentCommunication,
  PatternType,
  ADRStatus
} from '../src/types/knowledge.js';
import { AgentRole } from '../src/types/index.js';

interface QueryOptions {
  command?: string;
  type?: string;
  agent?: string;
  status?: string;
  workItem?: string;
  minScore?: number;
  limit?: number;
  search?: string;
  export?: boolean;
}

function printUsage() {
  console.log('Usage: npm run query-knowledge -- <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  patterns    Search and view patterns');
  console.log('  adrs        Search and view Architecture Decision Records');
  console.log('  reviews     View reviews for a work item');
  console.log('  messages    View agent communications');
  console.log('');
  console.log('Options:');
  console.log('  --type, -t       Pattern type (solution, approach, tool_usage, error_handling, optimization)');
  console.log('  --agent, -a      Agent role (manager, architect, developer, reviewer, bug-buster)');
  console.log('  --status, -s     ADR status (proposed, accepted, deprecated, superseded)');
  console.log('  --work-item, -w  Work item ID');
  console.log('  --min-score      Minimum effectiveness score for patterns (0.0-1.0)');
  console.log('  --limit, -l      Maximum number of results');
  console.log('  --search         Search text in patterns/ADRs');
  console.log('  --export, -e     Export results to JSON file');
  console.log('');
  console.log('Examples:');
  console.log('  npm run query-knowledge -- patterns --agent developer --type solution');
  console.log('  npm run query-knowledge -- adrs --status accepted');
  console.log('  npm run query-knowledge -- reviews --work-item STORY-ABC123');
  console.log('  npm run query-knowledge -- patterns --search "error handling" --export');
}

function parseArgs(args: string[]): QueryOptions {
  const result: QueryOptions = {};
  
  // First arg is the command
  if (args.length > 0 && !args[0].startsWith('--')) {
    result.command = args[0];
    args = args.slice(1);
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '--type':
      case '-t':
        if (nextArg) {
          result.type = nextArg;
          i++;
        }
        break;
      case '--agent':
      case '-a':
        if (nextArg) {
          result.agent = nextArg;
          i++;
        }
        break;
      case '--status':
      case '-s':
        if (nextArg) {
          result.status = nextArg;
          i++;
        }
        break;
      case '--work-item':
      case '-w':
        if (nextArg) {
          result.workItem = nextArg;
          i++;
        }
        break;
      case '--min-score':
        if (nextArg) {
          result.minScore = parseFloat(nextArg);
          i++;
        }
        break;
      case '--limit':
      case '-l':
        if (nextArg) {
          result.limit = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--search':
        if (nextArg) {
          result.search = nextArg;
          i++;
        }
        break;
      case '--export':
      case '-e':
        result.export = true;
        break;
    }
  }
  
  return result;
}

function displayPattern(pattern: Pattern, index: number) {
  console.log(`\n${index + 1}. Pattern ${pattern.id}`);
  console.log('─'.repeat(60));
  console.log(`   Type: ${pattern.pattern_type} | Agent: ${pattern.agent_role}`);
  console.log(`   Effectiveness: ${(pattern.effectiveness_score * 100).toFixed(1)}% | Used: ${pattern.usage_count} times`);
  console.log(`   Context: ${pattern.context}`);
  console.log(`   Solution: ${pattern.solution}`);
  
  if (pattern.metadata) {
    const metadata = JSON.parse(pattern.metadata);
    if (metadata.tags) {
      console.log(`   Tags: ${metadata.tags.join(', ')}`);
    }
  }
  
  if (pattern.work_item_ids) {
    console.log(`   Related work items: ${pattern.work_item_ids}`);
  }
  
  console.log(`   Created: ${new Date(pattern.created_at).toLocaleString()}`);
}

function displayADR(adr: ADR, index: number) {
  console.log(`\n${index + 1}. ADR ${adr.id}: ${adr.title}`);
  console.log('─'.repeat(60));
  console.log(`   Status: ${adr.status} | Created by: ${adr.created_by}`);
  console.log(`   Context: ${adr.context}`);
  console.log(`   Decision: ${adr.decision}`);
  
  if (adr.consequences) {
    console.log(`   Consequences: ${adr.consequences}`);
  }
  
  if (adr.superseded_by) {
    console.log(`   ⚠️  Superseded by: ${adr.superseded_by}`);
  }
  
  if (adr.work_item_id) {
    console.log(`   Related work item: ${adr.work_item_id}`);
  }
  
  console.log(`   Created: ${new Date(adr.created_at).toLocaleString()}`);
}

function displayReview(review: Review, index: number) {
  console.log(`\n${index + 1}. Review ${review.id}`);
  console.log('─'.repeat(60));
  console.log(`   Type: ${review.review_type} | Reviewer: ${review.reviewer_role}`);
  console.log(`   Status: ${review.status}`);
  
  if (review.quality_score !== null) {
    console.log(`   Quality Score: ${(review.quality_score * 100).toFixed(1)}%`);
  }
  
  console.log(`   Feedback: ${review.feedback}`);
  
  if (review.suggestions) {
    console.log(`   Suggestions: ${review.suggestions}`);
  }
  
  console.log(`   Created: ${new Date(review.created_at).toLocaleString()}`);
}

function displayMessage(message: AgentCommunication, index: number) {
  console.log(`\n${index + 1}. Message ${message.id}`);
  console.log('─'.repeat(60));
  console.log(`   From: ${message.from_agent} → To: ${message.to_agent}`);
  console.log(`   Type: ${message.message_type} | Priority: ${message.priority}`);
  console.log(`   Status: ${message.status}`);
  console.log(`   Subject: ${message.subject}`);
  console.log(`   Content: ${message.content}`);
  
  if (message.work_item_id) {
    console.log(`   Related work item: ${message.work_item_id}`);
  }
  
  console.log(`   Created: ${new Date(message.created_at).toLocaleString()}`);
  
  if (message.delivered_at) {
    console.log(`   Delivered: ${new Date(message.delivered_at).toLocaleString()}`);
  }
}

function searchPatterns(patterns: Pattern[], searchText: string): Pattern[] {
  const searchLower = searchText.toLowerCase();
  return patterns.filter(pattern => 
    pattern.context.toLowerCase().includes(searchLower) ||
    pattern.solution.toLowerCase().includes(searchLower) ||
    (pattern.metadata && JSON.stringify(pattern.metadata).toLowerCase().includes(searchLower))
  );
}

function searchADRs(adrs: ADR[], searchText: string): ADR[] {
  const searchLower = searchText.toLowerCase();
  return adrs.filter(adr =>
    adr.title.toLowerCase().includes(searchLower) ||
    adr.context.toLowerCase().includes(searchLower) ||
    adr.decision.toLowerCase().includes(searchLower) ||
    (adr.consequences && adr.consequences.toLowerCase().includes(searchLower))
  );
}

async function queryPatterns(options: QueryOptions) {
  const filter: any = {};
  
  if (options.agent) {
    filter.agent_role = options.agent as AgentRole;
  }
  
  if (options.type) {
    filter.pattern_type = options.type as PatternType;
  }
  
  if (options.minScore !== undefined) {
    filter.min_effectiveness_score = options.minScore;
  }
  
  if (options.limit) {
    filter.max_results = options.limit;
  }
  
  let patterns = getPatternsByFilter(filter);
  
  // Apply text search if provided
  if (options.search) {
    patterns = searchPatterns(patterns, options.search);
  }
  
  if (patterns.length === 0) {
    console.log('No patterns found matching your criteria.');
    return;
  }
  
  console.log(`\n📚 Found ${patterns.length} pattern(s)`);
  console.log('='.repeat(80));
  
  patterns.forEach((pattern, index) => displayPattern(pattern, index));
  
  if (options.export) {
    const filename = `patterns-export-${Date.now()}.json`;
    const fs = await import('fs');
    fs.writeFileSync(filename, JSON.stringify(patterns, null, 2));
    console.log(`\n✅ Exported to ${filename}`);
  }
}

async function queryADRs(options: QueryOptions) {
  let adrs: ADR[] = [];
  
  if (options.workItem) {
    adrs = getADRsByWorkItem(options.workItem);
  } else if (options.status) {
    adrs = getADRsByStatus(options.status as ADRStatus);
  } else {
    // Get all ADRs by querying each status
    const statuses: ADRStatus[] = ['proposed', 'accepted', 'deprecated', 'superseded'];
    adrs = statuses.flatMap(status => getADRsByStatus(status));
  }
  
  // Apply text search if provided
  if (options.search) {
    adrs = searchADRs(adrs, options.search);
  }
  
  if (adrs.length === 0) {
    console.log('No ADRs found matching your criteria.');
    return;
  }
  
  console.log(`\n📋 Found ${adrs.length} ADR(s)`);
  console.log('='.repeat(80));
  
  adrs.forEach((adr, index) => displayADR(adr, index));
  
  if (options.export) {
    const filename = `adrs-export-${Date.now()}.json`;
    const fs = await import('fs');
    fs.writeFileSync(filename, JSON.stringify(adrs, null, 2));
    console.log(`\n✅ Exported to ${filename}`);
  }
}

async function queryReviews(options: QueryOptions) {
  if (!options.workItem) {
    console.error('❌ Error: --work-item is required for querying reviews');
    process.exit(1);
  }
  
  const reviews = getReviewsByWorkItem(options.workItem);
  
  if (reviews.length === 0) {
    console.log(`No reviews found for work item ${options.workItem}.`);
    return;
  }
  
  console.log(`\n✅ Found ${reviews.length} review(s) for work item ${options.workItem}`);
  console.log('='.repeat(80));
  
  reviews.forEach((review, index) => displayReview(review, index));
  
  if (options.export) {
    const filename = `reviews-export-${Date.now()}.json`;
    const fs = await import('fs');
    fs.writeFileSync(filename, JSON.stringify(reviews, null, 2));
    console.log(`\n✅ Exported to ${filename}`);
  }
}

async function queryMessages(options: QueryOptions) {
  if (!options.agent) {
    console.error('❌ Error: --agent is required for querying messages');
    process.exit(1);
  }
  
  const messages = getMessagesForAgent(options.agent);
  
  if (messages.length === 0) {
    console.log(`No messages found for agent ${options.agent}.`);
    return;
  }
  
  console.log(`\n📬 Found ${messages.length} message(s) for agent ${options.agent}`);
  console.log('='.repeat(80));
  
  messages.forEach((message, index) => displayMessage(message, index));
  
  if (options.export) {
    const filename = `messages-export-${Date.now()}.json`;
    const fs = await import('fs');
    fs.writeFileSync(filename, JSON.stringify(messages, null, 2));
    console.log(`\n✅ Exported to ${filename}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  const options = parseArgs(args);
  
  if (!options.command) {
    console.error('❌ Error: Command is required');
    printUsage();
    process.exit(1);
  }
  
  try {
    // Initialize database
    initializeDatabase();
    
    switch (options.command) {
      case 'patterns':
        await queryPatterns(options);
        break;
      case 'adrs':
        await queryADRs(options);
        break;
      case 'reviews':
        await queryReviews(options);
        break;
      case 'messages':
        await queryMessages(options);
        break;
      default:
        console.error(`❌ Error: Unknown command "${options.command}"`);
        printUsage();
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Failed to query knowledge base:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();