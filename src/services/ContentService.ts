import { APHttpClient } from '../http/APHttpClient.js';
import {
  ContentResponse,
  SearchResponse,
  FeedResponse,
  RSSResponse,
  SearchParams,
  FeedParams,
  ItemParams,
  RSSParams,
} from '../types/api.types.js';
import { APValidationError, APError } from '../errors/APError.js';

/**
 * Service for AP Content API operations
 */
export class ContentService {
  constructor(private readonly httpClient: APHttpClient) {}

  /**
   * Search for AP content
   * @param params Search parameters
   * @returns Search response with paginated content items
   */
  async searchContent(params: SearchParams = {}): Promise<SearchResponse> {
    this.validateSearchParams(params);

    try {
      const response = await this.httpClient.get<SearchResponse>('content/search', params);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('searchContent', error, params);
    }
  }

  /**
   * Get a specific content item by ID
   * @param itemId The item ID to retrieve
   * @param params Optional parameters
   * @returns Content item details
   */
  async getContentItem(itemId: string, params: ItemParams = {}): Promise<ContentResponse> {
    if (!itemId || typeof itemId !== 'string') {
      throw new APValidationError('Item ID is required and must be a string', 'itemId', { itemId });
    }

    this.validateItemParams(params);

    try {
      const response = await this.httpClient.get<ContentResponse>(`content/${encodeURIComponent(itemId)}`, params);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getContentItem', error, { itemId, ...params });
    }
  }

  /**
   * Get a feed of incoming AP content
   * @param params Feed parameters
   * @returns Feed response with content items
   */
  async getContentFeed(params: FeedParams = {}): Promise<FeedResponse> {
    this.validateFeedParams(params);

    try {
      const response = await this.httpClient.get<FeedResponse>('content/feed', params);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getContentFeed', error, params);
    }
  }

  /**
   * Get list of available RSS feeds
   * @returns RSS response with available feeds
   */
  async getRSSFeeds(): Promise<RSSResponse> {
    try {
      const response = await this.httpClient.get<RSSResponse>('content/rss');
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getRSSFeeds', error);
    }
  }

  /**
   * Get a specific RSS feed by ID
   * @param rssId The RSS feed ID
   * @param params Optional parameters
   * @returns RSS feed content
   */
  async getRSSFeed(rssId: number, params: RSSParams = {}): Promise<string> {
    if (!Number.isInteger(rssId) || rssId <= 0) {
      throw new APValidationError('RSS ID must be a positive integer', 'rssId', { rssId });
    }

    this.validateRSSParams(params);

    try {
      const response = await this.httpClient.get(`content/rss/${rssId}`, params);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getRSSFeed', error, { rssId, ...params });
    }
  }

  /**
   * Get OnDemand content queue
   * @param params Optional parameters
   * @returns Feed response with OnDemand content
   */
  async getOnDemandContent(params: {
    consumer_id?: string;
    queue?: string;
    include?: string[];
    exclude?: string[];
    page_size?: number;
    pricing?: boolean;
    session_label?: string;
  } = {}): Promise<FeedResponse> {
    this.validateOnDemandParams(params);

    try {
      const response = await this.httpClient.get<FeedResponse>('content/ondemand', params);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getOnDemandContent', error, params);
    }
  }

  /**
   * Validate search parameters
   */
  private validateSearchParams(params: SearchParams): void {
    if (params.page && !/^\d+$/.test(params.page)) {
      throw new APValidationError('Page must be a numeric string', 'page', { page: params.page });
    }

    if (params.page_size !== undefined && (params.page_size < 1 || params.page_size > 100)) {
      throw new APValidationError('Page size must be between 1 and 100', 'page_size', { page_size: params.page_size });
    }

    if (params.include && !Array.isArray(params.include)) {
      throw new APValidationError('Include must be an array of strings', 'include', { include: params.include });
    }

    if (params.exclude && !Array.isArray(params.exclude)) {
      throw new APValidationError('Exclude must be an array of strings', 'exclude', { exclude: params.exclude });
    }
  }

  /**
   * Validate item parameters
   */
  private validateItemParams(params: ItemParams): void {
    if (params.include && !Array.isArray(params.include)) {
      throw new APValidationError('Include must be an array of strings', 'include', { include: params.include });
    }

    if (params.exclude && !Array.isArray(params.exclude)) {
      throw new APValidationError('Exclude must be an array of strings', 'exclude', { exclude: params.exclude });
    }

    if (params.format && typeof params.format !== 'string') {
      throw new APValidationError('Format must be a string', 'format', { format: params.format });
    }
  }

