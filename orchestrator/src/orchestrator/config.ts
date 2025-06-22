import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface OrchestratorConfig {
  pollingInterval: number;
  claudeExecutable: string;
  workingDirectory: string;
  database: string;
  parallelMode?: boolean;
  maxConcurrentManagers?: number;
  agents: {
    manager: { model: string };
    architect: { model: string };
    developer: { model: string };
    code_quality_reviewer?: { model: string };
    reviewer?: { model: string }; // For backwards compatibility
  };
}

export function loadConfig(): OrchestratorConfig {
  const configPath = path.join(__dirname, '../../orchestrator.config.json');
  
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData) as OrchestratorConfig;
    
    // Validate required fields
    if (!config.pollingInterval || config.pollingInterval < 1000) {
      throw new Error('Invalid polling interval (must be >= 1000ms)');
    }
    
    if (!config.database) {
      throw new Error('Database path is required');
    }
    
    return config;
  } catch (error) {
    console.error('Failed to load configuration:', error);
    throw error;
  }
}