import { Router, Request, Response } from 'express';
import { Database } from '../../database/connection';
import { LearningWorker } from '../../services/learning-worker';
import { EffectivenessScoringService } from '../../services/effectiveness-scoring';
import { PatternCategorizationService } from '../../services/pattern-categorization';
import { PatternCleanupService } from '../../services/pattern-cleanup';
import { Logger } from '../../utils/logger';
import { authMiddleware } from '../middleware/auth';

export function createLearningMetricsRouter(db: Database, worker: LearningWorker): Router {
  const router = Router();
  const logger = new Logger('LearningMetricsAPI');
  const scoringService = new EffectivenessScoringService(db);
  const categorizationService = new PatternCategorizationService(db);
  const cleanupService = new PatternCleanupService(db);

  // Apply authentication to all routes
  router.use(authMiddleware);

  // Get learning system status
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const status = await worker.getStatus();
      
      // Add additional system health checks
      const systemHealth = await checkSystemHealth(db);
      
      res.json({
        ...status,
        health: systemHealth
      });
    } catch (error) {
      logger.error('Failed to get learning system status', error);
      res.status(500).json({ error: 'Failed to get system status' });
    }
  });

  // Get learning metrics
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const metrics = await worker.getMetrics(hours);
      
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get learning metrics', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  // Get pattern effectiveness trends
  router.get('/effectiveness/trends', async (req: Request, res: Response) => {
    try {
      const trends = await scoringService.analyzePatternTrends();
      
      res.json(trends);
    } catch (error) {
      logger.error('Failed to get effectiveness trends', error);
      res.status(500).json({ error: 'Failed to get trends' });
    }
  });

  // Get pattern categorization accuracy
  router.get('/categorization/accuracy', async (req: Request, res: Response) => {
    try {
      const accuracy = await categorizationService.analyzeCategorizationAccuracy();
      
      res.json(accuracy);
    } catch (error) {
      logger.error('Failed to get categorization accuracy', error);
      res.status(500).json({ error: 'Failed to get accuracy' });
    }
  });

  // Get cleanup statistics
  router.get('/cleanup/stats', async (req: Request, res: Response) => {
    try {
      const stats = await cleanupService.getCleanupStatistics();
      
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get cleanup statistics', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  // Get pattern growth over time
  router.get('/patterns/growth', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const growth = await getPatternGrowth(db, days);
      
      res.json(growth);
    } catch (error) {
      logger.error('Failed to get pattern growth', error);
      res.status(500).json({ error: 'Failed to get growth data' });
    }
  });

  // Get agent learning progress
  router.get('/agents/progress', async (req: Request, res: Response) => {
    try {
      const progress = await getAgentLearningProgress(db);
      
      res.json(progress);
    } catch (error) {
      logger.error('Failed to get agent progress', error);
      res.status(500).json({ error: 'Failed to get progress data' });
    }
  });

  // Get pattern usage heatmap
  router.get('/patterns/usage-heatmap', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const heatmap = await getPatternUsageHeatmap(db, days);
      
      res.json(heatmap);
    } catch (error) {
      logger.error('Failed to get usage heatmap', error);
      res.status(500).json({ error: 'Failed to get heatmap data' });
    }
  });

  // Get learning insights
  router.get('/insights', async (req: Request, res: Response) => {
    try {
      const insights = await generateLearningInsights(db);
      
      res.json(insights);
    } catch (error) {
      logger.error('Failed to generate insights', error);
      res.status(500).json({ error: 'Failed to generate insights' });
    }
  });

  // Trigger manual pattern extraction
  router.post('/extract', async (req: Request, res: Response) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Run extraction in background
      setImmediate(async () => {
        try {
          await worker['runExtractionCycle']();
        } catch (error) {
          logger.error('Manual extraction failed', error);
        }
      });

      res.json({ message: 'Pattern extraction started' });
    } catch (error) {
      logger.error('Failed to trigger extraction', error);
      res.status(500).json({ error: 'Failed to start extraction' });
    }
  });

  // Trigger manual effectiveness scoring
  router.post('/score', async (req: Request, res: Response) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Run scoring in background
      setImmediate(async () => {
        try {
          await worker['runScoringCycle']();
        } catch (error) {
          logger.error('Manual scoring failed', error);
        }
      });

      res.json({ message: 'Effectiveness scoring started' });
    } catch (error) {
      logger.error('Failed to trigger scoring', error);
      res.status(500).json({ error: 'Failed to start scoring' });
    }
  });

  return router;
}

