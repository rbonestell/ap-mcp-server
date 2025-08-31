import { APHttpClient } from '../http/APHttpClient.js';
import {
  AccountResponse,
  AccountPlansResponse,
  AccountDownloadsResponse,
  AccountQuotasResponse,
  DownloadsParams,
} from '../types/api.types.js';
import { APValidationError, APError } from '../errors/APError.js';

/**
 * Service for AP Account API operations
 */
export class AccountService {
  constructor(private readonly httpClient: APHttpClient) {}

  /**
   * Get account information and available endpoints
   * @returns Account information
   */
  async getAccountInfo(): Promise<AccountResponse> {
    try {
      const response = await this.httpClient.get<AccountResponse>('account');
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getAccountInfo', error);
    }
  }

  /**
   * Get account plans and entitlements
   * @param options Optional parameters
   * @returns Account plans and meters information
   */
  async getAccountPlans(options: {
    include?: string[];
    exclude?: string[];
    format?: 'json' | 'csv';
  } = {}): Promise<AccountPlansResponse> {
    this.validatePlanParams(options);

    try {
      const response = await this.httpClient.get<AccountPlansResponse>('account/plans', options);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getAccountPlans', error, options);
    }
  }

  /**
   * Get account download history
   * @param params Download history parameters
   * @returns Download history
   */
  async getAccountDownloads(params: DownloadsParams = {}): Promise<AccountDownloadsResponse> {
    this.validateDownloadParams(params);

    try {
      const response = await this.httpClient.get<AccountDownloadsResponse>('account/downloads', params);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getAccountDownloads', error, params);
    }
  }

  /**
   * Get account API quotas and limits
   * @returns Account quotas information
   */
  async getAccountQuotas(): Promise<AccountQuotasResponse> {
    try {
      const response = await this.httpClient.get<AccountQuotasResponse>('account/quotas');
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getAccountQuotas', error);
    }
  }

  /**
   * Get followed topics
   * @param options Optional parameters
   * @returns Followed topics information
   */
  async getFollowedTopics(options: {
    format?: 'json' | 'csv';
    include?: string[];
  } = {}): Promise<any> {
    this.validateFollowedTopicsParams(options);

    try {
      const response = await this.httpClient.get('account/followedtopics', options);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getFollowedTopics', error, options);
    }
  }

  /**
   * Validate plan parameters
   */
  private validatePlanParams(options: any): void {
    if (options.include && !Array.isArray(options.include)) {
      throw new APValidationError('Include must be an array of strings', 'include', { include: options.include });
    }

    if (options.exclude && !Array.isArray(options.exclude)) {
      throw new APValidationError('Exclude must be an array of strings', 'exclude', { exclude: options.exclude });
    }

    if (options.format && !['json', 'csv'].includes(options.format)) {
      throw new APValidationError('Format must be "json" or "csv"', 'format', { format: options.format });
    }
  }

