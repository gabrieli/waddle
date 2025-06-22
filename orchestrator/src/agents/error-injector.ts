import { OrchestratorConfig } from '../orchestrator/config.js';
import { getLogger } from '../utils/logger.js';
const logger = getLogger();

export interface ErrorInjectionContext {
  agentType: string;
  workItemId?: string;
  epicTitle?: string;
}

class ErrorInjector {
  private random: () => number;
  private injectionCount = 0;

  constructor(seed?: number) {
    // Use a seeded random number generator for reproducibility
    if (seed !== undefined) {
      let currentSeed = seed;
      this.random = () => {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        return currentSeed / 233280;
      };
    } else {
      this.random = Math.random;
    }
  }

  shouldInjectError(config: OrchestratorConfig, agentType: string): boolean {
    if (!config.errorInjection?.enabled) {
      return false;
    }

    const { targetAgents, injectionRate } = config.errorInjection;

    // Check if this agent is targeted
    if (!targetAgents.includes(agentType)) {
      return false;
    }

    // Check injection rate
    const roll = this.random() * 100;
    return roll < injectionRate;
  }

  injectError(
    jsonStr: string, 
    config: OrchestratorConfig, 
    context: ErrorInjectionContext
  ): string {
    if (!config.errorInjection?.enabled) {
      return jsonStr;
    }

    const errorTypes = config.errorInjection.errorTypes;
    const enabledErrors = Object.entries(errorTypes)
      .filter(([_, enabled]) => enabled)
      .map(([type, _]) => type);

    if (enabledErrors.length === 0) {
      return jsonStr;
    }

    // Select a random error type
    const errorType = enabledErrors[Math.floor(this.random() * enabledErrors.length)];
    this.injectionCount++;

    logger.warn(`🔴 Error Injection #${this.injectionCount}: Injecting ${errorType} for ${context.agentType}`, {
      errorType,
      agentType: context.agentType,
      workItemId: context.workItemId,
      epicTitle: context.epicTitle,
      originalJsonLength: jsonStr.length
    });

    let corruptedJson: string;
    
    switch (errorType) {
      case 'syntaxError':
        corruptedJson = this.injectSyntaxError(jsonStr);
        break;
      case 'typeError':
        corruptedJson = this.injectTypeError(jsonStr);
        break;
      case 'missingFields':
        corruptedJson = this.injectMissingFields(jsonStr);
        break;
      case 'unexpectedStructure':
        corruptedJson = this.injectUnexpectedStructure();
        break;
      case 'truncatedJson':
        corruptedJson = this.injectTruncatedJson(jsonStr);
        break;
      case 'invalidCharacters':
        corruptedJson = this.injectInvalidCharacters(jsonStr);
        break;
      default:
        corruptedJson = jsonStr;
    }

    logger.info(`🔴 Injected error result:`, { 
      errorType,
      corruptedJson: corruptedJson.substring(0, 200) + (corruptedJson.length > 200 ? '...' : '')
    });

    return corruptedJson;
  }

  private injectSyntaxError(jsonStr: string): string {
    const errors = [
      () => jsonStr.replace(/"/g, "'"), // Single quotes instead of double
      () => jsonStr.replace(/,(?=\s*})/g, ',,'), // Double commas
      () => jsonStr.replace(/{/g, '{{'), // Double opening braces
      () => jsonStr.slice(0, -1), // Remove last character (likely })
      () => jsonStr.replace(/:/g, '='), // Replace colons with equals
      () => jsonStr.replace(/\[/g, '('), // Replace brackets with parentheses
    ];
    
    const errorFn = errors[Math.floor(this.random() * errors.length)];
    return errorFn();
  }

  private injectTypeError(jsonStr: string): string {
    try {
      const obj = JSON.parse(jsonStr);
      
      // Randomly change types
      if (obj.technicalApproach && typeof obj.technicalApproach === 'string') {
        obj.technicalApproach = 123; // String to number
      }
      if (Array.isArray(obj.stories)) {
        obj.stories = "not an array"; // Array to string
      }
      if (obj.risks) {
        obj.risks = { invalid: "object" }; // Array to object
      }
      
      return JSON.stringify(obj);
    } catch {
      // If parse fails, return original with type confusion
      return jsonStr.replace(/"true"/g, 'true').replace(/"false"/g, 'false').replace(/"null"/g, 'null');
    }
  }

  private injectMissingFields(jsonStr: string): string {
    try {
      const obj = JSON.parse(jsonStr);
      
      // Remove required fields
      const fieldsToRemove = ['technicalApproach', 'stories', 'risks', 'dependencies'];
      const toRemove = fieldsToRemove[Math.floor(this.random() * fieldsToRemove.length)];
      
      delete obj[toRemove];
      
      return JSON.stringify(obj);
    } catch {
      // If parse fails, return truncated JSON
      return '{}';
    }
  }

  private injectUnexpectedStructure(): string {
    const structures = [
      '[]', // Array instead of object
      '"just a string"', // String instead of object
      '42', // Number instead of object
      'null', // Null
      '{"completely": {"wrong": {"structure": "here"}}}', // Nested nonsense
      '{"error": "Something went wrong", "code": 500}', // Error-like structure
    ];
    
    return structures[Math.floor(this.random() * structures.length)];
  }

  private injectTruncatedJson(jsonStr: string): string {
    // Truncate at a random position (but at least 10 chars in)
    const minLength = Math.min(10, jsonStr.length);
    const truncateAt = minLength + Math.floor(this.random() * (jsonStr.length - minLength));
    
    return jsonStr.substring(0, truncateAt);
  }

  private injectInvalidCharacters(jsonStr: string): string {
    const invalidChars = [
      '\u0000', // Null character
      '\u001F', // Unit separator
      '�', // Replacement character
      '\uFEFF', // Zero-width no-break space (BOM)
      '🔥', // Emoji
      '<script>', // HTML injection attempt
    ];
    
    const char = invalidChars[Math.floor(this.random() * invalidChars.length)];
    const position = Math.floor(this.random() * jsonStr.length);
    
    return jsonStr.slice(0, position) + char + jsonStr.slice(position);
  }
}

// Singleton instance
let errorInjector: ErrorInjector | null = null;

export function getErrorInjector(config: OrchestratorConfig): ErrorInjector {
  if (!errorInjector || config.errorInjection?.seed !== undefined) {
    errorInjector = new ErrorInjector(config.errorInjection?.seed);
  }
  return errorInjector;
}