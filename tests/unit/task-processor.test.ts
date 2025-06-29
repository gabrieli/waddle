import { processTask } from '../../src/task-processor';

describe('Task Processor', () => {
  describe('processTask', () => {
    test('should process a simple task and return success result', () => {
      const task = {
        id: 'test-1',
        title: 'Test Task',
        description: 'Test description',
        type: 'task'
      };

      const result = processTask(task);

      expect(result).toEqual({
        success: true,
        taskId: 'test-1',
        message: 'Task "Test Task" processed successfully',
        processedAt: expect.any(Date)
      });
    });

    test('should handle tasks with empty descriptions', () => {
      const task = {
        id: 'test-2',
        title: 'Empty Description Task',
        description: '',
        type: 'task'
      };

      const result = processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('test-2');
      expect(result.message).toBe('Task "Empty Description Task" processed successfully');
    });

    test('should handle tasks with special characters in title', () => {
      const task = {
        id: 'test-3',
        title: 'Task with "quotes" & special chars!',
        description: 'Testing special characters',
        type: 'bug'
      };

      const result = processTask(task);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Task "Task with "quotes" & special chars!" processed successfully');
    });

    test('should handle tasks with very long titles', () => {
      const longTitle = 'A'.repeat(200);
      const task = {
        id: 'test-4',
        title: longTitle,
        description: 'Long title test',
        type: 'feature'
      };

      const result = processTask(task);

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Task "${longTitle}" processed successfully`);
    });

    test('should process tasks with different types', () => {
      const taskTypes = ['task', 'bug', 'feature', 'improvement', 'chore'];
      
      taskTypes.forEach((type, index) => {
        const task = {
          id: `test-type-${index}`,
          title: `${type} Task`,
          description: `Testing ${type} type`,
          type
        };

        const result = processTask(task);
        
        expect(result.success).toBe(true);
        expect(result.taskId).toBe(`test-type-${index}`);
      });
    });
  });
});