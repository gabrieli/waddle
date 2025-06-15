/**
 * Database module
 */

export class Database {
  private dbPath: string;

  constructor(dbPath = './waddle.db') {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    console.log(`💾 Database initializing at ${this.dbPath}`);
  }

  async close(): Promise<void> {
    console.log('💾 Database closed');
  }
}