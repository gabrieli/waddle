/**
 * MCP tool implementations for Waddle
 */

import type { Database } from '../database';
import type { WaddleManager } from '../orchestrator';
import type { Priority, FeatureStatus } from '../types';
import {
  type MCPTool,
  type FeatureCreatedResponse,
  type ProgressResponse,
  type TaskCompletionResponse,
  type TaskProgressResponse,
  ErrorCodes,
} from './types';
import { z } from 'zod';

// Validation schemas
const CreateFeatureSchema = z.object({
  description: z.string().min(1).max(1000),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  metadata: z.record(z.unknown()).optional(),
  status: z.enum(['pending', 'in_progress', 'complete', 'failed']).optional(),
  id: z.string().optional(),
  skipInitialTask: z.boolean().optional(),
});

const GetProgressSchema = z.object({
  featureId: z.string().uuid().optional(),
});

const QueryFeaturesSchema = z.object({
  status: z.union([
    z.enum(['pending', 'in_progress', 'complete', 'failed']),
    z.array(z.enum(['pending', 'in_progress', 'complete', 'failed'])),
  ]).optional(),
  priority: z.union([
    z.enum(['low', 'normal', 'high', 'critical']),
    z.array(z.enum(['low', 'normal', 'high', 'critical'])),
  ]).optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});

const PauseWorkSchema = z.object({
  featureId: z.string().uuid().optional(),
});

const ResumeWorkSchema = z.object({
  featureId: z.string().uuid().optional(),
});

const SetFeaturePrioritySchema = z.object({
  featureId: z.string().uuid(),
  priority: z.enum(['low', 'normal', 'high', 'critical']),
});

const ReportTaskCompletionSchema = z.object({
  taskId: z.number().int().positive(),
  status: z.enum(['complete', 'failed']),
  output: z.object({
    filesCreated: z.array(z.string()).optional(),
    filesModified: z.array(z.string()).optional(),
    testsAdded: z.array(z.string()).optional(),
    summary: z.string().min(1),
    details: z.string().optional(),
    errors: z.array(z.string()).optional(),
    nextSteps: z.array(z.string()).optional(),
    blockReason: z.string().optional(), // If task is blocked, explain why
  }),
});

const ReportTaskProgressSchema = z.object({
  taskId: z.number().int().positive(),
  progress: z.string().min(1),
  currentStep: z.string().optional(),
  percentComplete: z.number().min(0).max(100).optional(),
});