async function checkSystemHealth(db: Database): Promise<any> {
  const checks = {
    database: false,
    patterns: false,
    recentActivity: false
  };

  try {
    // Check database connection
    await db.get('SELECT 1');
    checks.database = true;

    // Check pattern table
    const patternCount = await db.get('SELECT COUNT(*) as count FROM patterns');
    checks.patterns = patternCount.count > 0;

    // Check recent activity
    const recentActivity = await db.get(
      `SELECT COUNT(*) as count FROM work_items 
       WHERE completed_at > datetime('now', '-1 day')`
    );
    checks.recentActivity = recentActivity.count > 0;

    const allHealthy = Object.values(checks).every(v => v);
    
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      checks,
      error: error.message
    };
  }
}

async function getPatternGrowth(db: Database, days: number): Promise<any> {
  const query = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as patterns_created,
      SUM(CASE WHEN pattern_type = 'solution' THEN 1 ELSE 0 END) as solutions,
      SUM(CASE WHEN pattern_type = 'approach' THEN 1 ELSE 0 END) as approaches,
      SUM(CASE WHEN pattern_type = 'tool_usage' THEN 1 ELSE 0 END) as tool_usage,
      SUM(CASE WHEN pattern_type = 'error_handling' THEN 1 ELSE 0 END) as error_handling,
      SUM(CASE WHEN pattern_type = 'optimization' THEN 1 ELSE 0 END) as optimizations
    FROM patterns
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  const daily = await db.all(query);

  // Calculate cumulative growth
  let total = 0;
  const cumulative = daily.map(day => {
    total += day.patterns_created;
    return {
      ...day,
      cumulative_total: total
    };
  });

  return {
    daily,
    cumulative,
    summary: {
      total_created: total,
      avg_per_day: total / days,
      by_type: {
        solutions: daily.reduce((sum, d) => sum + d.solutions, 0),
        approaches: daily.reduce((sum, d) => sum + d.approaches, 0),
        tool_usage: daily.reduce((sum, d) => sum + d.tool_usage, 0),
        error_handling: daily.reduce((sum, d) => sum + d.error_handling, 0),
        optimizations: daily.reduce((sum, d) => sum + d.optimizations, 0)
      }
    }
  };
}

async function getAgentLearningProgress(db: Database): Promise<any> {
  const query = `
    SELECT 
      p.agent_role,
      COUNT(DISTINCT p.id) as pattern_count,
      AVG(p.effectiveness_score) as avg_effectiveness,
      SUM(p.usage_count) as total_usage,
      COUNT(DISTINCT pwi.work_item_id) as work_items_improved,
      MAX(p.created_at) as latest_pattern
    FROM patterns p
    LEFT JOIN pattern_work_items pwi ON p.id = pwi.pattern_id
    GROUP BY p.agent_role
  `;

  const progress = await db.all(query);

  // Calculate improvement rate for each agent
  const enrichedProgress = await Promise.all(
    progress.map(async (agent) => {
      const improvementRate = await calculateImprovementRate(db, agent.agent_role);
      
      return {
        ...agent,
        improvement_rate: improvementRate,
        learning_score: calculateLearningScore(agent)
      };
    })
  );

  return {
    agents: enrichedProgress,
    summary: {
      most_patterns: enrichedProgress.reduce((max, a) => 
        a.pattern_count > max.pattern_count ? a : max
      ),
      highest_effectiveness: enrichedProgress.reduce((max, a) => 
        a.avg_effectiveness > max.avg_effectiveness ? a : max
      ),
      most_improved: enrichedProgress.reduce((max, a) => 
        a.improvement_rate > max.improvement_rate ? a : max
      )
    }
  };
}

async function calculateImprovementRate(db: Database, agentRole: string): Promise<number> {
  // Compare recent performance with historical
  const query = `
    SELECT 
      AVG(CASE WHEN wi.completed_at > datetime('now', '-7 days') THEN r.quality_score END) as recent_quality,
      AVG(CASE WHEN wi.completed_at <= datetime('now', '-7 days') THEN r.quality_score END) as historical_quality
    FROM work_item_results wir
    JOIN work_items wi ON wir.work_item_id = wi.id
    LEFT JOIN reviews r ON wi.id = r.work_item_id
    WHERE wir.agent_role = ?
    AND wi.completed_at > datetime('now', '-30 days')
  `;

  const result = await db.get(query, [agentRole]);
  
  if (!result || !result.historical_quality) return 0;
  
  return ((result.recent_quality - result.historical_quality) / result.historical_quality) * 100;
}

function calculateLearningScore(agent: any): number {
  // Composite score based on multiple factors
  const factors = {
    patternCount: Math.min(agent.pattern_count / 50, 1) * 0.3,
    effectiveness: agent.avg_effectiveness * 0.4,
    usage: Math.min(agent.total_usage / 100, 1) * 0.3
  };

  return Object.values(factors).reduce((sum, f) => sum + f, 0);
}

