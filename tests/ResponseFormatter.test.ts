/**
 * Tests for ResponseFormatter utility
 * Covers response formatting, error handling, and metadata extraction
 */

import { ResponseFormatter } from '../src/utils/ResponseFormatter.js';
import { APError, APAPIError, APRateLimitError, APNotFoundError, APAuthenticationError } from '../src/errors/APError.js';

describe('ResponseFormatter', () => {
  describe('success', () => {
    test('should create successful response with data only', () => {
      const data = { test: 'value', items: [1, 2, 3] };
      const response = ResponseFormatter.success(data);
      
      expect(response).toEqual({
        success: true,
        data,
        metadata: {}
      });
    });

    test('should create successful response with metadata', () => {
      const data = { result: 'test' };
      const metadata = { 
        total_items: 100,
        page: 1,
        timestamp: new Date().toISOString()
      };
      
      const response = ResponseFormatter.success(data, metadata);
      
      expect(response).toEqual({
        success: true,
        data,
        metadata
      });
    });

    test('should handle null data', () => {
      const response = ResponseFormatter.success(null);
      
      expect(response).toEqual({
        success: true,
        data: null,
        metadata: {}
      });
    });

    test('should handle array data', () => {
      const data = [1, 2, 3, 4, 5];
      const response = ResponseFormatter.success(data);
      
      expect(response.data).toEqual(data);
      expect(response.success).toBe(true);
    });
  });

  describe('error', () => {
    test('should format APError correctly', () => {
      const error = new APError('Test error', 'TEST_CODE', 400);
      const response = ResponseFormatter.error(error);
      
      expect(response).toEqual({
        success: false,
        error: {
          code: 'TEST_CODE',
          message: 'Test error',
          suggested_action: 'Review request parameters and correct any invalid values',
          can_retry: false,
          alternative_tool: undefined
        },
        metadata: {}
      });
    });

    test('should format generic Error', () => {
      const error = new Error('Generic error message');
      const response = ResponseFormatter.error(error);
      
      expect(response).toEqual({
        success: false,
        error: {
          code: 'ERROR',
          message: 'Generic error message',
          suggested_action: 'Check error details and retry if appropriate',
          can_retry: false
        },
        metadata: {}
      });
    });

    test('should handle string errors', () => {
      const response = ResponseFormatter.error('String error');
      
      expect(response).toEqual({
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'String error',
          suggested_action: 'Contact support if issue persists',
          can_retry: false
        },
        metadata: {}
      });
    });

    test('should handle null/undefined errors', () => {
      const responseNull = ResponseFormatter.error(null);
      const responseUndefined = ResponseFormatter.error(undefined);
      
      expect(responseNull.error?.code).toBe('UNKNOWN_ERROR');
      expect(responseUndefined.error?.code).toBe('UNKNOWN_ERROR');
    });

    test('should include metadata in error response', () => {
      const error = new APError('Test', 'CODE');
      const metadata = { request_id: '123', timestamp: Date.now() };
      
      const response = ResponseFormatter.error(error, metadata);
      
      expect(response.metadata).toEqual(metadata);
    });
  });

  describe('formatError', () => {
    test('should handle rate limit errors (429)', () => {
      const error = new APRateLimitError('Rate limit exceeded');
      (error as any).statusCode = 429;
      
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted).toEqual({
        code: 'RATE_LIMIT_ERROR',
        message: 'Rate limit exceeded',
        suggested_action: 'Wait for rate limit reset before retrying',
        can_retry: true,
        alternative_tool: undefined
      });
    });

    test('should handle not found errors (404)', () => {
      const error = new APNotFoundError('Item not found');
      (error as any).statusCode = 404;
      
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted).toEqual({
        code: 'NOT_FOUND_ERROR',
        message: 'Item not found',
        suggested_action: 'Verify the item ID or try a broader search',
        can_retry: false,
        alternative_tool: 'search_content'
      });
    });

    test('should handle authentication errors (401)', () => {
      const error = new APAuthenticationError('Invalid API key');
      (error as any).statusCode = 401;
      
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted).toEqual({
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid API key',
        suggested_action: 'Check API key configuration',
        can_retry: false,
        alternative_tool: undefined
      });
    });

    test('should handle forbidden errors (403)', () => {
      const error = new APAPIError('Access denied', 403, 'FORBIDDEN');
      (error as any).statusCode = 403;
      
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted).toEqual({
        code: 'FORBIDDEN',
        message: 'Access denied',
        suggested_action: 'Verify you have access to this content in your plan',
        can_retry: false,
        alternative_tool: undefined
      });
    });

    test('should handle server errors (5xx)', () => {
      const error = new APAPIError('Internal server error', 500, 'SERVER_ERROR');
      (error as any).statusCode = 500;
      
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted).toEqual({
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        suggested_action: 'AP API service issue - retry after a short delay',
        can_retry: false,
        alternative_tool: undefined
      });
    });

    test('should handle network errors as retryable', () => {
      const error = new APError('Network timeout', 'NETWORK_ERROR');
      
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted.can_retry).toBe(true);
    });

    test('should handle gateway errors as retryable', () => {
      const error = new APAPIError('Bad gateway', 'BAD_GATEWAY', 502);
      (error as any).statusCode = 502;
      
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted.can_retry).toBe(true);
    });

    test('should handle service unavailable as retryable', () => {
      const error = new APAPIError('Service unavailable', 'SERVICE_UNAVAILABLE', 503);
      (error as any).statusCode = 503;
      
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted.can_retry).toBe(true);
    });

    test('should handle gateway timeout as retryable', () => {
      const error = new APAPIError('Gateway timeout', 'GATEWAY_TIMEOUT', 504);
      (error as any).statusCode = 504;
      
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted.can_retry).toBe(true);
    });
  });

  describe('extractRateLimitInfo', () => {
    test('should extract rate limit info from headers', () => {
      const headers = {
        'x-ratelimit-remaining': '45',
        'x-ratelimit-reset': '1609459200',
        'x-ratelimit-limit': '100'
      };
      
      const info = ResponseFormatter.extractRateLimitInfo(headers);
      
      expect(info).toEqual({
        remaining: 45,
        reset: 1609459200,
        limit: 100,
        retry_after: undefined
      });
    });

    test('should handle capitalized header names', () => {
      const headers = {
        'X-RateLimit-Remaining': '20',
        'X-RateLimit-Reset': '1609459300',
        'X-RateLimit-Limit': '50',
        'Retry-After': '30'
      };
      
      const info = ResponseFormatter.extractRateLimitInfo(headers);
      
      expect(info).toEqual({
        remaining: 20,
        reset: 1609459300,
        limit: 50,
        retry_after: 30
      });
    });

    test('should return undefined when no rate limit headers present', () => {
      const headers = {
        'content-type': 'application/json',
        'cache-control': 'no-cache'
      };
      
      const info = ResponseFormatter.extractRateLimitInfo(headers);
      
      expect(info).toBeUndefined();
    });

    test('should handle partial rate limit headers', () => {
      const headers = {
        'x-ratelimit-remaining': '10'
      };
      
      const info = ResponseFormatter.extractRateLimitInfo(headers);
      
      expect(info).toEqual({
        remaining: 10,
        reset: 0,
        limit: 100,
        retry_after: undefined
      });
    });

    test('should handle invalid numeric values', () => {
      const headers = {
        'x-ratelimit-remaining': 'invalid',
        'x-ratelimit-reset': 'not-a-number',
        'x-ratelimit-limit': 'abc'
      };
      
      const info = ResponseFormatter.extractRateLimitInfo(headers);
      
      expect(info).toEqual({
        remaining: NaN,
        reset: NaN,
        limit: NaN,
        retry_after: undefined
      });
    });
  });

  describe('createQuerySuggestions', () => {
    test('should suggest refinements for broad queries', () => {
      const suggestions = ResponseFormatter.createQuerySuggestions(
        'news',
        20,
        1500
      );
      
      expect(suggestions).toBeDefined();
      expect(suggestions?.query_too_broad).toBe(true);
      expect(suggestions?.suggested_refinements).toContain('news AND firstcreated:[NOW-7DAYS TO NOW]');
      expect(suggestions?.filter_suggestions).toBeDefined();
    });

    test('should add filter suggestions for moderately broad queries', () => {
      const suggestions = ResponseFormatter.createQuerySuggestions(
        'politics',
        20,
        600
      );
      
      expect(suggestions).toBeDefined();
      expect(suggestions?.query_too_broad).toBeUndefined();
      expect(suggestions?.filter_suggestions).toBeDefined();
      expect(suggestions?.filter_suggestions?.date_range).toBe('firstcreated:[NOW-24HOURS TO NOW]');
    });

    test('should add related queries for short queries', () => {
      const suggestions = ResponseFormatter.createQuerySuggestions(
        'covid',
        10,
        100
      );
      
      expect(suggestions).toBeDefined();
      expect(suggestions?.related_queries).toContain('covid breaking');
      expect(suggestions?.related_queries).toContain('covid latest');
      expect(suggestions?.related_queries).toContain('covid analysis');
    });

    test('should return undefined for narrow queries', () => {
      const suggestions = ResponseFormatter.createQuerySuggestions(
        'very specific long query about something particular',
        5,
        10
      );
      
      expect(suggestions).toBeUndefined();
    });

    test('should handle edge case with zero results', () => {
      const suggestions = ResponseFormatter.createQuerySuggestions(
        'test',
        0,
        0
      );
      
      // Short queries still get related query suggestions even with no results
      expect(suggestions).toBeDefined();
      expect(suggestions?.related_queries).toContain('test breaking');
    });
  });

  describe('formatSearchResponse', () => {
    test('should format search response with suggestions', () => {
      const data = { items: [{ id: 1 }, { id: 2 }] };
      const query = 'news';
      const metadata = { total_items: 1200, page: 1 };
      
      const response = ResponseFormatter.formatSearchResponse(
        data,
        query,
        metadata,
        1200
      );
      
      expect(response).toEqual({
        success: true,
        data,
        metadata,
        suggestions: expect.objectContaining({
          query_too_broad: true,
          suggested_refinements: expect.any(Array)
        })
      });
    });

    test('should format search response without suggestions', () => {
      const data = { items: [] };
      const query = 'very specific long query with many words to avoid suggestions';
      const metadata = { total_items: 5, page: 1 };
      
      const response = ResponseFormatter.formatSearchResponse(
        data,
        query,
        metadata,
        5
      );
      
      expect(response).toEqual({
        success: true,
        data,
        metadata,
        suggestions: undefined
      });
    });

    test('should handle empty metadata', () => {
      const data = { results: [] };
      const query = 'test';
      const metadata = {};
      
      const response = ResponseFormatter.formatSearchResponse(
        data,
        query,
        metadata,
        0
      );
      
      expect(response.success).toBe(true);
      expect(response.metadata).toEqual({});
    });
  });

  describe('Edge cases', () => {
    test('should handle circular reference in error details', () => {
      const error = new APError('Test', 'CODE');
      const circularObj: any = { prop: 'value' };
      circularObj.circular = circularObj;
      (error as any).details = circularObj;
      
      expect(() => ResponseFormatter.error(error)).not.toThrow();
    });

    test('should handle very large metadata objects', () => {
      const largeMetadata: any = {};
      for (let i = 0; i < 1000; i++) {
        largeMetadata[`key_${i}`] = `value_${i}`;
      }
      
      const response = ResponseFormatter.success({ data: 'test' }, largeMetadata);
      
      expect(Object.keys(response.metadata).length).toBe(1000);
    });

    test('should preserve error code when no specific code exists', () => {
      const error = new APError('Test error', undefined as any);
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted.code).toBe('AP_ERROR');
    });

    test('should handle errors with numeric codes', () => {
      const error = new APError('Test', 123 as any);
      const formatted = ResponseFormatter.formatError(error);
      
      expect(formatted.code).toBe(123);
    });
  });
});