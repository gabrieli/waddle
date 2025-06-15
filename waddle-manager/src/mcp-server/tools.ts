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
} from './types';
import { z } from 'zod';

// Validation schemas
const CreateFeatureSchema = z.object({
  description: z.string().min(1).max(1000),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  metadata: z.record(z.unknown()).optional(),
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

export function createTools(db: Database, manager: WaddleManager): Record<string, MCPTool> {
  return {
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
      },
      handler: async (params: unknown): Promise<FeatureCreatedResponse> => {
        const validated = CreateFeatureSchema.parse(params);
        
        const feature = db.features.create({
          description: validated.description,
          priority: validated.priority as Priority,
          metadata: validated.metadata,
        });

        // Create initial architect task
        db.tasks.create({
          featureId: feature.id,
          role: 'architect',
          description: `Design architecture for: ${feature.description}`,
        });

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
  };
}