/**
 * Scheduler Control API Routes
 */

export interface SchedulerStatus {
  isRunning: boolean;
  intervalSeconds: number;
  lastRunAt: Date | null;
}

export interface SchedulerControlService {
  getStatus(): Promise<SchedulerStatus>;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
}

/**
 * Factory function to create scheduler control router
 */
export function createSchedulerRouter(service: SchedulerControlService) {
  return {
    service,
    routes: {
      'GET /status': service.getStatus,
      'POST /start': service.start,
      'POST /stop': service.stop
    }
  };
}