async function getPatternUsageHeatmap(db: Database, days: number): Promise<any> {
  const query = `
    SELECT 
      DATE(wi.completed_at) as date,
      STRFTIME('%H', wi.completed_at) as hour,
      COUNT(DISTINCT pwi.pattern_id) as patterns_used,
      COUNT(DISTINCT wi.id) as work_items
    FROM pattern_work_items pwi
    JOIN work_items wi ON pwi.work_item_id = wi.id
    WHERE wi.completed_at >= datetime('now', '-${days} days')
    GROUP BY date, hour
    ORDER BY date, hour
  `;

  const heatmapData = await db.all(query);

  // Transform into heatmap format
  const heatmap: any = {};
  
  for (const data of heatmapData) {
    if (!heatmap[data.date]) {
      heatmap[data.date] = {};
    }
    heatmap[data.date][data.hour] = {
      patterns_used: data.patterns_used,
      work_items: data.work_items,
      intensity: data.patterns_used / data.work_items
    };
  }

  return {
    heatmap,
    summary: {
      peak_usage_time: findPeakUsageTime(heatmapData),
      total_pattern_applications: heatmapData.reduce((sum, d) => sum + d.patterns_used, 0),
      avg_patterns_per_hour: heatmapData.reduce((sum, d) => sum + d.patterns_used, 0) / (days * 24)
    }
  };
}

function findPeakUsageTime(data: any[]): string {
  const hourlyUsage: Record<string, number> = {};
  
  for (const entry of data) {
    hourlyUsage[entry.hour] = (hourlyUsage[entry.hour] || 0) + entry.patterns_used;
  }

  const peakHour = Object.entries(hourlyUsage)
    .reduce((max, [hour, usage]) => usage > max[1] ? [hour, usage] : max, ['00', 0]);

  return `${peakHour[0]}:00`;
}

async function generateLearningInsights(db: Database): Promise<any> {
  const insights: any[] = [];

  // Insight 1: Most effective patterns
  const effectivePatterns = await db.all(
    `SELECT pattern_type, AVG(effectiveness_score) as avg_score, COUNT(*) as count
     FROM patterns
     WHERE usage_count > 5
     GROUP BY pattern_type
     ORDER BY avg_score DESC`
  );

  if (effectivePatterns.length > 0) {
    const best = effectivePatterns[0];
    insights.push({
      type: 'success',
      title: 'Most Effective Pattern Type',
      message: `${best.pattern_type} patterns have the highest average effectiveness (${(best.avg_score * 100).toFixed(0)}%)`,
      data: best
    });
  }

  // Insight 2: Underutilized high-quality patterns
  const underutilized = await db.get(
    `SELECT COUNT(*) as count
     FROM patterns
     WHERE effectiveness_score > 0.8
     AND usage_count < 3`
  );

  if (underutilized.count > 0) {
    insights.push({
      type: 'opportunity',
      title: 'Underutilized High-Quality Patterns',
      message: `${underutilized.count} highly effective patterns are rarely used`,
      action: 'Consider promoting these patterns to relevant agents'
    });
  }

  // Insight 3: Agent improvement trends
  const improvingAgents = await db.all(
    `SELECT 
       wir.agent_role,
       COUNT(CASE WHEN r.quality_score > 0.7 THEN 1 END) * 100.0 / COUNT(*) as success_rate
     FROM work_item_results wir
     JOIN work_items wi ON wir.work_item_id = wi.id
     LEFT JOIN reviews r ON wi.id = r.work_item_id
     WHERE wi.completed_at > datetime('now', '-30 days')
     GROUP BY wir.agent_role
     HAVING COUNT(*) > 10
     ORDER BY success_rate DESC`
  );

  if (improvingAgents.length > 0) {
    const bestAgent = improvingAgents[0];
    insights.push({
      type: 'achievement',
      title: 'Top Performing Agent',
      message: `${bestAgent.agent_role} has ${bestAgent.success_rate.toFixed(0)}% success rate in recent work`,
      data: improvingAgents
    });
  }

  // Insight 4: Pattern diversity
  const diversity = await db.get(
    `SELECT 
       COUNT(DISTINCT pattern_type) as types,
       COUNT(DISTINCT agent_role) as roles,
       COUNT(*) as total
     FROM patterns`
  );

  insights.push({
    type: 'info',
    title: 'Knowledge Base Diversity',
    message: `${diversity.total} patterns across ${diversity.types} types and ${diversity.roles} agent roles`,
    data: diversity
  });

  return {
    insights,
    generated_at: new Date().toISOString()
  };
}