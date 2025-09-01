import { APConfigManager } from '../config/APConfig.js';
import { APError, APNetworkError, APRateLimitError, ErrorHandler, isAPError } from '../errors/APError.js';

/**
 * HTTP client options
 */
export interface HttpClientOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Request options for cancellation support
 */
export interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * HTTP response wrapper
 */
export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  rateLimit?: {
    remaining: number;
    reset: number;
    limit: number;
    retry_after?: number;
  };
}

/**
 * HTTP client for AP API requests
 */
export class APHttpClient {
  private readonly config: APConfigManager;
  private readonly options: Required<HttpClientOptions>;

  constructor(config: APConfigManager, options: HttpClientOptions = {}) {
    this.config = config;
    this.options = {
      timeout: options.timeout ?? config.get('timeout')!,
      retries: options.retries ?? config.get('retries')!,
      retryDelay: options.retryDelay ?? 1000,
    };
  }

  /**
   * Execute a GET request with retry logic
   */
  async get<T = any>(
    endpoint: string, 
    params?: Record<string, any>,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrlWithParams(endpoint, params);
    return this.executeWithRetry(() => this.executeRequest('GET', url, undefined, options?.signal));
  }

  /**
   * Execute a POST request with retry logic
   */
  async post<T = any>(
    endpoint: string, 
    body?: any, 
    params?: Record<string, any>,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrlWithParams(endpoint, params);
    return this.executeWithRetry(() => this.executeRequest('POST', url, body, options?.signal));
  }

  /**
   * Execute a PUT request with retry logic
   */
  async put<T = any>(
    endpoint: string, 
    body?: any, 
    params?: Record<string, any>,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrlWithParams(endpoint, params);
    return this.executeWithRetry(() => this.executeRequest('PUT', url, body, options?.signal));
  }

  /**
   * Execute a DELETE request with retry logic
   */
  async delete<T = any>(
    endpoint: string, 
    params?: Record<string, any>,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrlWithParams(endpoint, params);
    return this.executeWithRetry(() => this.executeRequest('DELETE', url, undefined, options?.signal));
  }

  /**
   * Extract rate limit information from response headers
   */
  private extractRateLimitInfo(headers: Record<string, string>): HttpResponse['rateLimit'] | undefined {
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
   * Combine multiple abort signals into one
   * Aborts when any of the provided signals abort
   */
  private combineSignals(timeoutSignal: AbortSignal, externalSignal?: AbortSignal): AbortSignal {
    if (!externalSignal) {
      return timeoutSignal;
    }

    const controller = new AbortController();
    
    // Abort if timeout occurs
    const handleTimeout = () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };
    
    // Abort if external signal aborts
    const handleExternal = () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };

    // Set up listeners
    timeoutSignal.addEventListener('abort', handleTimeout, { once: true });
    externalSignal.addEventListener('abort', handleExternal, { once: true });

    // Check if either signal is already aborted
    if (timeoutSignal.aborted || externalSignal.aborted) {
      controller.abort();
    }

    return controller.signal;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrlWithParams(endpoint: string, params?: Record<string, any>): string {
    const baseUrl = this.config.buildUrl(endpoint);

    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          searchParams.append(key, value.join(','));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    return `${baseUrl}?${searchParams.toString()}`;
  }

  /**
   * Execute HTTP request with timeout and cancellation support
   */
  private async executeRequest(
    method: string,
    url: string,
    body?: any,
    externalSignal?: AbortSignal
  ): Promise<HttpResponse> {
    // Create a controller for timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), this.options.timeout);

    // Combine external signal with timeout signal
    const combinedSignal = this.combineSignals(timeoutController.signal, externalSignal);

    try {
      const requestInit: RequestInit = {
        method,
        headers: this.config.getHttpHeaders(),
        signal: combinedSignal,
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        requestInit.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, requestInit);

      // Clear timeout since request completed
      clearTimeout(timeoutId);


      return await this.processResponse(response);
    } catch (error) {
      clearTimeout(timeoutId);

      // Check if this is a network error
      if (error instanceof Error && error.name === 'AbortError') {
        // Check if it was cancelled externally or timed out
        if (externalSignal?.aborted) {
          throw new APNetworkError('Request cancelled by client', error);
        } else {
          throw new APNetworkError(`Request timeout after ${this.options.timeout}ms`, error);
        }
      }

      // Check if this is an HTTP error thrown from processResponse
      if (error instanceof APError) {
        throw error;
      }

      // Check for fetch errors in a safe way
      if (error instanceof Error) {
        try {
          const message = String(error.message || error);
          if (message.includes('fetch') || message.includes('Failed to fetch') || message.includes('Network error')) {
            throw new APNetworkError(`Network request failed: ${message}`, error);
          }
        } catch (msgError) {
          // If we can't check the message safely, but it's an Error instance from fetch, treat as network error
          throw new APNetworkError('Network request failed', error);
        }
      }

      throw ErrorHandler.handleError(error);
    }
  }

