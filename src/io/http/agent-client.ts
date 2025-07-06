/**
 * HTTP client for agent initialization
 * IO layer implementation
 */

import * as AgentInit from '../../core/workflows/agent-initialization.ts';

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * HTTP client implementation using fetch
 */
export class FetchHttpClient implements AgentInit.HttpClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 5000;
  }

  async delete(url: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  async post(url: string, data: any): Promise<{ success: boolean; id?: number }> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  async patch(url: string, data: any): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }
}

/**
 * Factory function to create HTTP client
 */
export function createHttpClient(config: HttpClientConfig): AgentInit.HttpClient {
  return new FetchHttpClient(config);
}