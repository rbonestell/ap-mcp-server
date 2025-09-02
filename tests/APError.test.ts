/**
 * Tests for AP Error classes and error handling utilities
 * Covers all error types, serialization, and error transformation logic
 */

import {
	APAPIError,
	APAuthenticationError,
	APConfigurationError,
	APError,
	APNetworkError,
	APNotFoundError,
	APRateLimitError,
	APValidationError,
	ErrorHandler,
	isAPError
} from '../src/errors/APError.js';

describe('APError Base Class', () => {
  test('should create basic error with required properties', () => {
    const error = new APError('Test message', 'TEST_CODE');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('APError');
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBeUndefined();
    expect(error.details).toBeUndefined();
    expect(error.stack).toBeDefined();
  });

  test('should create error with optional properties', () => {
    const details = { key: 'value', nested: { data: 123 } };
    const error = new APError('Test message', 'TEST_CODE', 500, details);

    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual(details);
  });

  test('should serialize to JSON correctly', () => {
    const details = { key: 'value' };
    const error = new APError('Test message', 'TEST_CODE', 400, details);

    const json = error.toJSON();
    expect(json).toEqual({
      name: 'APError',
      message: 'Test message',
      code: 'TEST_CODE',
      statusCode: 400,
      details: details,
      suggested_action: 'Review error details and adjust request',
      can_retry: false,
      alternative_tool: undefined,
      stack: error.stack
    });
  });

  test('should maintain proper stack trace', () => {
    const error = new APError('Test message', 'TEST_CODE');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('APError.test.ts');
  });
});

describe('APConfigurationError', () => {
  test('should create configuration error with correct defaults', () => {
    const error = new APConfigurationError('Config missing');

    expect(error).toBeInstanceOf(APError);
    expect(error.name).toBe('APConfigurationError');
    expect(error.message).toBe('Config missing');
    expect(error.code).toBe('CONFIGURATION_ERROR');
    expect(error.statusCode).toBeUndefined();
  });

  test('should create configuration error with details', () => {
    const details = { envVar: 'AP_API_KEY', required: true };
    const error = new APConfigurationError('API key missing', details);

    expect(error.details).toEqual(details);
  });

  test('should be identified as AP error', () => {
    const error = new APConfigurationError('Config error');

    expect(error).toBeValidAPError();
    expect(isAPError(error)).toBe(true);
  });
});

describe('APAPIError', () => {
  test('should create API error with required properties', () => {
    const error = new APAPIError('API failed', 400, 'INVALID_PARAM');

    expect(error).toBeInstanceOf(APError);
    expect(error.name).toBe('APAPIError');
    expect(error.message).toBe('API failed');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('INVALID_PARAM');
    expect(error.originalError).toBeUndefined();
  });

  test('should create API error with original error', () => {
    const originalError = new Error('Network timeout');
    const error = new APAPIError('API failed', 500, 'NETWORK_ERROR', {}, originalError);

    expect(error.originalError).toBe(originalError);
  });

  test('should create API error from AP response', () => {
    const response = {
      error: {
        code: 'INVALID_PARAMETER',
        message: 'The parameter q is required',
        timestamp: '2024-01-15T10:00:00Z',
        item: 'search_request'
      }
    };

    const error = APAPIError.fromAPResponse(response, 400);

    expect(error.name).toBe('APAPIError');
    expect(error.message).toBe('The parameter q is required');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('INVALID_PARAMETER');
    expect(error.details).toEqual({
      timestamp: '2024-01-15T10:00:00Z',
      item: 'search_request',
      response: response
    });
  });

  test('should handle malformed AP response', () => {
    const response = { error: null };
    const error = APAPIError.fromAPResponse(response, 500);

    expect(error.message).toBe('AP API Error');
    expect(error.code).toBe('UNKNOWN_API_ERROR');
    expect(error.statusCode).toBe(500);
  });

  test('should handle empty AP response', () => {
    const error = APAPIError.fromAPResponse({}, 404);

    expect(error.message).toBe('AP API Error');
    expect(error.code).toBe('UNKNOWN_API_ERROR');
    expect(error.statusCode).toBe(404);
  });

  test('should handle non-string error codes', () => {
    const response = {
      error: {
        code: 12345,
        message: 'Numeric error code'
      }
    };

    const error = APAPIError.fromAPResponse(response, 400);
    expect(error.code).toBe('12345');
  });
});