  /**
   * Process the HTTP response
   */
  private async processResponse(response: Response): Promise<HttpResponse> {
    // Safeguard for null or undefined response
    if (!response) {
      throw new APError('Invalid response object', 'HTTP_ERROR', undefined, {});
    }

    const headers: Record<string, string> = {};
    try {
      if (response.headers && response.headers.forEach) {
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
      }
    } catch (headerError) {
      // Headers access failed, continue with empty headers
    }

    let data: any;
    let contentType = '';
    try {
      contentType = (response && response.headers && response.headers.get)
        ? response.headers.get('content-type') || ''
        : '';
    } catch (headerError) {
      // Content-type access failed, use empty string
      contentType = '';
    }

    if (contentType.includes('application/json')) {
      // For JSON, read as text first then try to parse
      try {
        const textData = await response.text();
        try {
          data = JSON.parse(textData);
        } catch (parseError) {
          const isOk = response && response.ok !== false;
          if (!isOk) {
            // For error responses with malformed JSON, pass the raw text as the error message
            const errorBody = { error: { message: textData || 'Malformed JSON response' } };
            throw ErrorHandler.handleHttpError(response, errorBody);
          }
          // If response is ok but can't parse JSON, return raw text
          data = textData;
        }
      } catch (textError) {
        // Check if this is already an AP error from the inner try/catch
        if (textError instanceof APError) {
          throw textError;
        }
        // Only create a new error if textError is not already handled
        const isOk = response && response.ok !== false;
        if (!isOk) {
          throw ErrorHandler.handleHttpError(response);
        }
        data = 'Unable to read response';
      }
    } else {
      // For non-JSON, just get as text
      try {
        data = await response.text();
      } catch (textError) {
        data = 'Unable to read response';
      }
    }

    // Handle error responses
    if (!response || response.ok === false) {
      // Ensure response is valid before passing to error handler
      if (!response) {
        throw new APError('Invalid response object', 'HTTP_ERROR', undefined, { data });
      }
      throw ErrorHandler.handleHttpError(response, data);
    }

    // Extract rate limit information
    const rateLimit = this.extractRateLimitInfo(headers);

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers,
      rateLimit,
    };
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<HttpResponse<T>>
  ): Promise<HttpResponse<T>> {
    let lastError: APError;

    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = ErrorHandler.handleError(error);

        // Don't retry on certain error types
        if (this.shouldNotRetry(lastError) || attempt === this.options.retries) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Determine if error should not be retried
   */
  private shouldNotRetry(error: APError): boolean {
    // Don't retry authentication errors
    if (error.statusCode === 401) {
      return true;
    }

    // Don't retry validation errors
    if (error.statusCode === 400) {
      return true;
    }

    // Don't retry forbidden
    if (error.statusCode === 403) {
      return true;
    }

    // Don't retry not found
    if (error.statusCode === 404) {
      return true;
    }

    // Do retry rate limits (but handle specially)
    if (error instanceof APRateLimitError) {
      return false;
    }

    // Don't retry timeout/abort errors
    if (error instanceof APNetworkError && error.message.includes('timeout')) {
      return true;
    }

    // Retry network errors and server errors
    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    // Base delay multiplied by 2^attempt, with some jitter
    const exponentialDelay = this.options.retryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // 0-1000ms jitter
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get configuration summary
   */
  public getConfig(): Readonly<HttpClientOptions & { baseUrl: string }> {
    return {
      ...this.options,
      baseUrl: this.config.get('baseUrl')!,
    };
  }

  /**
   * Test connectivity to AP API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.get('account');
      return true;
    } catch (error) {
      if (isAPError(error) && error.statusCode === 401) {
        // Authentication error means connection works but credentials are wrong
        return false;
      }
      throw error;
    }
  }
}