export function createTools(db: Database, manager: WaddleManager): Record<string, MCPTool> {
  return {
    startDevelopment: {
      name: 'startDevelopment',
      description: 'Start development mode to begin processing tasks',
      parameters: {},
      handler: async (): Promise<{ success: boolean; message: string }> => {
        if (!manager) {
          throw {
            code: ErrorCodes.INVALID_REQUEST,
            message: 'Manager not available',
          };
        }
        
        try {
          manager.startDevelopment();
          return {
            success: true,
            message: 'Development mode started',
          };
        } catch (error: any) {
          throw {
            code: ErrorCodes.INTERNAL_ERROR,
            message: error.message,
          };
        }
      },
    },
    
    stopDevelopment: {
      name: 'stopDevelopment',
      description: 'Stop development mode to pause task processing',
      parameters: {},
      handler: async (): Promise<{ success: boolean; message: string }> => {
        if (!manager) {
          throw {
            code: ErrorCodes.INVALID_REQUEST,
            message: 'Manager not available',
          };
        }
        
        try {
          manager.stopDevelopment();
          return {
            success: true,
            message: 'Development mode stopped',
          };
        } catch (error: any) {
          throw {
            code: ErrorCodes.INTERNAL_ERROR,
            message: error.message,
          };
        }
      },
    },
    
    getDevelopmentStatus: {
      name: 'getDevelopmentStatus',
      description: 'Get current development mode status',
      parameters: {},
      handler: async (): Promise<{ active: boolean; runningTasks: number; metrics: any }> => {
        if (!manager) {
          throw {
            code: ErrorCodes.INVALID_REQUEST,
            message: 'Manager not available',
          };
        }
        
        const active = manager.isDevelopmentMode();
        const runningTasks = manager.getRunningTasks().length;
        const metrics = manager.getMetrics();
        
        return {
          active,
          runningTasks,
          metrics,
        };
      },
    },
    
    createFeature: {
      name: 'createFeature',
      description: 'Create a new feature for autonomous development',
      parameters: {
        description: {
          type: 'string',
          description: 'Feature description (1-1000 characters)',
          required: true,
        },
        priority: {
          type: 'string',
          description: 'Feature priority',
          enum: ['low', 'normal', 'high', 'critical'],
          default: 'normal',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the feature',
        },
        status: {
          type: 'string',
          description: 'Initial status for the feature',
          enum: ['pending', 'in_progress', 'complete', 'failed'],
          default: 'pending',
        },
        id: {
          type: 'string',
          description: 'Custom ID for the feature (optional)',
        },
        skipInitialTask: {
          type: 'boolean',
          description: 'Skip creating initial architect task',
          default: false,
        },
      },
      handler: async (params: unknown): Promise<FeatureCreatedResponse> => {
        const validated = CreateFeatureSchema.parse(params);
        
        // Need to check if we can pass custom id and status to create method
        const createDto: any = {
          description: validated.description,
          priority: validated.priority as Priority,
          metadata: validated.metadata,
        };
        
        // If custom ID provided, we need to handle it differently
        if (validated.id || validated.status !== 'pending') {
          // Direct database insert for custom features
          const id = validated.id || require('uuid').v4();
          const now = Date.now();
          
          const stmt = db.prepare(`
            INSERT INTO features (id, description, status, priority, created_at, updated_at, completed_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          stmt.run(
            id,
            validated.description,
            validated.status || 'pending',
            validated.priority || 'normal',
            now,
            now,
            validated.status === 'complete' ? now : null,
            validated.metadata ? JSON.stringify(validated.metadata) : null
          );
          
          const feature = db.features.findById(id);
          
          // Create initial architect task unless skipped or completed
          if (!validated.skipInitialTask && validated.status !== 'complete') {
            db.tasks.create({
              featureId: id,
              role: 'architect',
              description: `Design architecture for: ${validated.description}`,
            });
          }
          
          return {
            id: id,
            message: `Feature created successfully with ID: ${id}`,
          };
        }
        
        // Use standard create method for normal features
        const feature = db.features.create(createDto);

        // Create initial architect task unless skipped
        if (!validated.skipInitialTask) {
          db.tasks.create({
            featureId: feature.id,
            role: 'architect',
            description: `Design architecture for: ${feature.description}`,
          });
        }

        return {
          id: feature.id,
          message: `Feature created successfully with ID: ${feature.id}`,
        };
      },
    },

    getProgress: {
      name: 'getProgress',
      description: 'Get progress of features and tasks',
      parameters: {
        featureId: {
          type: 'string',
          description: 'Optional feature ID to get specific feature progress',
        },
      },
      handler: async (params: unknown): Promise<ProgressResponse> => {
        const validated = GetProgressSchema.parse(params);
        
        const features = validated.featureId
          ? [db.features.findById(validated.featureId)].filter(Boolean)
          : db.features.findAll({ limit: 100 });

        const featureProgress = features.map(feature => {
          const tasks = db.tasks.findByFeatureId(feature!.id);
          const completedTasks = tasks.filter(t => t.status === 'complete').length;
          const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

          return {
            id: feature!.id,
            description: feature!.description,
            status: feature!.status,
            priority: feature!.priority,
            progress: Math.round(progress),
            activeTasks: tasks.filter(t => t.status === 'in_progress').length,
            completedTasks,
            createdAt: feature!.createdAt.toISOString(),
            updatedAt: feature!.updatedAt.toISOString(),
          };
        });

        const allFeatures = db.features.findAll();
        const summary = {
          total: allFeatures.length,
          pending: allFeatures.filter(f => f.status === 'pending').length,
          inProgress: allFeatures.filter(f => f.status === 'in_progress').length,
          completed: allFeatures.filter(f => f.status === 'complete').length,
          failed: allFeatures.filter(f => f.status === 'failed').length,
        };

        return {
          features: featureProgress,
          summary,
        };
      },
    },

    queryFeatures: {
      name: 'queryFeatures',
      description: 'Query features with filters',
      parameters: {
        status: {
          type: 'string',
          description: 'Filter by status (single or array)',
          enum: ['pending', 'in_progress', 'complete', 'failed'],
        },
        priority: {
          type: 'string',
          description: 'Filter by priority (single or array)',
          enum: ['low', 'normal', 'high', 'critical'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (1-100)',
          default: 20,
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination',
          default: 0,
        },
      },
      handler: async (params: unknown) => {
        const validated = QueryFeaturesSchema.parse(params);
        
        const features = db.features.findAll({
          status: validated.status as FeatureStatus | FeatureStatus[],
          priority: validated.priority as Priority | Priority[],
          limit: validated.limit || 20,
          offset: validated.offset || 0,
        });

        return features.map(feature => ({
          id: feature.id,
          description: feature.description,
          status: feature.status,
          priority: feature.priority,
          createdAt: feature.createdAt.toISOString(),
          updatedAt: feature.updatedAt.toISOString(),
          completedAt: feature.completedAt?.toISOString(),
          metadata: feature.metadata,
        }));
      },
    },

    pauseWork: {
      name: 'pauseWork',
      description: 'Pause work on features',
      parameters: {
        featureId: {
          type: 'string',
          description: 'Optional feature ID to pause specific feature',
        },
      },
      handler: async (params: unknown) => {
        const validated = PauseWorkSchema.parse(params);
        
        if (validated.featureId) {
          // TODO: Implement feature-specific pause when orchestrator supports it
          throw new Error('Feature-specific pause not yet implemented');
        }

        await manager.pause();
        return {
          success: true,
          message: 'Work paused successfully',
        };
      },
    },

    resumeWork: {
      name: 'resumeWork',
      description: 'Resume work on features',
      parameters: {
        featureId: {
          type: 'string',
          description: 'Optional feature ID to resume specific feature',
        },
      },
      handler: async (params: unknown) => {
        const validated = ResumeWorkSchema.parse(params);
        
        if (validated.featureId) {
          // TODO: Implement feature-specific resume when orchestrator supports it
          throw new Error('Feature-specific resume not yet implemented');
        }

        await manager.resume();
        return {
          success: true,
          message: 'Work resumed successfully',
        };
      },
    },

    setFeaturePriority: {
      name: 'setFeaturePriority',
      description: 'Update the priority of a feature',
      parameters: {
        featureId: {
          type: 'string',
          description: 'Feature ID',
          required: true,
        },
        priority: {
          type: 'string',
          description: 'New priority level',
          enum: ['low', 'normal', 'high', 'critical'],
          required: true,
        },
      },
      handler: async (params: unknown) => {
        const validated = SetFeaturePrioritySchema.parse(params);
        
        const feature = db.features.findById(validated.featureId);
        if (!feature) {
          throw new Error(`Feature not found: ${validated.featureId}`);
        }

        const updated = db.features.update(validated.featureId, {
          priority: validated.priority as Priority,
        });

        return {
          id: updated.id,
          description: updated.description,
          oldPriority: feature.priority,
          newPriority: updated.priority,
          message: `Feature priority updated from ${feature.priority} to ${updated.priority}`,
        };
      },
    },

    reportTaskCompletion: {
      name: 'reportTaskCompletion',
      description: 'Report completion of an assigned task (called by Claude instances)',
      parameters: {
        taskId: {
          type: 'number',
          description: 'ID of the task being completed',
          required: true,
        },
        status: {
          type: 'string',
          description: 'Completion status',
          enum: ['complete', 'failed'],
          required: true,
        },
        output: {
          type: 'object',
          description: 'Task completion details',
          required: true,
        },
      },
      handler: async (params: unknown): Promise<TaskCompletionResponse> => {
        const validated = ReportTaskCompletionSchema.parse(params);
        
        // Find and validate task
        const task = db.tasks.findById(validated.taskId);
        if (!task) {
          throw {
            code: ErrorCodes.TASK_NOT_FOUND,
            message: `Task not found: ${validated.taskId}`,
          };
        }
        
        if (task.status !== 'in_progress') {
          throw {
            code: ErrorCodes.TASK_NOT_IN_PROGRESS,
            message: `Task ${validated.taskId} is not in progress (current status: ${task.status})`,
          };
        }
        
        // Update task with completion data
        db.tasks.update(task.id, {
          status: validated.status as any,
          completedAt: new Date(),
          output: validated.output,
        });
        
        // Store context for future tasks
        if (validated.status === 'complete' && validated.output.details) {
          // Map role to appropriate context type
          const contextTypeMap = {
            architect: 'architecture',
            developer: 'implementation',
            reviewer: 'review',
          } as const;
          
          db.context.create({
            featureId: task.featureId,
            type: contextTypeMap[task.role],
            content: JSON.stringify(validated.output),
            author: `${task.role}-claude`,
          });
        }
        
        // Update feature status if needed
        const allTasks = db.tasks.findByFeatureId(task.featureId);
        const incompleteTasks = allTasks.filter(t => t.status !== 'complete' && t.status !== 'failed');
        
        if (incompleteTasks.length === 0) {
          // All tasks done, mark feature as complete
          db.features.update(task.featureId, {
            status: 'complete',
          });
        } else if (validated.status === 'failed') {
          // Task failed, might need to update feature status
          const failedCritical = allTasks.some(t => 
            t.role === 'architect' && t.status === 'failed'
          );
          if (failedCritical) {
            db.features.update(task.featureId, {
              status: 'failed',
            });
          }
        }
        
        // Emit event for orchestrator
        manager.emit('task:completed', {
          taskId: task.id,
          featureId: task.featureId,
          status: validated.status,
          output: validated.output,
        });
        
        return {
          success: true,
          message: `Task ${task.id} marked as ${validated.status}`,
          taskId: task.id,
          featureId: task.featureId,
        };
      },
    },

    reportTaskProgress: {
      name: 'reportTaskProgress',
      description: 'Report progress on current task (called by Claude instances)',
      parameters: {
        taskId: {
          type: 'number',
          description: 'ID of the task',
          required: true,
        },
        progress: {
          type: 'string',
          description: 'Progress update message',
          required: true,
        },
        currentStep: {
          type: 'string',
          description: 'Current step being executed',
        },
        percentComplete: {
          type: 'number',
          description: 'Percentage complete (0-100)',
        },
      },
      handler: async (params: unknown): Promise<TaskProgressResponse> => {
        const validated = ReportTaskProgressSchema.parse(params);
        
        // Find and validate task
        const task = db.tasks.findById(validated.taskId);
        if (!task) {
          throw {
            code: ErrorCodes.TASK_NOT_FOUND,
            message: `Task not found: ${validated.taskId}`,
          };
        }
        
        if (task.status !== 'in_progress') {
          throw {
            code: ErrorCodes.TASK_NOT_IN_PROGRESS,
            message: `Task ${validated.taskId} is not in progress`,
          };
        }
        
        // Store progress in audit log
        db.auditLog.create({
          entityType: 'task',
          entityId: task.id.toString(),
          action: 'progress_update',
          actor: 'claude-instance',
          details: {
            progress: validated.progress,
            currentStep: validated.currentStep,
            percentComplete: validated.percentComplete,
          },
        });
        
        // Emit event for real-time updates
        manager.emit('task:progress', {
          taskId: task.id,
          featureId: task.featureId,
          progress: validated.progress,
          currentStep: validated.currentStep,
          percentComplete: validated.percentComplete,
        });
        
        return {
          success: true,
          message: 'Progress update recorded',
          taskId: task.id,
        };
      },
    },
  };
}