import { LLMService } from '../services/llm-service';
import { Logger } from '../logger';

export interface Task {
  issue: any;
  state: any;
  priority: number;
}

export interface Deadlock {
  type: 'circular' | 'resource' | 'dependency';
  tasks: Task[];
  description: string;
}

export interface DeadlockResolution {
  action: 'prioritize' | 'unblock' | 'wait';
  tasks?: any[];
  task?: any;
  reason: string;
}

export class AIReasoner {
  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {}

  async selectNextTask(pendingWork: Task[], activeTasks: Map<string, any>): Promise<Task | null> {
    if (pendingWork.length === 0) {
      return null;
    }

    const context = this.buildTaskSelectionContext(pendingWork, activeTasks);
    
    const prompt = `You are an intelligent task scheduler for a development workflow system.

Current Context:
${JSON.stringify(context, null, 2)}

Select the next task to execute based on:
1. Priority (high > medium > low)
2. Dependencies (tasks that unblock others should run first)
3. Age (older tasks should generally run sooner)
4. Current phase (avoid context switching between different types of work)
5. Resource availability

Return ONLY a JSON object with:
{
  "selectedTaskId": <issue_number>,
  "reason": "<brief explanation>"
}`;

    try {
      const response = await this.llmService.complete(prompt);
      const result = JSON.parse(response);
      
      const selectedTask = pendingWork.find(t => t.issue.number === result.selectedTaskId);
      
      if (selectedTask) {
        this.logger.info(`AI selected task ${result.selectedTaskId}: ${result.reason}`);
        return selectedTask;
      }
      
      this.logger.warn('AI selected invalid task, falling back to priority order');
      return pendingWork[0];
    } catch (error) {
      this.logger.error('Error in AI task selection', error);
      return pendingWork[0];
    }
  }

  async determineNextPhase(task: Task): Promise<string> {
    const phaseTransitions: Record<string, string[]> = {
      'requirements': ['technical-design'],
      'technical-design': ['development'],
      'development': ['code-review'],
      'code-review': ['testing', 'development'],
      'testing': ['done', 'development'],
      'blocked': ['development', 'technical-design', 'requirements']
    };

    const currentPhase = task.state.phase;
    const possiblePhases = phaseTransitions[currentPhase] || [];

    if (possiblePhases.length === 0) {
      throw new Error(`No valid transitions from phase: ${currentPhase}`);
    }

    if (possiblePhases.length === 1) {
      return possiblePhases[0];
    }

    const prompt = `You are analyzing a development task to determine its next phase.

Task Information:
- Issue: ${task.issue.title}
- Current Phase: ${currentPhase}
- Description: ${task.issue.body}
- Recent History: ${JSON.stringify(task.state.history?.slice(-3) || [])}

Possible Next Phases: ${possiblePhases.join(', ')}

Determine the most appropriate next phase based on:
1. If code review found issues → back to development
2. If tests are failing → back to development
3. If all tests pass → proceed to done
4. If blocked, analyze the best phase to unblock

Return ONLY a JSON object with:
{
  "nextPhase": "<selected_phase>",
  "reason": "<brief explanation>"
}`;

    try {
      const response = await this.llmService.complete(prompt);
      const result = JSON.parse(response);
      
      if (possiblePhases.includes(result.nextPhase)) {
        this.logger.info(`AI determined next phase: ${result.nextPhase} - ${result.reason}`);
        return result.nextPhase;
      }
      
      this.logger.warn('AI selected invalid phase, using default');
      return possiblePhases[0];
    } catch (error) {
      this.logger.error('Error determining next phase', error);
      return possiblePhases[0];
    }
  }

  async detectDeadlocks(tasks: Task[]): Promise<Deadlock[]> {
    const deadlocks: Deadlock[] = [];

    const circularDependencies = this.findCircularDependencies(tasks);
    deadlocks.push(...circularDependencies);

    const resourceConflicts = await this.findResourceConflicts(tasks);
    deadlocks.push(...resourceConflicts);

    const dependencyBlocks = this.findDependencyBlocks(tasks);
    deadlocks.push(...dependencyBlocks);

    return deadlocks;
  }

  async suggestDeadlockResolution(deadlock: Deadlock): Promise<DeadlockResolution> {
    const prompt = `You are resolving a deadlock in a development workflow system.

Deadlock Information:
Type: ${deadlock.type}
Description: ${deadlock.description}
Affected Tasks: ${JSON.stringify(deadlock.tasks.map(t => ({
  id: t.issue.number,
  title: t.issue.title,
  phase: t.state.phase,
  priority: t.priority
})), null, 2)}

Resolution strategies:
1. "prioritize" - Reorder tasks to break the deadlock
2. "unblock" - Force a task to proceed to break the cycle
3. "wait" - Wait for external resolution

Analyze the deadlock and suggest the best resolution.

Return ONLY a JSON object with:
{
  "action": "<prioritize|unblock|wait>",
  "targetTaskId": <task_id_to_act_on>,
  "reason": "<explanation>",
  "details": <action_specific_details>
}`;

    try {
      const response = await this.llmService.complete(prompt);
      const result = JSON.parse(response);
      
      if (result.action === 'prioritize') {
        return {
          action: 'prioritize',
          tasks: this.reorderTasksForResolution(deadlock.tasks, result.targetTaskId),
          reason: result.reason
        };
      } else if (result.action === 'unblock') {
        const task = deadlock.tasks.find(t => t.issue.number === result.targetTaskId);
        return {
          action: 'unblock',
          task,
          reason: result.reason
        };
      }
      
      return {
        action: 'wait',
        reason: result.reason
      };
    } catch (error) {
      this.logger.error('Error suggesting deadlock resolution', error);
      return {
        action: 'wait',
        reason: 'Unable to determine resolution strategy'
      };
    }
  }

