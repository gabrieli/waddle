import { beforeAll, afterAll } from 'vitest';
import { closeDatabase } from './src/database/connection.js';

// Global test setup
beforeAll(() => {
  // Any global setup needed
});

afterAll(() => {
  // Ensure database is closed after all tests
  try {
    closeDatabase();
  } catch (error) {
    // Ignore errors during cleanup
  }
});