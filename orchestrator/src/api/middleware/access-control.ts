import { Request, Response, NextFunction } from 'express';
import { Pattern, PatternMetadata } from '../../types/knowledge.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger();

export interface AccessControlConfig {
  enabled: boolean;
  sensitivePatternTags: string[];
  sensitivePatternTypes: string[];
  allowedRoles: string[];
  requireApiKey: boolean;
  apiKeyHeader: string;
}

const DEFAULT_CONFIG: AccessControlConfig = {
  enabled: true,
  sensitivePatternTags: ['security', 'credentials', 'api-keys', 'secrets', 'sensitive'],
  sensitivePatternTypes: ['security', 'authentication'],
  allowedRoles: ['architect', 'security'],
  requireApiKey: false,
  apiKeyHeader: 'x-api-key'
};

// Simple in-memory API key store (in production, use proper key management)
const validApiKeys = new Set([
  process.env.KNOWLEDGE_BASE_API_KEY || 'dev-api-key'
]);

export class AccessControl {
  private config: AccessControlConfig;

  constructor(config: Partial<AccessControlConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a pattern is sensitive based on tags and type
   */
  isPatternSensitive(pattern: Pattern): boolean {
    if (!this.config.enabled) return false;

    // Check pattern type
    if (this.config.sensitivePatternTypes.includes(pattern.pattern_type)) {
      return true;
    }

    // Check metadata tags
    if (pattern.metadata) {
      try {
        const metadata = JSON.parse(pattern.metadata) as PatternMetadata;
        if (metadata.tags) {
          const hasSensitiveTag = metadata.tags.some(tag => 
            this.config.sensitivePatternTags.some(sensitiveTag => 
              tag.toLowerCase().includes(sensitiveTag.toLowerCase())
            )
          );
          if (hasSensitiveTag) return true;
        }
        
        // Check if marked as sensitive in metadata
        if (metadata.sensitive === true) return true;
      } catch (e) {
        logger.warn('Failed to parse pattern metadata', { patternId: pattern.id });
      }
    }

    // Check if context or solution contains sensitive keywords
    const contentToCheck = `${pattern.context} ${pattern.solution}`.toLowerCase();
    const sensitiveKeywords = ['password', 'secret', 'api_key', 'token', 'credential'];
    
    return sensitiveKeywords.some(keyword => contentToCheck.includes(keyword));
  }

  /**
   * Filter patterns based on access control
   */
  filterPatterns(patterns: Pattern[], userRole?: string, hasApiKey: boolean = false): Pattern[] {
    if (!this.config.enabled) return patterns;

    return patterns.map(pattern => {
      if (this.isPatternSensitive(pattern)) {
        // Check if user has access
        if (hasApiKey || (userRole && this.config.allowedRoles.includes(userRole))) {
          return pattern;
        }

        // Redact sensitive information
        return {
          ...pattern,
          solution: '[REDACTED - Requires proper authorization]',
          metadata: JSON.stringify({
            ...this.parseMetadata(pattern.metadata),
            redacted: true,
            reason: 'sensitive_content'
          })
        };
      }
      return pattern;
    });
  }

  /**
   * Middleware to check API key for sensitive operations
   */
  requireApiKey() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled || !this.config.requireApiKey) {
        return next();
      }

      const apiKey = req.headers[this.config.apiKeyHeader] as string;
      
      if (!apiKey || !validApiKeys.has(apiKey)) {
        logger.warn('Invalid API key attempt', { 
          ip: req.ip, 
          path: req.path,
          headers: req.headers
        });
        
        return res.status(403).json({
          success: false,
          error: 'Invalid or missing API key'
        });
      }

      // Add flag to request to indicate valid API key
      (req as any).hasValidApiKey = true;
      next();
    };
  }

  /**
   * Middleware to check role-based access
   */
  requireRole(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      // Get user role from header or query param (in production, get from auth token)
      const userRole = req.headers['x-user-role'] as string || req.query.role as string;
      
      if (!userRole || !allowedRoles.includes(userRole)) {
        logger.warn('Unauthorized role access attempt', { 
          userRole,
          allowedRoles,
          path: req.path 
        });
        
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      (req as any).userRole = userRole;
      next();
    };
  }

  /**
   * Get access control status for diagnostics
   */
  getStatus(): any {
    return {
      enabled: this.config.enabled,
      sensitivePatternTags: this.config.sensitivePatternTags,
      sensitivePatternTypes: this.config.sensitivePatternTypes,
      requireApiKey: this.config.requireApiKey
    };
  }

  private parseMetadata(metadata: string | null): PatternMetadata {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
}

// Export default instance
export const accessControl = new AccessControl({
  enabled: process.env.ENABLE_ACCESS_CONTROL !== 'false',
  requireApiKey: process.env.REQUIRE_API_KEY === 'true'
});

// Export middleware shortcuts
export const requireApiKey = () => accessControl.requireApiKey();
export const requireRole = (roles: string[]) => accessControl.requireRole(roles);