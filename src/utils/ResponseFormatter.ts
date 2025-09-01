/**
 * Response formatter utility for standardizing MCP responses
 */

import {
  StandardResponse,
  StandardError,
  ResponseMetadata,
  RateLimitInfo,
  QuerySuggestions,
  EnhancedSearchResponse
} from '../types/responses.types.js';
import { APError } from '../errors/APError.js';

export class ResponseFormatter {
  /**
   * Create a successful response
   */
  static success<T>(
    data: T,
    metadata?: ResponseMetadata
  ): StandardResponse<T> {
    return {
      success: true,
      data,
      metadata: metadata || {}
    };
  }

  /**
   * Create an error response
   */
  static error(
    error: Error | APError | any,
    metadata?: ResponseMetadata
  ): StandardResponse {
    const standardError = this.formatError(error);
    
    return {
      success: false,
      error: standardError,
      metadata: metadata || {}
    };
  }

  /**
   * Format an error for AI consumption
   */
  static formatError(error: Error | APError | any): StandardError {
    // Handle APError specifically
    if (error instanceof APError) {
      return {
        code: error.code || 'AP_ERROR',
        message: error.message,
        suggested_action: this.getSuggestedAction(error),
        can_retry: this.canRetry(error),
        alternative_tool: this.getAlternativeTool(error)
      };
    }

    // Handle generic errors
    if (error instanceof Error) {
      return {
        code: 'ERROR',
        message: error.message,
        suggested_action: 'Check error details and retry if appropriate',
        can_retry: false
      };
    }

    // Handle unknown errors
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      suggested_action: 'Contact support if issue persists',
      can_retry: false
    };
  }

  /**
   * Extract rate limit info from headers
   */
  static extractRateLimitInfo(headers: Record<string, string>): RateLimitInfo | undefined {
    const remaining = headers['x-ratelimit-remaining'] || headers['X-RateLimit-Remaining'];
    const reset = headers['x-ratelimit-reset'] || headers['X-RateLimit-Reset'];
    const limit = headers['x-ratelimit-limit'] || headers['X-RateLimit-Limit'];
    const retryAfter = headers['retry-after'] || headers['Retry-After'];

    if (!remaining && !reset && !limit) {
      return undefined;
    }

    return {
      remaining: parseInt(remaining || '100', 10),
      reset: parseInt(reset || '0', 10),
      limit: parseInt(limit || '100', 10),
      retry_after: retryAfter ? parseInt(retryAfter, 10) : undefined
    };
  }

  /**
   * Determine suggested action based on error
   */
  private static getSuggestedAction(error: APError): string {
    const statusCode = (error as any).statusCode;
    
    if (statusCode === 429) {
      return 'Wait for rate limit reset before retrying';
    } else if (statusCode === 404) {
      return 'Verify the item ID or try a broader search';
    } else if (statusCode === 401) {
      return 'Check API key configuration';
    } else if (statusCode === 403) {
      return 'Verify you have access to this content in your plan';
    } else if (statusCode === 400) {
      return 'Review request parameters and correct any invalid values';
    } else if (statusCode >= 500) {
      return 'AP API service issue - retry after a short delay';
    }

    return 'Review error details and adjust request accordingly';
  }

  /**
   * Determine if error is retryable
   */
  private static canRetry(error: APError): boolean {
    const statusCode = (error as any).statusCode;
    
    // Retryable status codes
    const retryableCodes = [429, 502, 503, 504];
    if (retryableCodes.includes(statusCode)) {
      return true;
    }

    // Network errors are usually retryable
    if (error.code === 'NETWORK_ERROR') {
      return true;
    }

    return false;
  }

  /**
   * Suggest alternative tool based on error
   */
  private static getAlternativeTool(error: APError): string | undefined {
    const statusCode = (error as any).statusCode;
    
    if (statusCode === 404) {
      return 'search_content';
    }
    
    return undefined;
  }

  /**
   * Create query suggestions for search results
   */
  static createQuerySuggestions(
    query: string,
    resultCount: number,
    totalItems: number
  ): QuerySuggestions | undefined {
    const suggestions: QuerySuggestions = {};

    // Check if query is too broad
    if (totalItems > 1000) {
      suggestions.query_too_broad = true;
      suggestions.suggested_refinements = [
        `${query} AND firstcreated:[NOW-7DAYS TO NOW]`,
        `${query} AND type:text`,
        `${query} AND place.name:"United States"`
      ];
    }

    // Add filter suggestions for broad queries
    if (totalItems > 500) {
      suggestions.filter_suggestions = {
        date_range: 'firstcreated:[NOW-24HOURS TO NOW]',
        content_type: 'type:text OR type:picture',
        location: 'place.name:"United States"'
      };
    }

    // Add related queries based on common patterns
    if (query.length < 20) {
      suggestions.related_queries = [
        `${query} breaking`,
        `${query} latest`,
        `${query} analysis`
      ];
    }

    return Object.keys(suggestions).length > 0 ? suggestions : undefined;
  }

  /**
   * Format search response with enhancements
   */
  static formatSearchResponse<T>(
    data: T,
    query: string,
    metadata: ResponseMetadata,
    totalItems: number
  ): EnhancedSearchResponse<T> {
    const suggestions = this.createQuerySuggestions(
      query,
      metadata.total_items || 0,
      totalItems
    );

    return {
      success: true,
      data,
      metadata,
      suggestions
    };
  }
}