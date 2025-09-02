/**
 * Standardized response types for MCP tools
 * Provides consistent structure for AI agents
 */

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
  retry_after?: number;
}

/**
 * Standard error structure for AI agents
 */
export interface StandardError {
  code: string;
  message: string;
  suggested_action?: string;
  can_retry?: boolean;
  alternative_tool?: string;
}

/**
 * Response metadata for AI agents
 */
export interface ResponseMetadata {
  cached?: boolean;
  cache_age?: number;
  plan_enforced?: boolean;
  rate_limit?: RateLimitInfo;
  processing_time_ms?: number;
  data_type?: string;
  total_items?: number;
  page?: number;
  page_size?: number;
}

/**
 * Standard response wrapper for all MCP tools
 */
export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  error?: StandardError;
  metadata?: ResponseMetadata;
}

/**
 * Query enhancement suggestions for AI
 */
export interface QuerySuggestions {
  suggested_refinements?: string[];
  did_you_mean?: string;
  related_queries?: string[];
  query_too_broad?: boolean;
  filter_suggestions?: {
    date_range?: string;
    content_type?: string;
    location?: string;
  };
}

/**
 * Enhanced search response with suggestions
 */
export interface EnhancedSearchResponse<T = any> extends StandardResponse<T> {
  suggestions?: QuerySuggestions;
}