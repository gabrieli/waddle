import { Router, Request, Response } from 'express';
import { 
  createReview,
  getReview,
  getReviewsByWorkItem,
  getReviewsByStatus
} from '../../database/knowledge.js';
import { ReviewType, ReviewStatus } from '../../types/knowledge.js';
import { AgentRole } from '../../types/index.js';

const router = Router();

// GET /api/reviews - Search reviews
router.get('/', (req: Request, res: Response) => {
  try {
    let reviews = [];
    
    if (req.query.work_item) {
      reviews = getReviewsByWorkItem(req.query.work_item as string);
    } else if (req.query.status) {
      reviews = getReviewsByStatus(req.query.status as ReviewStatus);
    } else {
      // Get all reviews by querying each status
      const statuses: ReviewStatus[] = ['pending', 'approved', 'needs_revision', 'rejected'];
      reviews = statuses.flatMap(status => getReviewsByStatus(status));
    }
    
    // Filter by review type if provided
    if (req.query.type) {
      const reviewType = req.query.type as ReviewType;
      reviews = reviews.filter(r => r.review_type === reviewType);
    }
    
    // Filter by reviewer role if provided
    if (req.query.reviewer) {
      const reviewerRole = req.query.reviewer as AgentRole;
      reviews = reviews.filter(r => r.reviewer_role === reviewerRole);
    }
    
    // Apply quality score filter if provided
    if (req.query.min_quality_score) {
      const minScore = parseFloat(req.query.min_quality_score as string);
      reviews = reviews.filter(r => r.quality_score !== null && r.quality_score >= minScore);
    }
    
    // Apply limit if provided
    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string, 10);
      reviews = reviews.slice(0, limit);
    }
    
    res.json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/reviews/:id - Get review by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const review = getReview(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }
    
    res.json({
      success: true,
      review
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/reviews - Create new review
router.post('/', (req: Request, res: Response) => {
  try {
    const { 
      work_item_id, 
      review_type, 
      reviewer_role, 
      status, 
      feedback, 
      suggestions, 
      quality_score 
    } = req.body;
    
    // Validate required fields
    if (!work_item_id || !review_type || !reviewer_role || !status || !feedback) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: work_item_id, review_type, reviewer_role, status, feedback'
      });
    }
    
    // Validate review type
    const validTypes: ReviewType[] = ['code', 'architecture', 'security', 'performance'];
    if (!validTypes.includes(review_type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid review_type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    // Validate status
    const validStatuses: ReviewStatus[] = ['pending', 'approved', 'needs_revision', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Validate quality score if provided
    if (quality_score !== undefined && (quality_score < 0 || quality_score > 1)) {
      return res.status(400).json({
        success: false,
        error: 'quality_score must be between 0 and 1'
      });
    }
    
    const review = createReview({
      work_item_id,
      review_type,
      reviewer_role: reviewer_role as AgentRole,
      status,
      feedback,
      suggestions,
      quality_score
    });
    
    res.status(201).json({
      success: true,
      review
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/reviews/work-item/:id/summary - Get review summary for a work item
router.get('/work-item/:id/summary', (req: Request, res: Response) => {
  try {
    const reviews = getReviewsByWorkItem(req.params.id);
    
    if (reviews.length === 0) {
      return res.json({
        success: true,
        summary: {
          work_item_id: req.params.id,
          total_reviews: 0,
          approved: 0,
          needs_revision: 0,
          rejected: 0,
          pending: 0,
          average_quality_score: null,
          review_types: []
        }
      });
    }
    
    // Calculate summary statistics
    const statusCounts = reviews.reduce((acc, review) => {
      acc[review.status] = (acc[review.status] || 0) + 1;
      return acc;
    }, {} as Record<ReviewStatus, number>);
    
    const qualityScores = reviews
      .filter(r => r.quality_score !== null)
      .map(r => r.quality_score!);
    
    const avgQualityScore = qualityScores.length > 0
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : null;
    
    const reviewTypes = [...new Set(reviews.map(r => r.review_type))];
    
    res.json({
      success: true,
      summary: {
        work_item_id: req.params.id,
        total_reviews: reviews.length,
        approved: statusCounts.approved || 0,
        needs_revision: statusCounts.needs_revision || 0,
        rejected: statusCounts.rejected || 0,
        pending: statusCounts.pending || 0,
        average_quality_score: avgQualityScore,
        review_types: reviewTypes
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;