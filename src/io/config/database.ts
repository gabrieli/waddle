/**
 * Database configuration for different environments
 */

export interface EnvironmentConfig {
  database: {
    path: string;
    options: {
      enableWAL: boolean;
      enableForeignKeys: boolean;
      synchronousMode: 'OFF' | 'NORMAL' | 'FULL';
    };
  };
  logging: {
    enabled: boolean;
    level: 'error' | 'warn' | 'info' | 'debug';
  };
}

const localConfig: EnvironmentConfig = {
  database: {
    path: './data/waddle-local.db',
    options: {
      enableWAL: true,
      enableForeignKeys: true,
      synchronousMode: 'NORMAL'
    }
  },
  logging: {
    enabled: true,
    level: 'info'
  }
};

const testConfig: EnvironmentConfig = {
  database: {
    path: ':memory:',
    options: {
      enableWAL: false, // Not needed for in-memory databases
      enableForeignKeys: true,
      synchronousMode: 'OFF' // Faster for tests
    }
  },
  logging: {
    enabled: false,
    level: 'error'
  }
};

/**
 * Get configuration for current environment
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const environment = process.env.NODE_ENV;
  
  switch (environment) {
    case 'test':
      return testConfig;
    case 'local':
    case 'development':
    case 'production':
    default:
      return localConfig;
  }
}

/**
 * Validate environment configuration
 */
export function validateConfig(config: EnvironmentConfig): void {
  if (!config.database.path) {
    throw new Error('Database path is required');
  }
  
  if (!['OFF', 'NORMAL', 'FULL'].includes(config.database.options.synchronousMode)) {
    throw new Error('Invalid synchronous mode');
  }
  
  if (!['error', 'warn', 'info', 'debug'].includes(config.logging.level)) {
    throw new Error('Invalid logging level');
  }
}