describe('APNetworkError', () => {
  test('should create network error with original error', () => {
    const originalError = new Error('ECONNREFUSED');
    const error = new APNetworkError('Connection refused', originalError);

    expect(error).toBeInstanceOf(APError);
    expect(error.name).toBe('APNetworkError');
    expect(error.message).toBe('Connection refused');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.statusCode).toBeUndefined();
    expect(error.originalError).toBe(originalError);
    expect(error.details).toEqual({
      originalMessage: 'ECONNREFUSED',
      originalName: 'Error'
    });
  });

  test('should preserve original error information', () => {
    const originalError = new TypeError('Failed to fetch');
    originalError.stack = 'Mock stack trace';

    const error = new APNetworkError('Fetch failed', originalError);

    expect(error.details?.originalMessage).toBe('Failed to fetch');
    expect(error.details?.originalName).toBe('TypeError');
  });
});

describe('APValidationError', () => {
  test('should create validation error with defaults', () => {
    const error = new APValidationError('Invalid input');

    expect(error.name).toBe('APValidationError');
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
  });

  test('should create validation error with field and details', () => {
    const error = new APValidationError('Email invalid', 'email', {
      pattern: /^.+@.+\..+$/,
      value: 'invalid-email'
    });

    expect(error.details).toEqual({
      field: 'email',
      pattern: /^.+@.+\..+$/,
      value: 'invalid-email'
    });
  });
});

describe('APAuthenticationError', () => {
  test('should create authentication error with default message', () => {
    const error = new APAuthenticationError();

    expect(error.name).toBe('APAuthenticationError');
    expect(error.message).toBe('Authentication failed');
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.statusCode).toBe(401);
  });

  test('should create authentication error with custom message', () => {
    const error = new APAuthenticationError('Invalid API key');

    expect(error.message).toBe('Invalid API key');
  });
});

describe('APRateLimitError', () => {
  test('should create rate limit error without retry after', () => {
    const error = new APRateLimitError('Rate limit exceeded');

    expect(error.name).toBe('APRateLimitError');
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBeUndefined();
  });

  test('should create rate limit error with retry after', () => {
    const error = new APRateLimitError('Rate limit exceeded', 60);

    expect(error.retryAfter).toBe(60);
    expect(error.details?.retryAfter).toBe(60);
  });
});

describe('APNotFoundError', () => {
  test('should create not found error', () => {
    const error = new APNotFoundError('Resource not found');

    expect(error.name).toBe('APNotFoundError');
    expect(error.message).toBe('Resource not found');
    expect(error.code).toBe('NOT_FOUND_ERROR');
    expect(error.statusCode).toBe(404);
  });

  test('should create not found error with resource', () => {
    const error = new APNotFoundError('Content item not found', 'content_item_123');

    expect(error.details?.resource).toBe('content_item_123');
  });
});

describe('isAPError Type Guard', () => {
  test('should identify AP errors correctly', () => {
    expect(isAPError(new APError('test', 'TEST'))).toBe(true);
    expect(isAPError(new APConfigurationError('test'))).toBe(true);
    expect(isAPError(new APAPIError('test', 400, 'TEST'))).toBe(true);
    expect(isAPError(new APNetworkError('test', new Error()))).toBe(true);
    expect(isAPError(new APValidationError('test'))).toBe(true);
    expect(isAPError(new APAuthenticationError())).toBe(true);
    expect(isAPError(new APRateLimitError('test'))).toBe(true);
    expect(isAPError(new APNotFoundError('test'))).toBe(true);
  });

  test('should reject non-AP errors', () => {
    expect(isAPError(new Error('regular error'))).toBe(false);
    expect(isAPError(new TypeError('type error'))).toBe(false);
    expect(isAPError('string error')).toBe(false);
    expect(isAPError({ message: 'error object' })).toBe(false);
    expect(isAPError(null)).toBe(false);
    expect(isAPError(undefined)).toBe(false);
  });
});

