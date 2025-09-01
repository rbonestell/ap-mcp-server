/**
 * Tests for APHttpClient - HTTP client for AP API requests
 * Tests retry logic, timeout handling, URL building, and error processing
 */

import { APHttpClient } from '../src/http/APHttpClient.js';
import { APConfigManager } from '../src/config/APConfig.js';
import { 
  APNetworkError, 
  APRateLimitError, 
  APAPIError, 
  APAuthenticationError,
  APNotFoundError,
  APError,
  APValidationError
} from '../src/errors/APError.js';
import { 
  createMockFetchResponse, 
  createMockFetchError, 
  setDefaultTestEnv 
} from './setup.js';
import { 
  mockSearchResponse, 
  mockAPIError, 
  mockRateLimitError, 
  mockUnauthorizedError 
} from './fixtures/api-responses.js';

// Mock global fetch
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('APHttpClient', () => {
  let config: APConfigManager;
  let httpClient: APHttpClient;
  let sleepSpy: jest.SpyInstance;
  let setTimeoutSpy: jest.SpyInstance;
  let clearTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    setDefaultTestEnv();
    config = APConfigManager.fromEnvironment();
    httpClient = new APHttpClient(config);
    
    // Mock the sleep method to avoid real delays
    sleepSpy = jest.spyOn(httpClient as any, 'sleep').mockImplementation(() => Promise.resolve());
    
    // Mock setTimeout and clearTimeout to control timing in tests
    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay: number) => {
      // Don't actually set timeouts, just return a fake ID
      return 12345 as any; // Return fake timer ID
    });
    clearTimeoutSpy = jest.spyOn(global, 'clearTimeout').mockImplementation(() => {});
  });

  afterEach(() => {
    if (sleepSpy) {
      sleepSpy.mockRestore();
    }
    if (setTimeoutSpy) {
      setTimeoutSpy.mockRestore();
    }
    if (clearTimeoutSpy) {
      clearTimeoutSpy.mockRestore();
    }
  });

  describe('Constructor and Configuration', () => {
    test('should create client with default options from config', () => {
      const client = new APHttpClient(config);
      const clientConfig = client.getConfig();
      
      expect(clientConfig.timeout).toBe(30000);
      expect(clientConfig.retries).toBe(3);
      expect(clientConfig.baseUrl).toBe('https://api.ap.org/media/v');
    });

    test('should create client with custom options', () => {
      const customOptions = {
        timeout: 15000,
        retries: 5,
        retryDelay: 2000
      };
      
      const client = new APHttpClient(config, customOptions);
      const clientConfig = client.getConfig();
      
      expect(clientConfig.timeout).toBe(15000);
      expect(clientConfig.retries).toBe(5);
    });

    test('should override config values with provided options', () => {
      // Set different values in config
      process.env.AP_TIMEOUT = '45000';
      process.env.AP_RETRIES = '1';
      const testConfig = APConfigManager.fromEnvironment();
      
      const client = new APHttpClient(testConfig, {
        timeout: 20000,
        retries: 2
      });
      
      const clientConfig = client.getConfig();
      expect(clientConfig.timeout).toBe(20000);
      expect(clientConfig.retries).toBe(2);
    });
  });

  describe('URL Building with Parameters', () => {
    test('should build URL without parameters', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      await httpClient.get('content/search');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ap.org/media/v/content/search',
        expect.any(Object)
      );
    });

    test('should build URL with simple parameters', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      await httpClient.get('content/search', {
        q: 'technology',
        count: 10,
        format: 'json'
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ap.org/media/v/content/search?q=technology&count=10&format=json',
        expect.any(Object)
      );
    });

    test('should build URL with array parameters', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      await httpClient.get('content/search', {
        q: 'news',
        include: ['headline', 'body_text', 'byline'],
        subject: ['04000000', '11000000']
      });
      
      const expectedUrl = 'https://api.ap.org/media/v/content/search?q=news&include=headline%2Cbody_text%2Cbyline&subject=04000000%2C11000000';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });

    test('should handle null and undefined parameters', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      await httpClient.get('content/search', {
        q: 'test',
        count: null,
        format: undefined,
        page: 1
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ap.org/media/v/content/search?q=test&page=1',
        expect.any(Object)
      );
    });

    test('should handle boolean and number parameters', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      await httpClient.get('content/search', {
        q: 'test',
        pricing: true,
        urgency: 3,
        withPhotos: false
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ap.org/media/v/content/search?q=test&pricing=true&urgency=3&withPhotos=false',
        expect.any(Object)
      );
    });
  });

  describe('HTTP Methods', () => {
    test('GET request should work correctly', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      const response = await httpClient.get('content/search', { q: 'test' });
      
      expect(response.data).toEqual(mockSearchResponse);
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('content/search'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-api-key': 'test_api_key'
          })
        })
      );
    });

    test('POST request should work correctly', async () => {
      const mockResponse = { data: { success: true } };
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockResponse));
      
      const requestBody = { name: 'Test Monitor', query: 'technology' };
      const response = await httpClient.post('monitors', requestBody);
      
      expect(response.data).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ap.org/media/v/monitors',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: expect.objectContaining({
            'x-api-key': 'test_api_key'
          })
        })
      );
    });

    test('PUT request should work correctly', async () => {
      const mockResponse = { data: { updated: true } };
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockResponse));
      
      const requestBody = { name: 'Updated Monitor' };
      const response = await httpClient.put('monitors/123', requestBody);
      
      expect(response.data).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ap.org/media/v/monitors/123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(requestBody)
        })
      );
    });

    test('DELETE request should work correctly', async () => {
      const mockResponse = { data: { deleted: true } };
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockResponse));
      
      const response = await httpClient.delete('monitors/123');
      
      expect(response.data).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ap.org/media/v/monitors/123',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    test('should handle string request body for POST', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse({ success: true }));
      
      await httpClient.post('endpoint', 'raw string data');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: 'raw string data'
        })
      );
    });
  });

  describe('Response Processing', () => {
    test('should process JSON response correctly', async () => {
      const jsonData = { message: 'success', data: [1, 2, 3] };
      const mockResponse = new Response(JSON.stringify(jsonData), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      const response = await httpClient.get('test');
      
      expect(response.data).toEqual(jsonData);
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.headers['content-type']).toBe('application/json');
    });

    test('should process XML response correctly', async () => {
      const xmlData = '<?xml version="1.0"?><root><item>test</item></root>';
      const mockResponse = new Response(xmlData, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/xml' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      const response = await httpClient.get('rss/feed');
      
      expect(response.data).toBe(xmlData);
      expect(response.headers['content-type']).toBe('application/xml');
    });

    test('should process text/xml response correctly', async () => {
      const xmlData = '<rss version="2.0"><channel><item>news</item></channel></rss>';
      const mockResponse = new Response(xmlData, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/xml' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      const response = await httpClient.get('rss/feed');
      
      expect(response.data).toBe(xmlData);
    });

    test('should process plain text response correctly', async () => {
      const textData = 'Plain text response';
      const mockResponse = new Response(textData, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      const response = await httpClient.get('text-endpoint');
      
      expect(response.data).toBe(textData);
    });

    test('should handle response with no content-type header', async () => {
      const textData = 'No content type';
      const mockResponse = new Response(textData, {
        status: 200,
        statusText: 'OK'
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      const response = await httpClient.get('endpoint');
      
      expect(response.data).toBe(textData);
    });

    test('should handle malformed JSON in error response', async () => {
      const mockResponse = new Response('invalid json{', {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/json' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APAPIError);
    });

    test('should handle malformed JSON in success response', async () => {
      const invalidJson = '{"incomplete": json';
      const mockResponse = new Response(invalidJson, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      const response = await httpClient.get('endpoint');
      
      // Should fallback to text when JSON parsing fails
      expect(response.data).toBe(invalidJson);
    });
  });

  describe('Error Handling', () => {
    test('should handle 400 Bad Request errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockAPIError, 400, false));
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APValidationError);
    });

    test('should handle 401 Unauthorized errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockUnauthorizedError, 401, false));
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APAuthenticationError);
    });

    test('should handle 404 Not Found errors', async () => {
      const notFoundError = { error: { code: 'NOT_FOUND', message: 'Resource not found' } };
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(notFoundError, 404, false));
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APNotFoundError);
    });

    test('should handle 429 Rate Limit errors', async () => {
      const mockResponse = createMockFetchResponse(mockRateLimitError, 429, false);
      // Rate limit errors are retried, so we need to mock all retry attempts
      mockFetch
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse) 
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse); // Initial + 3 retries
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APRateLimitError);
    });

    test('should handle 500 Server errors', async () => {
      const serverError = { error: { code: 'INTERNAL_ERROR', message: 'Server error' } };
      const mockResponse = createMockFetchResponse(serverError, 500, false);
      // Server errors are retried, so we need to mock all retry attempts
      mockFetch
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse) 
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse); // Initial + 3 retries
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APAPIError);
    });

    test('should handle network fetch errors', async () => {
      const networkError = new Error('Failed to fetch');
      // Network errors are retried, so mock all retry attempts
      mockFetch.mockRejectedValue(networkError);
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APNetworkError);
    });

    test('should handle abort/timeout errors', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);
      
      const error = await httpClient.get('endpoint').catch(e => e);
      expect(error).toBeInstanceOf(APNetworkError);
      expect(error.message).toContain('Request timeout after');
    });
  });

  describe('Retry Logic', () => {
    test('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      const response = await httpClient.get('endpoint');
      
      expect(response.data).toEqual(mockSearchResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test('should retry on 500 server errors', async () => {
      const serverError = { error: { code: 'INTERNAL_ERROR', message: 'Server error' } };
      mockFetch
        .mockResolvedValueOnce(createMockFetchResponse(serverError, 500, false))
        .mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      const response = await httpClient.get('endpoint');
      
      expect(response.data).toEqual(mockSearchResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should retry on rate limit errors', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockFetchResponse(mockRateLimitError, 429, false))
        .mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      const response = await httpClient.get('endpoint');
      
      expect(response.data).toEqual(mockSearchResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should NOT retry on 400 Bad Request', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockAPIError, 400, false));
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APValidationError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should NOT retry on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockUnauthorizedError, 401, false));
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APAuthenticationError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should NOT retry on 403 Forbidden', async () => {
      const forbiddenError = { error: { code: 'FORBIDDEN', message: 'Access denied' } };
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(forbiddenError, 403, false));
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should NOT retry on 404 Not Found', async () => {
      const notFoundError = { error: { code: 'NOT_FOUND', message: 'Resource not found' } };
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(notFoundError, 404, false));
      
      await expect(httpClient.get('endpoint')).rejects.toThrow(APNotFoundError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should exhaust all retries before failing', async () => {
      const client = new APHttpClient(config, { retries: 2 });
      
      // Mock the sleep method for this client too
      const sleepSpyLocal = jest.spyOn(client as any, 'sleep').mockImplementation(() => Promise.resolve());
      
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await expect(client.get('endpoint')).rejects.toThrow(APNetworkError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      
      sleepSpyLocal.mockRestore();
    });

    test('should calculate exponential backoff delay correctly', async () => {
      const client = new APHttpClient(config, { retries: 2, retryDelay: 100 });
      
      // Mock sleep to capture delay values
      const sleepSpyLocal = jest.spyOn(client as any, 'sleep').mockImplementation(() => Promise.resolve());
      
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await expect(client.get('endpoint')).rejects.toThrow();
      
      // Should be called twice (for 2 retries)
      expect(sleepSpyLocal).toHaveBeenCalledTimes(2);
      
      // First retry delay should be around 100ms (base + jitter)
      const firstDelay = sleepSpyLocal.mock.calls[0][0];
      expect(firstDelay).toBeGreaterThanOrEqual(100);
      expect(firstDelay).toBeLessThan(1200); // base(100) + 2^0*100 + jitter(1000) = ~1200
      
      // Second retry delay should be in valid range (may not be strictly higher due to jitter)
      const secondDelay = sleepSpyLocal.mock.calls[1][0];
      expect(secondDelay).toBeGreaterThanOrEqual(200); // base(100) + 2^1*100 = 200ms minimum
      expect(secondDelay).toBeLessThan(2200); // base(100) + 2^1*100 + jitter(2000) = ~2200
      
      sleepSpyLocal.mockRestore();
    });

    test('should cap retry delay at maximum', () => {
      const client = new APHttpClient(config, { retryDelay: 15000 });
      
      // Test high attempt number
      const delay = (client as any).calculateRetryDelay(10);
      
      // Should be capped at 30000ms
      expect(delay).toBeLessThanOrEqual(30000);
    });
  });

  describe('Timeout Handling', () => {
    test('should timeout requests after specified duration', async () => {
      const client = new APHttpClient(config, { timeout: 100 });
      
      // AbortErrors should not be retried, so just one mock should be enough
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);
      
      const error = await client.get('endpoint').catch(e => e);
      expect(error).toBeInstanceOf(APNetworkError);
      expect(error.message).toContain('Request timeout after 100ms');
    });

    test('should clear timeout on successful response', async () => {
      const client = new APHttpClient(config, { timeout: 1000 });
      
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockSearchResponse));
      
      const response = await client.get('endpoint');
      
      expect(response.data).toEqual(mockSearchResponse);
      // Verify clearTimeout was called on success
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    test('should clear timeout on error response', async () => {
      const client = new APHttpClient(config, { timeout: 1000 });
      
      // Use a 400 error which is NOT retried, so it should be fast
      const badRequestError = createMockFetchResponse(mockAPIError, 400, false);
      mockFetch.mockResolvedValueOnce(badRequestError);
      
      await expect(client.get('endpoint')).rejects.toThrow();
      
      // Verify clearTimeout was called (timeout should be cleared on immediate error)
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Connection Testing', () => {
    test('testConnection should return true for successful connection', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse({ data: { account: 'info' } }));
      
      const result = await httpClient.testConnection();
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ap.org/media/v/account',
        expect.any(Object)
      );
    });

    test('testConnection should return false for authentication error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockUnauthorizedError, 401, false));
      
      const result = await httpClient.testConnection();
      
      expect(result).toBe(false);
    });

    test('testConnection should throw for other errors', async () => {
      const serverError = { error: { code: 'SERVER_ERROR', message: 'Internal server error' } };
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(serverError, 500, false));
      
      await expect(httpClient.testConnection()).rejects.toThrow(APError);
    });

    test('testConnection should throw for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(httpClient.testConnection()).rejects.toThrow(APNetworkError);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle empty response body', async () => {
      const mockResponse = new Response('', {
        status: 200,
        statusText: 'OK'
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      const response = await httpClient.get('endpoint');
      
      expect(response.data).toBe('');
      expect(response.status).toBe(200);
    });

    test('should handle response with no headers', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        statusText: 'OK'
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      const response = await httpClient.get('endpoint');
      
      expect(response.headers).toBeDefined();
      expect(typeof response.headers).toBe('object');
    });

    test('should handle very large responses', async () => {
      const largeData = { items: new Array(10000).fill({ id: 1, text: 'x'.repeat(1000) }) };
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(largeData));
      
      const response = await httpClient.get('endpoint');
      
      expect(response.data.items).toHaveLength(10000);
    });

    test('should handle special characters in URLs and parameters', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchResponse({ data: 'test' }));
      
      await httpClient.get('content/search', {
        q: 'test "quoted" & special chars',
        custom: 'value with spaces & symbols'
      });
      
      const actualUrl = mockFetch.mock.calls[0][0] as string;
      expect(actualUrl).toContain('q=test+%22quoted%22+%26+special+chars');
      expect(actualUrl).toContain('custom=value+with+spaces+%26+symbols');
    });

    test('should normalize header names to lowercase', async () => {
      const headers = new Headers();
      headers.set('X-Custom-Header', 'test-value');
      headers.set('content-type', 'application/json');
      
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      const response = await httpClient.get('endpoint');
      
      expect(response.headers['x-custom-header']).toBe('test-value');
      expect(response.headers['content-type']).toBe('application/json');
    });
  });
});