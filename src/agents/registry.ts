import { DatabaseConnection } from '../database/connection';
import { DeveloperAgent } from './developer';
import { WaddleConfig } from '../config';

export class AgentRegistry {
  private agents: Map<string, any> = new Map();
  
  constructor(private db: DatabaseConnection, private config: WaddleConfig) {}
  
  createDeveloperAgent(): DeveloperAgent {
    const agent = new DeveloperAgent(this.db, this.config);
    this.agents.set(agent['id'], agent);
    return agent;
  }
  
  getAgent(id: string): any {
    return this.agents.get(id);
  }
  
  removeAgent(id: string): void {
    this.agents.delete(id);
  }
  
  getActiveAgents(): any[] {
    return Array.from(this.agents.values());
  }
}