  /**
   * Validate feed parameters
   */
  private validateFeedParams(params: FeedParams): void {
    if (params.page_size !== undefined && (params.page_size < 1 || params.page_size > 100)) {
      throw new APValidationError('Page size must be between 1 and 100', 'page_size', { page_size: params.page_size });
    }

    if (params.include && !Array.isArray(params.include)) {
      throw new APValidationError('Include must be an array of strings', 'include', { include: params.include });
    }

    if (params.exclude && !Array.isArray(params.exclude)) {
      throw new APValidationError('Exclude must be an array of strings', 'exclude', { exclude: params.exclude });
    }

    if (params.with_monitor && (typeof params.with_monitor !== 'string' || params.with_monitor.length < 4 || params.with_monitor.length > 24)) {
      throw new APValidationError('Monitor name must be a string between 4 and 24 characters', 'with_monitor', { with_monitor: params.with_monitor });
    }
  }

  /**
   * Validate RSS parameters
   */
  private validateRSSParams(params: RSSParams): void {
    if (params.include && !Array.isArray(params.include)) {
      throw new APValidationError('Include must be an array of strings', 'include', { include: params.include });
    }

    if (params.exclude && !Array.isArray(params.exclude)) {
      throw new APValidationError('Exclude must be an array of strings', 'exclude', { exclude: params.exclude });
    }

    if (params.page_size !== undefined && (params.page_size < 1 || params.page_size > 100)) {
      throw new APValidationError('Page size must be between 1 and 100', 'page_size', { page_size: params.page_size });
    }
  }

  /**
   * Validate OnDemand parameters
   */
  private validateOnDemandParams(params: any): void {
    if (params.consumer_id && typeof params.consumer_id !== 'string') {
      throw new APValidationError('Consumer ID must be a string', 'consumer_id', { consumer_id: params.consumer_id });
    }

    if (params.queue && typeof params.queue !== 'string') {
      throw new APValidationError('Queue must be a string', 'queue', { queue: params.queue });
    }

    if (params.include && !Array.isArray(params.include)) {
      throw new APValidationError('Include must be an array of strings', 'include', { include: params.include });
    }

    if (params.exclude && !Array.isArray(params.exclude)) {
      throw new APValidationError('Exclude must be an array of strings', 'exclude', { exclude: params.exclude });
    }

    if (params.page_size !== undefined && (params.page_size < 1 || params.page_size > 100)) {
      throw new APValidationError('Page size must be between 1 and 100', 'page_size', { page_size: params.page_size });
    }
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
      `ContentService.${operation} failed: ${error}`,
      'CONTENT_SERVICE_ERROR',
      undefined,
      { operation, context, originalError: error }
    );
  }

  /**
   * Build search query helper
   */
  static buildSearchQuery(filters: {
    query?: string;
    mediaType?: 'text' | 'picture' | 'graphic' | 'audio' | 'video';
    dateRange?: { start?: string; end?: string };
    subjects?: string[];
    locations?: string[];
  }): string {
    const queryParts: string[] = [];

    if (filters.query) {
      queryParts.push(filters.query);
    }

    if (filters.mediaType) {
      queryParts.push(`type:${filters.mediaType}`);
    }

    if (filters.dateRange?.start) {
      queryParts.push(`firstcreated:[${filters.dateRange.start} TO *]`);
    }

    if (filters.dateRange?.end) {
      queryParts.push(`firstcreated:[* TO ${filters.dateRange.end}]`);
    }

    if (filters.subjects && filters.subjects.length > 0) {
      const subjectQuery = filters.subjects.map(s => `subject.name:"${s}"`).join(' OR ');
      queryParts.push(`(${subjectQuery})`);
    }

    if (filters.locations && filters.locations.length > 0) {
      const locationQuery = filters.locations.map(l => `place.name:"${l}"`).join(' OR ');
      queryParts.push(`(${locationQuery})`);
    }

    return queryParts.join(' AND ');
  }

  /**
   * Extract content summary for display
   */
  static extractContentSummary(contentResult: any): {
    id: string;
    title?: string;
    headline?: string;
    type: string;
    publishDate?: string;
    summary?: string;
    urgency?: number;
    subjects?: string[];
  } {
    const item = contentResult.item || contentResult;
    
    return {
      id: item.altids?.itemid || item.uri,
      title: item.title,
      headline: item.headline,
      type: item.type,
      publishDate: item.versioncreated || item.firstcreated,
      summary: item.description_summary,
      urgency: item.urgency,
      subjects: item.subject?.map((s: any) => s.name) || [],
    };
  }
}