import { AgentRegistry } from '../agents/registry';
import { DatabaseConnection } from '../database/connection';

export class CommandHandler {
  constructor(
    private agentRegistry: AgentRegistry,
    private db: DatabaseConnection
  ) {}
  
  async execute(command: string): Promise<any> {
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd) {
      case 'developer:assign':
        return this.assignDeveloper(args[0]);
        
      case 'developer:status':
        return this.getDeveloperStatus();
        
      case 'developer:complete':
        return this.completeDeveloperWork();
        
      case 'status':
        return this.getSystemStatus();
        
      case 'ping':
        return 'pong';
        
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }
  }
  
  private async assignDeveloper(workItemId: string): Promise<any> {
    if (!workItemId) {
      throw new Error('Work item ID is required');
    }
    
    // Check if work item exists
    const stmt = this.db.getDatabase().prepare('SELECT id, title, status FROM work_items WHERE id = ?');
    const workItem = stmt.get(workItemId);
    
    if (!workItem) {
      throw new Error(`Work item ${workItemId} not found`);
    }
    
    // Create a developer agent and execute
    const developer = this.agentRegistry.createDeveloperAgent();
    
    // Run asynchronously
    developer.execute(workItemId).catch((error) => {
      console.error(`Developer agent failed:`, error);
    });
    
    return {
      message: `Developer agent assigned to work item ${workItemId}`,
      workItem
    };
  }
  
  private getDeveloperStatus(): any {
    const stmt = this.db.getDatabase().prepare(`
      SELECT a.id, a.name, a.work_item_id, a.created_at, a.updated_at,
             w.title as work_item_title, w.status as work_item_status
      FROM agents a
      LEFT JOIN work_items w ON a.work_item_id = w.id
      WHERE a.type = 'developer'
    `);
    
    const developers = stmt.all() as any[];
    
    return {
      active_developers: developers.filter(d => d.work_item_id !== null),
      idle_developers: developers.filter(d => d.work_item_id === null)
    };
  }
  
  private completeDeveloperWork(): any {
    // This is handled automatically by the developer agent
    return {
      message: 'Developer agents complete work automatically when finished'
    };
  }
  
  private getSystemStatus(): any {
    const db = this.db.getDatabase();
    
    // Get work items summary
    const workItemsStmt = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM work_items 
      GROUP BY status
    `);
    const workItemsByStatus = workItemsStmt.all();
    
    // Get active agents
    const agentsStmt = db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM agents 
      WHERE work_item_id IS NOT NULL 
      GROUP BY type
    `);
    const activeAgentsByType = agentsStmt.all();
    
    return {
      work_items: workItemsByStatus,
      active_agents: activeAgentsByType,
      environment: this.db['environment']
    };
  }
}