describe('ErrorHandler', () => {
  describe('handleError', () => {
    test('should return AP errors unchanged', () => {
      const originalError = new APConfigurationError('Config error');
      const handled = ErrorHandler.handleError(originalError);

      expect(handled).toBe(originalError);
    });

    test('should convert network-like errors to APNetworkError', () => {
      const timeoutError = new Error('Request timeout');
      const handled = ErrorHandler.handleError(timeoutError) as APNetworkError;

      expect(handled).toBeInstanceOf(APNetworkError);
      expect(handled.message).toBe('Network error: Request timeout');
      expect(handled.originalError).toBe(timeoutError);
    });

    test('should detect various network error patterns', () => {
      const networkErrors = [
        'Connection timeout',
        'ECONNREFUSED connection refused',
        'ENOTFOUND dns lookup failed',
        'fetch request failed'
      ];

      networkErrors.forEach(message => {
        const error = new Error(message);
        const handled = ErrorHandler.handleError(error);

        expect(handled).toBeInstanceOf(APNetworkError);
        expect(handled.message).toContain('Network error:');
      });
    });

    test('should convert generic errors to APError', () => {
      const error = new ReferenceError('Variable not defined');
      const handled = ErrorHandler.handleError(error);

      expect(handled).toBeInstanceOf(APError);
      expect(handled.name).toBe('APError');
      expect(handled.message).toBe('Variable not defined');
      expect(handled.code).toBe('UNKNOWN_ERROR');
      expect(handled.details?.originalName).toBe('ReferenceError');
    });

    test('should handle non-Error values', () => {
      const stringError = 'Something went wrong';
      const handled = ErrorHandler.handleError(stringError);

      expect(handled).toBeInstanceOf(APError);
      expect(handled.message).toBe('Unknown error: Something went wrong');
      expect(handled.code).toBe('UNKNOWN_ERROR');
      expect(handled.details?.originalError).toBe(stringError);
    });

    test('should handle null and undefined', () => {
      expect(ErrorHandler.handleError(null).message).toBe('Unknown error: null');
      expect(ErrorHandler.handleError(undefined).message).toBe('Unknown error: undefined');
    });

    test('should handle objects and arrays', () => {
      const objError = { error: 'Something failed' };
      const handled = ErrorHandler.handleError(objError);

      expect(handled.message).toContain('Unknown error:');
      expect(handled.details?.originalError).toBe(objError);
    });
  });

  describe('handleHttpError', () => {
    const createMockResponse = (status: number, statusText = 'Test Status', headers?: Record<string, string>) => {
      const response = {
        status,
        statusText,
        headers: {
          get: (name: string) => headers?.[name] || null
        }
      } as Response;
      return response;
    };

    test('should handle 400 Bad Request', () => {
      const response = createMockResponse(400, 'Bad Request');
      const body = {
        error: {
          message: 'Missing required parameter',
          field: 'query'
        }
      };

      const error = ErrorHandler.handleHttpError(response, body);

      expect(error).toBeInstanceOf(APValidationError);
      expect(error.message).toBe('Missing required parameter');
      expect(error.statusCode).toBe(400);
    });

    test('should handle 401 Unauthorized', () => {
      const response = createMockResponse(401, 'Unauthorized');
      const body = { error: { message: 'Invalid API key' } };

      const error = ErrorHandler.handleHttpError(response, body);

      expect(error).toBeInstanceOf(APAuthenticationError);
      expect(error.message).toBe('Invalid API key');
      expect(error.statusCode).toBe(401);
    });

    test('should handle 403 Forbidden', () => {
      const response = createMockResponse(403, 'Forbidden');
      const body = { error: { message: 'Access denied to resource' } };

      const error = ErrorHandler.handleHttpError(response, body);

      expect(error).toBeInstanceOf(APError);
      expect(error.code).toBe('FORBIDDEN_ERROR');
      expect(error.message).toBe('Access denied to resource');
      expect(error.statusCode).toBe(403);
    });

    test('should handle 404 Not Found', () => {
      const response = createMockResponse(404, 'Not Found');
      const body = { error: { message: 'Content item not found' } };

      const error = ErrorHandler.handleHttpError(response, body);

      expect(error).toBeInstanceOf(APNotFoundError);
      expect(error.message).toBe('Content item not found');
      expect(error.statusCode).toBe(404);
    });

    test('should handle 429 Rate Limit with retry-after header', () => {
      const response = createMockResponse(429, 'Too Many Requests', { 'retry-after': '120' });
      const body = { error: { message: 'Rate limit exceeded' } };

      const error = ErrorHandler.handleHttpError(response, body);

      expect(error).toBeInstanceOf(APRateLimitError);
      expect(error.message).toBe('Rate limit exceeded');
      expect((error as APRateLimitError).retryAfter).toBe(120);
    });

    test('should handle 429 Rate Limit without retry-after header', () => {
      const response = createMockResponse(429, 'Too Many Requests');

      const error = ErrorHandler.handleHttpError(response);

      expect(error).toBeInstanceOf(APRateLimitError);
      expect((error as APRateLimitError).retryAfter).toBeUndefined();
    });

    test('should handle server errors (5xx)', () => {
      const serverErrors = [500, 502, 503, 504];

      serverErrors.forEach(status => {
        const response = createMockResponse(status, 'Server Error');
        const body = { error: { message: 'Internal server error' } };

        const error = ErrorHandler.handleHttpError(response, body);

        expect(error).toBeInstanceOf(APError);
        expect(error.code).toBe('SERVER_ERROR');
        expect(error.statusCode).toBe(status);
      });
    });

    test('should handle unknown status codes', () => {
      const response = createMockResponse(418, "I'm a teapot");
      const body = { error: { message: 'Teapot cannot brew coffee', code: 'TEAPOT_ERROR' } };

      const error = ErrorHandler.handleHttpError(response, body);

      expect(error).toBeInstanceOf(APAPIError);
      expect(error.message).toBe('Teapot cannot brew coffee');
      expect(error.code).toBe('TEAPOT_ERROR');
      expect(error.statusCode).toBe(418);
    });

    test('should handle responses without error body', () => {
      const response = createMockResponse(400, 'Bad Request');

      const error = ErrorHandler.handleHttpError(response);

      expect(error).toBeInstanceOf(APAPIError);
      expect(error.message).toBe('Bad Request: Bad Request');
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.statusCode).toBe(400);
    });

    test('should handle malformed error body', () => {
      const response = createMockResponse(500, 'Internal Server Error');
      const body = 'Not JSON';

      const error = ErrorHandler.handleHttpError(response, body);

      expect(error).toBeInstanceOf(APError);
      expect(error.code).toBe('SERVER_ERROR');
      expect(error.message).toBe('Server error: Internal Server Error');
    });
  });
});

