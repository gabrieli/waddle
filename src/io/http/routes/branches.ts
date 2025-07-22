/**
 * Branches API Routes
 */
import { Router } from 'express';
import { getLocalBranches } from '../../../lib/git-utils.ts';
import { generateBranchName } from '../../../core/domain/work-item.ts';

export function createBranchesRouter(): Router {
  const router = Router();

  // Get all local branches
  router.get('/local', async (req, res) => {
    try {
      const branches = getLocalBranches();
      
      res.json({
        success: true,
        branches
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Generate suggested branch name for a work item
  router.post('/suggest', async (req, res) => {
    try {
      const { workItemId, name } = req.body;

      if (!workItemId || !name) {
        return res.status(400).json({
          success: false,
          error: 'workItemId and name are required'
        });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const branchName = generateBranchName(workItemId, slug);
      
      res.json({
        success: true,
        suggestedBranchName: branchName
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}