  /**
   * Validate download parameters
   */
  private validateDownloadParams(params: DownloadsParams): void {
    if (params.include && !Array.isArray(params.include)) {
      throw new APValidationError('Include must be an array of strings', 'include', { include: params.include });
    }

    if (params.exclude && !Array.isArray(params.exclude)) {
      throw new APValidationError('Exclude must be an array of strings', 'exclude', { exclude: params.exclude });
    }

    if (params.format && !['json', 'csv'].includes(params.format)) {
      throw new APValidationError('Format must be "json" or "csv"', 'format', { format: params.format });
    }

    if (params.min_date && !this.isValidDateString(params.min_date)) {
      throw new APValidationError(
        'min_date must be in format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss',
        'min_date',
        { min_date: params.min_date }
      );
    }

    if (params.max_date && !this.isValidDateString(params.max_date)) {
      throw new APValidationError(
        'max_date must be in format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss',
        'max_date',
        { max_date: params.max_date }
      );
    }

    if (params.order && (!Number.isInteger(params.order) || params.order <= 0)) {
      throw new APValidationError('Order must be a positive integer', 'order', { order: params.order });
    }

    // Validate date range
    if (params.min_date && params.max_date) {
      const minDate = new Date(params.min_date);
      const maxDate = new Date(params.max_date);
      const daysDiff = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 60) {
        throw new APValidationError(
          'Date range cannot exceed 60 days',
          'date_range',
          { min_date: params.min_date, max_date: params.max_date, days: daysDiff }
        );
      }

      if (daysDiff < 0) {
        throw new APValidationError(
          'min_date must be before max_date',
          'date_range',
          { min_date: params.min_date, max_date: params.max_date }
        );
      }
    }
  }

  /**
   * Validate followed topics parameters
   */
  private validateFollowedTopicsParams(options: any): void {
    if (options.format && !['json', 'csv'].includes(options.format)) {
      throw new APValidationError('Format must be "json" or "csv"', 'format', { format: options.format });
    }

    if (options.include && !Array.isArray(options.include)) {
      throw new APValidationError('Include must be an array of strings', 'include', { include: options.include });
    }
  }

  /**
   * Check if date string is valid
   */
  private isValidDateString(dateString: string): boolean {
    // Check for YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return !isNaN(Date.parse(dateString));
    }
    
    // Check for YYYY-MM-DDTHH:mm:ss format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateString)) {
      return !isNaN(Date.parse(dateString));
    }

    // Check for ISO-8601 Duration format (relative dates)
    if (/^P\d+[YMWD]$/.test(dateString) || /^PT\d+[HMS]$/.test(dateString)) {
      return true;
    }

    return false;
  }

  /**
   * Handle service errors with context
   */
  private handleServiceError(operation: string, error: unknown, context?: any): APError {
    if (error instanceof APError) {
      // Add operation context to existing AP errors
      const newDetails = {
        ...error.details,
        operation,
        context,
      };
      return new APError(error.message, error.code, error.statusCode, newDetails);
    }

    // Create new error with context
    return new APError(
      `AccountService.${operation} failed: ${error}`,
      'ACCOUNT_SERVICE_ERROR',
      undefined,
      { operation, context, originalError: error }
    );
  }

  /**
   * Extract plan summary for display
   */
  static extractPlanSummary(plansResponse: AccountPlansResponse): {
    totalPlans: number;
    activePlans: Array<{
      id: number;
      name: string;
      used: number;
      limit: number;
      usagePercent: number;
      nextCycle?: string;
    }>;
    totalEntitlements: number;
  } {
    const plans = plansResponse.data.plans || [];
    
    return {
      totalPlans: plans.length,
      activePlans: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        used: plan.used,
        limit: plan.usage_limit,
        usagePercent: plan.usage_limit > 0 ? Math.round((plan.used / plan.usage_limit) * 100) : 0,
        nextCycle: plan.next_cycle_begins,
      })),
      totalEntitlements: plans.reduce((total, plan) => total + (plan.entitlements?.length || 0), 0),
    };
  }

  /**
   * Extract download summary for display
   */
  static extractDownloadSummary(downloadsResponse: AccountDownloadsResponse): {
    totalDownloads: number;
    currentItems: number;
    dateRange: {
      min: string;
      max: string;
    };
    mediaTypes: Record<string, number>;
    totalCost: number;
    currency: string | undefined;
  } {
    const data = downloadsResponse.data;
    const downloads = data.downloads || [];
    
    const mediaTypes: Record<string, number> = {};
    let totalCost = 0;
    let currency: string | undefined;

    downloads.forEach(download => {
      const type = download.item.type;
      mediaTypes[type] = (mediaTypes[type] || 0) + 1;
      totalCost += download.charge || 0;
      
      if (!currency && download.currency) {
        currency = download.currency;
      }
    });

    return {
      totalDownloads: data.total_items,
      currentItems: data.current_item_count,
      dateRange: {
        min: data.min_date,
        max: data.max_date,
      },
      mediaTypes,
      totalCost,
      currency: currency,
    };
  }

  /**
   * Extract quota summary for display
   */
  static extractQuotaSummary(quotasResponse: AccountQuotasResponse): {
    account: string;
    updated: string;
    quotas: Array<{
      method: string;
      limit: number;
      period: string;
    }>;
  } {
    const data = quotasResponse.data;
    
    return {
      account: data.account,
      updated: data.updated,
      quotas: data.quotas || [],
    };
  }
}