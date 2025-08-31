import { APConfig } from '../types/api.types.js';
import { APConfigurationError } from '../errors/APError.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  baseUrl: 'https://api.ap.org/media/v',
  timeout: 30000, // 30 seconds
  retries: 3,
} as const;

/**
 * Configuration manager for AP MCP Server
 */
export class APConfigManager {
  private config: APConfig;

  constructor(overrides: Partial<APConfig> = {}) {
    this.config = this.loadConfiguration(overrides);
    this.validateConfiguration();
  }

  /**
   * Load configuration from environment variables and overrides
   */
  private loadConfiguration(overrides: Partial<APConfig>): APConfig {
    const apiKey = overrides.apiKey || process.env.AP_API_KEY;
    
    if (!apiKey) {
      throw new APConfigurationError(
        'AP API key is required. Set AP_API_KEY environment variable or provide apiKey in configuration.',
        { 
          envVar: 'AP_API_KEY',
          providedOverrides: Object.keys(overrides) 
        }
      );
    }

    return {
      apiKey,
      baseUrl: overrides.baseUrl || process.env.AP_BASE_URL || DEFAULT_CONFIG.baseUrl,
      timeout: overrides.timeout || 
        (process.env.AP_TIMEOUT ? parseInt(process.env.AP_TIMEOUT, 10) : DEFAULT_CONFIG.timeout),
      retries: overrides.retries || 
        (process.env.AP_RETRIES ? parseInt(process.env.AP_RETRIES, 10) : DEFAULT_CONFIG.retries),
    };
  }

  /**
   * Validate the loaded configuration
   */
  private validateConfiguration(): void {
    const { apiKey, baseUrl, timeout, retries } = this.config;

    // Validate API key format
    if (!apiKey.trim()) {
      throw new APConfigurationError('API key cannot be empty');
    }

    // Validate base URL format
    if (!baseUrl || !this.isValidUrl(baseUrl)) {
      throw new APConfigurationError(
        `Invalid base URL: ${baseUrl}. Must be a valid HTTP/HTTPS URL.`,
        { baseUrl }
      );
    }

    // Validate timeout
    if (timeout !== undefined && (timeout < 1000 || timeout > 300000)) {
      throw new APConfigurationError(
        `Timeout must be between 1000ms and 300000ms (5 minutes). Got: ${timeout}ms`,
        { timeout }
      );
    }

    // Validate retries
    if (retries !== undefined && (retries < 0 || retries > 10)) {
      throw new APConfigurationError(
        `Retries must be between 0 and 10. Got: ${retries}`,
        { retries }
      );
    }
  }

  /**
   * Check if a string is a valid URL
   */
  private isValidUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Get the current configuration
   */
  public getConfig(): Readonly<APConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get a specific configuration value
   */
  public get<K extends keyof APConfig>(key: K): APConfig[K] {
    return this.config[key];
  }

  /**
   * Update configuration (creates new instance)
   */
  public updateConfig(updates: Partial<APConfig>): APConfigManager {
    return new APConfigManager({ ...this.config, ...updates });
  }

  /**
   * Get HTTP headers for AP API requests
   */
  public getHttpHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'AP-MCP-Server/1.0.0',
    };
  }

  /**
   * Build full URL for AP API endpoint
   */
  public buildUrl(endpoint: string): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // Ensure base URL doesn't end with slash
    const baseUrl = this.config.baseUrl!.replace(/\/$/, '');
    
    return `${baseUrl}/${cleanEndpoint}`;
  }

  /**
   * Create configuration from environment
   */
  static fromEnvironment(): APConfigManager {
    return new APConfigManager();
  }

  /**
   * Create configuration with custom values
   */
  static create(config: APConfig): APConfigManager {
    return new APConfigManager(config);
  }

  /**
   * Get configuration summary for logging (without sensitive data)
   */
  public getSummary(): Record<string, any> {
    return {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      retries: this.config.retries,
      hasApiKey: !!this.config.apiKey,
      apiKeyLength: this.config.apiKey?.length || 0,
    };
  }
}