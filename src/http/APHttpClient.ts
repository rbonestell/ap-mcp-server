import { APConfigManager } from '../config/APConfig.js';
import { APNetworkError, APRateLimitError, ErrorHandler, isAPError, APError } from '../errors/APError.js';

/**
 * HTTP client options
 */
export interface HttpClientOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * HTTP response wrapper
 */
export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
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
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<HttpResponse<T>> {
    const url = this.buildUrlWithParams(endpoint, params);
    return this.executeWithRetry(() => this.executeRequest('GET', url));
  }

  /**
   * Execute a POST request with retry logic
   */
  async post<T = any>(endpoint: string, body?: any, params?: Record<string, any>): Promise<HttpResponse<T>> {
    const url = this.buildUrlWithParams(endpoint, params);
    return this.executeWithRetry(() => this.executeRequest('POST', url, body));
  }

  /**
   * Execute a PUT request with retry logic
   */
  async put<T = any>(endpoint: string, body?: any, params?: Record<string, any>): Promise<HttpResponse<T>> {
    const url = this.buildUrlWithParams(endpoint, params);
    return this.executeWithRetry(() => this.executeRequest('PUT', url, body));
  }

  /**
   * Execute a DELETE request with retry logic
   */
  async delete<T = any>(endpoint: string, params?: Record<string, any>): Promise<HttpResponse<T>> {
    const url = this.buildUrlWithParams(endpoint, params);
    return this.executeWithRetry(() => this.executeRequest('DELETE', url));
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
   * Execute HTTP request with timeout
   */
  private async executeRequest(
    method: string,
    url: string,
    body?: any
  ): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const requestInit: RequestInit = {
        method,
        headers: this.config.getHttpHeaders(),
        signal: controller.signal,
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
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new APNetworkError(`Request timeout after ${this.options.timeout}ms`, error);
        }
        if (error.message.includes('fetch')) {
          throw new APNetworkError(`Network request failed: ${error.message}`, error);
        }
      }
      
      throw ErrorHandler.handleError(error);
    }
  }

  /**
   * Process the HTTP response
   */
  private async processResponse(response: Response): Promise<HttpResponse> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let data: any;
    const contentType = response.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
        data = await response.text();
      } else {
        data = await response.text();
      }
    } catch (parseError) {
      if (!response.ok) {
        throw ErrorHandler.handleHttpError(response);
      }
      // If response is ok but can't parse, return raw text
      data = await response.text();
    }

    // Handle error responses
    if (!response.ok) {
      throw ErrorHandler.handleHttpError(response, data);
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers,
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