export class Logger {
  constructor(private name: string) {}

  info(message: string, ...args: any[]): void {
    console.log(`[${new Date().toISOString()}] [INFO] [${this.name}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${new Date().toISOString()}] [WARN] [${this.name}] ${message}`, ...args);
  }

  error(message: string, error?: any): void {
    console.error(`[${new Date().toISOString()}] [ERROR] [${this.name}] ${message}`, error);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.DEBUG) {
      console.debug(`[${new Date().toISOString()}] [DEBUG] [${this.name}] ${message}`, ...args);
    }
  }
}