describe('Error Inheritance and Polymorphism', () => {
  test('all error classes should be instances of Error and APError', () => {
    const errors = [
      new APError('test', 'TEST'),
      new APConfigurationError('test'),
      new APAPIError('test', 400, 'TEST'),
      new APNetworkError('test', new Error()),
      new APValidationError('test'),
      new APAuthenticationError(),
      new APRateLimitError('test'),
      new APNotFoundError('test')
    ];

    errors.forEach(error => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(APError);
      expect(isAPError(error)).toBe(true);
    });
  });

  test('should maintain correct prototype chain', () => {
    const apiError = new APAPIError('test', 400, 'TEST');

    expect(apiError.constructor.name).toBe('APAPIError');
    expect(Object.getPrototypeOf(apiError).constructor.name).toBe('APAPIError');
    expect(Object.getPrototypeOf(Object.getPrototypeOf(apiError)).constructor.name).toBe('APError');
  });

  test('should serialize all error types correctly', () => {
    const errors = [
      new APConfigurationError('config error', { key: 'value' }),
      new APAPIError('api error', 400, 'TEST_CODE', { detail: 'info' }),
      new APNetworkError('network error', new Error('original')),
    ];

    errors.forEach(error => {
      const json = error.toJSON();

      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('stack');
      expect(typeof json.name).toBe('string');
      expect(typeof json.message).toBe('string');
      expect(typeof json.code).toBe('string');
    });
  });
});
