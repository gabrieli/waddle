export interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
}

export interface TaskResult {
  success: boolean;
  taskId: string;
  message: string;
  processedAt: Date;
}

export function processTask(task: Task): TaskResult {
  return {
    success: true,
    taskId: task.id,
    message: `Task "${task.title}" processed successfully`,
    processedAt: new Date()
  };
}