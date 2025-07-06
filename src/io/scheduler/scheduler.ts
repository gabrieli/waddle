/**
 * Scheduler Orchestration (IO Layer)
 * Integrates core assignment logic with external services
 */
import { matchAgentsToWork, type Agent, type AssignableWork, type AssignmentRule } from '../../core/workflows/work-assignment.ts';

export interface AgentService {
  getAvailable(): Promise<Agent[]>;
}

export interface WorkItemService {
  getAssignable(): Promise<AssignableWork[]>;
  assign(workItemId: number, agentId: number): Promise<boolean>;
}

export interface SchedulerConfigRepository {
  get(): { isRunning: boolean; intervalSeconds: number };
  setRunning(isRunning: boolean): void;
  updateLastRun(): void;
}

export interface SchedulerDependencies {
  agentService: AgentService;
  workItemService: WorkItemService;
  assignmentRules: AssignmentRule[];
  configRepository: SchedulerConfigRepository;
}

export interface Scheduler {
  runAssignmentCycle(): Promise<void>;
  start(): void;
  stop(): void;
}

/**
 * Factory function to create scheduler with dependency injection
 */
export function createScheduler(deps: SchedulerDependencies): Scheduler {
  let intervalId: NodeJS.Timeout | null = null;

  const runAssignmentCycle = async (): Promise<void> => {
    try {
      // Update last run time
      deps.configRepository.updateLastRun();
      
      // Phase 1: Query available resources
      const [agents, work] = await Promise.all([
        deps.agentService.getAvailable(),
        deps.workItemService.getAssignable()
      ]);

      // Phase 2: Apply core matching logic (pure function)
      const assignments = matchAgentsToWork(agents, work, deps.assignmentRules);

      // Phase 3: Execute assignments (side effects)
      for (const assignment of assignments) {
        await deps.workItemService.assign(assignment.workItemId, assignment.agentId);
      }
      
      if (assignments.length > 0) {
        console.log(`[${new Date().toISOString()}] Scheduler: Made ${assignments.length} assignments`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Scheduler error:`, error);
    }
  };

  const start = (): void => {
    if (intervalId) return;
    
    // Get configuration from database
    const config = deps.configRepository.get();
    const intervalMs = config.intervalSeconds * 1000;
    
    // Update database to reflect running state
    deps.configRepository.setRunning(true);
    
    console.log(`[${new Date().toISOString()}] Scheduler: Starting (${config.intervalSeconds} second intervals)`);
    intervalId = setInterval(runAssignmentCycle, intervalMs);
    
    // Run immediately on start
    runAssignmentCycle();
  };

  const stop = (): void => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      
      // Update database to reflect stopped state
      deps.configRepository.setRunning(false);
      
      console.log(`[${new Date().toISOString()}] Scheduler: Stopped`);
    }
  };

  // Initialize but don't auto-start (as per requirement)
  // Scheduler starts OFF by default per user requirement

  return {
    runAssignmentCycle,
    start,
    stop
  };
}