  private buildTaskSelectionContext(pendingWork: Task[], activeTasks: Map<string, any>): any {
    return {
      pendingTasks: pendingWork.map(t => ({
        id: t.issue.number,
        title: t.issue.title,
        phase: t.state.phase,
        priority: t.priority,
        age: this.getTaskAge(t.issue),
        labels: t.issue.labels
      })),
      activeTasks: Array.from(activeTasks.values()).map(t => ({
        taskId: t.taskId,
        status: t.status,
        duration: Date.now() - t.startTime.getTime()
      })),
      timestamp: new Date().toISOString()
    };
  }

  private getTaskAge(issue: any): number {
    return Math.floor((Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60));
  }

  private findCircularDependencies(tasks: Task[]): Deadlock[] {
    const deadlocks: Deadlock[] = [];
    const visited = new Set<number>();
    const recursionStack = new Set<number>();

    const hasCycle = (taskId: number, dependencies: Map<number, number[]>): Task[] | null => {
      visited.add(taskId);
      recursionStack.add(taskId);

      const deps = dependencies.get(taskId) || [];
      for (const depId of deps) {
        if (!visited.has(depId)) {
          const cycle = hasCycle(depId, dependencies);
          if (cycle) return cycle;
        } else if (recursionStack.has(depId)) {
          const cycleStart = Array.from(recursionStack).indexOf(depId);
          const cycleTasks = Array.from(recursionStack).slice(cycleStart)
            .map(id => tasks.find(t => t.issue.number === id))
            .filter(Boolean) as Task[];
          return cycleTasks;
        }
      }

      recursionStack.delete(taskId);
      return null;
    };

    const dependencies = this.buildDependencyMap(tasks);
    
    for (const task of tasks) {
      if (!visited.has(task.issue.number)) {
        const cycle = hasCycle(task.issue.number, dependencies);
        if (cycle) {
          deadlocks.push({
            type: 'circular',
            tasks: cycle,
            description: `Circular dependency detected: ${cycle.map(t => `#${t.issue.number}`).join(' → ')}`
          });
        }
      }
    }

    return deadlocks;
  }

  private buildDependencyMap(tasks: Task[]): Map<number, number[]> {
    const dependencies = new Map<number, number[]>();

    for (const task of tasks) {
      const deps: number[] = [];
      
      const bodyMatch = task.issue.body?.match(/depends on #(\d+)/gi) || [];
      for (const match of bodyMatch) {
        const depId = parseInt(match.match(/#(\d+)/)![1]);
        deps.push(depId);
      }

      if (deps.length > 0) {
        dependencies.set(task.issue.number, deps);
      }
    }

    return dependencies;
  }

  private async findResourceConflicts(tasks: Task[]): Promise<Deadlock[]> {
    const deadlocks: Deadlock[] = [];
    const resourceMap = new Map<string, Task[]>();

    for (const task of tasks) {
      const resources = this.extractResourcesFromTask(task);
      
      for (const resource of resources) {
        if (!resourceMap.has(resource)) {
          resourceMap.set(resource, []);
        }
        resourceMap.get(resource)!.push(task);
      }
    }

    for (const [resource, conflictingTasks] of resourceMap) {
      if (conflictingTasks.length > 1) {
        deadlocks.push({
          type: 'resource',
          tasks: conflictingTasks,
          description: `Resource conflict on "${resource}" between tasks: ${conflictingTasks.map(t => `#${t.issue.number}`).join(', ')}`
        });
      }
    }

    return deadlocks;
  }

  private extractResourcesFromTask(task: Task): string[] {
    const resources: string[] = [];

    if (task.issue.assignee) {
      resources.push(`developer:${task.issue.assignee}`);
    }

    const fileMatches = task.issue.body?.match(/\b(\w+\.\w+)\b/g) || [];
    for (const file of fileMatches) {
      if (file.includes('.')) {
        resources.push(`file:${file}`);
      }
    }

    return resources;
  }

  private findDependencyBlocks(tasks: Task[]): Deadlock[] {
    const deadlocks: Deadlock[] = [];
    const blockedTasks = tasks.filter(t => t.state.phase === 'blocked');

    for (const blocked of blockedTasks) {
      const blockingTasks = tasks.filter(t => 
        t.issue.number !== blocked.issue.number &&
        this.isBlocking(t, blocked)
      );

      if (blockingTasks.length > 0) {
        deadlocks.push({
          type: 'dependency',
          tasks: [blocked, ...blockingTasks],
          description: `Task #${blocked.issue.number} is blocked by: ${blockingTasks.map(t => `#${t.issue.number}`).join(', ')}`
        });
      }
    }

    return deadlocks;
  }

  private isBlocking(potentialBlocker: Task, blocked: Task): boolean {
    const blockedDeps = this.extractDependencies(blocked.issue.body || '');
    return blockedDeps.includes(potentialBlocker.issue.number);
  }

  private extractDependencies(body: string): number[] {
    const deps: number[] = [];
    const matches = body.match(/depends on #(\d+)/gi) || [];
    
    for (const match of matches) {
      const issueNumber = parseInt(match.match(/#(\d+)/)![1]);
      deps.push(issueNumber);
    }
    
    return deps;
  }

  private reorderTasksForResolution(tasks: Task[], priorityTaskId: number): any[] {
    return tasks.map(task => ({
      issue: task.issue,
      newLabels: task.issue.number === priorityTaskId 
        ? [...task.issue.labels.filter((l: string) => !l.startsWith('priority:')), 'priority:critical']
        : task.issue.labels
    }));
  }
}