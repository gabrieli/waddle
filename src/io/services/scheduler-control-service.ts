/**
 * Scheduler Control Service
 * Connects the API layer to the repository and scheduler instance
 */
import type { SchedulerControlService, SchedulerStatus } from '../http/routes/scheduler.ts';
import type { SchedulerConfigRepository } from '../repositories/scheduler-config-repository.ts';
import type { Scheduler } from '../scheduler/scheduler.ts';

export interface SchedulerControlServiceDependencies {
  configRepository: SchedulerConfigRepository;
  scheduler: Scheduler;
}

/**
 * Factory function to create scheduler control service
 */
export function createSchedulerControlService(
  deps: SchedulerControlServiceDependencies
): SchedulerControlService {
  
  const getStatus = async (): Promise<SchedulerStatus> => {
    const config = deps.configRepository.get();
    return {
      isRunning: config.isRunning,
      intervalSeconds: config.intervalSeconds,
      lastRunAt: config.lastRunAt
    };
  };
  
  const start = async (): Promise<boolean> => {
    try {
      deps.scheduler.start();
      return true;
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      return false;
    }
  };
  
  const stop = async (): Promise<boolean> => {
    try {
      deps.scheduler.stop();
      return true;
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
      return false;
    }
  };
  
  return {
    getStatus,
    start,
    stop
  };
}