import net from 'net';
import { DatabaseConnection } from '../database/connection';
import { WaddleConfig, loadConfig } from '../config';
import { AgentRegistry } from '../agents/registry';
import { CommandHandler } from './commands';

export class WaddleServer {
  private server: net.Server;
  private db: DatabaseConnection;
  private config: WaddleConfig;
  private agentRegistry: AgentRegistry;
  private commandHandler: CommandHandler;
  
  constructor() {
    this.config = loadConfig();
    this.db = new DatabaseConnection(this.config.environment);
    this.agentRegistry = new AgentRegistry(this.db, this.config);
    this.commandHandler = new CommandHandler(this.agentRegistry, this.db);
    
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });
  }
  
  start(): void {
    const { port, host } = this.config.server;
    
    this.server.listen(port, host, () => {
      console.log(`Waddle server running on ${host}:${port}`);
      console.log(`Environment: ${this.config.environment}`);
      console.log(`Database: ${this.config.environment === 'test' ? 'waddle-test.db' : 'waddle.db'}`);
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  private handleConnection(socket: net.Socket): void {
    console.log('Client connected');
    
    socket.on('data', async (data) => {
      const command = data.toString().trim();
      console.log(`Received command: ${command}`);
      
      try {
        const result = await this.commandHandler.execute(command);
        socket.write(JSON.stringify({ success: true, result }) + '\n');
      } catch (error) {
        socket.write(JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        }) + '\n');
      }
    });
    
    socket.on('error', (err) => {
      console.error('Socket error:', err);
    });
    
    socket.on('end', () => {
      console.log('Client disconnected');
    });
  }
  
  shutdown(): void {
    console.log('\nShutting down Waddle server...');
    
    this.server.close(() => {
      this.db.close();
      console.log('Server shut down gracefully');
      if (process.env.NODE_ENV !== 'test') {
        process.exit(0);
      }
    });
    
    // Force shutdown after 5 seconds
    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => {
        console.error('Forced shutdown');
        process.exit(1);
      }, 5000);
    }
  }
}

// Main entry point
if (require.main === module) {
  const server = new WaddleServer();
  server.start();
}