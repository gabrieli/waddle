import fs from 'fs';
import path from 'path';
import { Environment } from '../database/connection';

export interface WaddleConfig {
  environment: Environment;
  server: {
    port: number;
    host: string;
  };
  claude: {
    executable: string;
    workingDirectory: string;
    timeout: number;
  };
  agents: {
    developer: {
      maxConcurrent: number;
      roleInstructionsPath: string;
    };
  };
}

const defaultConfig: WaddleConfig = {
  environment: 'local',
  server: {
    port: 8765,
    host: 'localhost'
  },
  claude: {
    executable: '/Users/gabrielionescu/.claude/local/claude',
    workingDirectory: process.cwd(),
    timeout: 30000 // 30 seconds for tests
  },
  agents: {
    developer: {
      maxConcurrent: 1,
      roleInstructionsPath: path.join(process.cwd(), 'dev-roles', 'ROLE_DEVELOPER.md')
    }
  }
};

export function loadConfig(): WaddleConfig {
  const configPath = path.join(process.cwd(), 'waddle.config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...defaultConfig, ...fileConfig };
    } catch (error) {
      console.warn('Failed to load config file, using defaults:', error);
    }
  }
  
  // Override with environment variables
  const config = { ...defaultConfig };
  
  if (process.env.WADDLE_ENV === 'test') {
    config.environment = 'test';
  }
  
  if (process.env.WADDLE_PORT) {
    config.server.port = parseInt(process.env.WADDLE_PORT, 10);
  }
  
  if (process.env.CLAUDE_EXECUTABLE) {
    config.claude.executable = process.env.CLAUDE_EXECUTABLE;
  }
  
  return config;
}