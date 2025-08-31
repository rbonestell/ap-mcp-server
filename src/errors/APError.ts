/**
 * Base error class for AP MCP Server errors
 */
export class APError extends Error {
  public readonly code: string;
  public readonly statusCode: number | undefined;
  public readonly details: Record<string, any> | undefined;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'APError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace for where our error was thrown
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, APError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Configuration-related errors
 */
export class APConfigurationError extends APError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFIGURATION_ERROR', undefined, details);
    this.name = 'APConfigurationError';
  }
}

/**
 * API-related errors from AP endpoints
 */
export class APAPIError extends APError {
  public readonly originalError: Error | undefined;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, statusCode, details);
    this.name = 'APAPIError';
    this.originalError = originalError;
  }

  static fromAPResponse(response: any, statusCode: number): APAPIError {
    const error = response?.error || {};
    return new APAPIError(
      error.message || 'AP API Error',
      statusCode,
      error.code?.toString() || 'UNKNOWN_API_ERROR',
      {
        timestamp: error.timestamp,
        item: error.item,
        response: response,
      }
    );
  }
}

/**
 * Network-related errors (timeouts, connection issues, etc.)
 */
export class APNetworkError extends APError {
  public readonly originalError: Error;

  constructor(message: string, originalError: Error) {
    super(message, 'NETWORK_ERROR', undefined, {
      originalMessage: originalError.message,
      originalName: originalError.name,
    });
    this.name = 'APNetworkError';
    this.originalError = originalError;
  }
}

/**
 * Validation errors for input parameters
 */
export class APValidationError extends APError {
  constructor(message: string, field?: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, {
      field,
      ...details,
    });
    this.name = 'APValidationError';
  }
}

/**
 * Authentication errors
 */
export class APAuthenticationError extends APError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'APAuthenticationError';
  }
}

/**
 * Rate limiting errors
 */
export class APRateLimitError extends APError {
  public readonly retryAfter: number | undefined;

  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429, { retryAfter });
    this.name = 'APRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Not found errors
 */
export class APNotFoundError extends APError {
  constructor(message: string, resource?: string) {
    super(message, 'NOT_FOUND_ERROR', 404, { resource });
    this.name = 'APNotFoundError';
  }
}

/**
 * Type guard to check if error is an AP error
 */
export function isAPError(error: any): error is APError {
  return error instanceof APError;
}

/**
 * Error handler utility to transform various errors into AP errors
 */
export class ErrorHandler {
  static handleError(error: unknown): APError {
    // Already an AP error
    if (isAPError(error)) {
      return error;
    }

    // Standard Error
    if (error instanceof Error) {
      // Network-like errors
      if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED') || 
          error.message.includes('ENOTFOUND') || error.message.includes('fetch')) {
        return new APNetworkError(`Network error: ${error.message}`, error);
      }

      // Generic error fallback
      return new APError(error.message, 'UNKNOWN_ERROR', undefined, {
        originalName: error.name,
        originalStack: error.stack,
      });
    }

    // Unknown error type
    return new APError(
      `Unknown error: ${String(error)}`,
      'UNKNOWN_ERROR',
      undefined,
      { originalError: error }
    );
  }

  /**
   * Transform HTTP response errors into appropriate AP errors
   */
  static handleHttpError(response: Response, body?: any): APError {
    const statusCode = response.status;
    const statusText = response.statusText;

    switch (statusCode) {
      case 400:
        return new APValidationError(
          body?.error?.message || `Bad Request: ${statusText}`,
          undefined,
          { response: body }
        );
      
      case 401:
        return new APAuthenticationError(
          body?.error?.message || `Authentication failed: ${statusText}`
        );
      
      case 403:
        return new APError(
          body?.error?.message || `Forbidden: ${statusText}`,
          'FORBIDDEN_ERROR',
          403,
          { response: body }
        );
      
      case 404:
        return new APNotFoundError(
          body?.error?.message || `Not found: ${statusText}`
        );
      
      case 429:
        const retryAfter = response.headers.get('retry-after');
        return new APRateLimitError(
          body?.error?.message || `Rate limit exceeded: ${statusText}`,
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );
      
      case 500:
      case 502:
      case 503:
      case 504:
        return new APError(
          body?.error?.message || `Server error: ${statusText}`,
          'SERVER_ERROR',
          statusCode,
          { response: body }
        );
      
      default:
        return new APAPIError(
          body?.error?.message || `HTTP ${statusCode}: ${statusText}`,
          statusCode,
          body?.error?.code?.toString() || 'HTTP_ERROR',
          { response: body }
        );
    }
  }
}