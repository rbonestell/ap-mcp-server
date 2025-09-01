import { APAPIError, APError, APNetworkError, APValidationError } from '../errors/APError.js';
import { APHttpClient } from '../http/APHttpClient.js';
import { APConfigManager } from '../config/APConfig.js';
import { ResponseFormatter } from '../utils/ResponseFormatter.js';
import { QuerySuggestions } from '../types/responses.types.js';
import {
	BulkContentParams,
	BulkContentResponse,
	BulkContentResult,
	ContentRecommendation,
	ContentRecommendationsParams,
	ContentRecommendationsResponse,
	ContentResponse,
	ContentTrendsParams,
	ContentTrendsResponse,
	FeedParams,
	FeedResponse,
	ItemParams,
	OptimizeQueryParams,
	OptimizeQueryResponse,
	RSSParams,
	RSSResponse,
	SearchAllParams,
	SearchAllResponse,
	SearchParams,
	SearchResponse,
	TrendingSubject,
	TrendingSubjectsParams,
	TrendingSubjectsResponse,
	TrendingTopic
} from '../types/api.types.js';
import { CacheTTL, globalCache, SimpleCache } from '../utils/Cache.js';

/**
 * Service for AP Content API operations
 */
export class ContentService {
  constructor(
    private readonly httpClient: APHttpClient,
    private readonly config?: APConfigManager
  ) {}

  /**
   * Apply plan enforcement based on configuration
   * @param params Any parameters object that may contain in_my_plan
   * @returns Modified params with enforced plan setting
   */
  private enforceInMyPlan<T extends { in_my_plan?: boolean }>(params: T): T {
    // If config is available and enforcePlan is true, force in_my_plan to true
    if (this.config && this.config.get('enforcePlan')) {
      return { ...params, in_my_plan: true };
    }
    return params;
  }

  /**
   * Generate query suggestions for broad searches
   * @param query The original search query
   * @param totalItems Total number of items found
   * @returns Query suggestions or undefined
   */
  private generateQuerySuggestions(query: string, totalItems: number): QuerySuggestions | undefined {
    const suggestions: QuerySuggestions = {};

    // Check if query is too broad
    if (totalItems > 1000) {
      suggestions.query_too_broad = true;
      suggestions.suggested_refinements = [
        `${query} AND firstcreated:[NOW-7DAYS TO NOW]`,
        `${query} AND firstcreated:[NOW-24HOURS TO NOW]`,
        `${query} AND type:text`,
        `${query} AND type:picture`,
        `${query} AND place.name:"United States"`,
        `${query} AND urgency:5`
      ];
    }

    // Add filter suggestions for broad queries
    if (totalItems > 500) {
      suggestions.filter_suggestions = {
        date_range: 'firstcreated:[NOW-24HOURS TO NOW]',
        content_type: 'type:text OR type:picture',
        location: 'place.name:"United States" OR place.name:"Europe"'
      };
    }

    // Add related queries based on query length
    if (query.length < 30) {
      suggestions.related_queries = [
        `${query} breaking news`,
        `${query} latest updates`,
        `${query} analysis`,
        `${query} exclusive`
      ];
    }

    return Object.keys(suggestions).length > 0 ? suggestions : undefined;
  }

  /**
   * Search for AP content
   * @param params Search parameters
   * @returns Search response with paginated content items
   */
  async searchContent(params: SearchParams = {}): Promise<SearchResponse> {
    this.validateSearchParams(params);
    const enforcedParams = this.enforceInMyPlan(params);

    try {
      const response = await this.httpClient.get<SearchResponse>('content/search', enforcedParams);
      const searchData = response.data;
      
      // Add query suggestions if results indicate query is too broad
      if (searchData.data && searchData.data.total_items > 1000 && params.q) {
        const suggestions = this.generateQuerySuggestions(params.q, searchData.data.total_items);
        if (suggestions) {
          (searchData as any).suggestions = suggestions;
        }
      }
      
      // Add rate limit info to response if available
      if (response.rateLimit) {
        (searchData as any).rate_limit_info = response.rateLimit;
      }
      
      return searchData;
    } catch (error) {
      throw this.handleServiceError('searchContent', error, enforcedParams);
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
    const enforcedParams = this.enforceInMyPlan(params);

    try {
      const response = await this.httpClient.get<ContentResponse>(`content/${encodeURIComponent(itemId)}`, enforcedParams);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getContentItem', error, { itemId, ...enforcedParams });
    }
  }

  /**
   * Get a feed of incoming AP content
   * @param params Feed parameters
   * @returns Feed response with content items
   */
  async getContentFeed(params: FeedParams = {}): Promise<FeedResponse> {
    this.validateFeedParams(params);
    const enforcedParams = this.enforceInMyPlan(params);

    try {
      const response = await this.httpClient.get<FeedResponse>('content/feed', enforcedParams);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getContentFeed', error, enforcedParams);
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
   * Get content rendition from href URL
   * @param href The href URL from a content item's renditions or links
   * @param params Optional parameters for the rendition request
   * @returns The rendition content (could be text, binary data, etc.)
   */
  async getContentRendition(href: string, params: {
    format?: string;
    encoding?: string;
  } = {}): Promise<{
    content: string | Buffer;
    contentType: string;
    contentLength?: number;
    fileName?: string;
  }> {
    if (!href || typeof href !== 'string') {
      throw new APValidationError('href is required and must be a string', 'href', { href });
    }

    // Validate that this looks like a valid AP API URL
    const url = new URL(href);
    if (!url.hostname.includes('api.ap.org') && !url.hostname.includes('apnews.org')) {
      throw new APValidationError('Invalid AP API href URL', 'href', { href, hostname: url.hostname });
    }

    try {
      // Use the HTTP client's raw fetch capabilities, but we need to handle this differently
      // since renditions may return various content types (text, images, videos, etc.)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for renditions

      // Get headers from the HTTP client (which includes the API key)
      const baseHeaders = (this.httpClient as any).config.getHttpHeaders();
      
      const requestInit: RequestInit = {
        method: 'GET',
        headers: {
          'x-api-key': baseHeaders['x-api-key'], // Use the same API key
          'Accept': '*/*', // Accept any content type
          'User-Agent': baseHeaders['User-Agent'] || 'AP-MCP-Server/1.0.0',
          ...(params.format && { 'Accept': params.format }),
        },
        signal: controller.signal,
      };

      const response = await fetch(href, requestInit);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new APAPIError(
          `Failed to fetch rendition: ${response.status} ${response.statusText}`,
          response.status,
          'RENDITION_FETCH_ERROR',
          { href, status: response.status, statusText: response.statusText }
        );
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentLength = response.headers.get('content-length') ? 
        parseInt(response.headers.get('content-length')!) : undefined;
      
      // Extract filename from Content-Disposition header or URL
      let fileName: string | undefined;
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          fileName = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      if (!fileName) {
        // Extract from URL path
        const urlPath = new URL(href).pathname;
        const pathParts = urlPath.split('/');
        fileName = pathParts[pathParts.length - 1] || 'rendition';
      }

      let content: string | Buffer;

      // Determine if this is text content or binary
      if (contentType.startsWith('text/') || 
          contentType.includes('json') || 
          contentType.includes('xml') || 
          contentType.includes('html')) {
        // Text content
        content = await response.text();
      } else {
        // Binary content - return as Buffer
        const arrayBuffer = await response.arrayBuffer();
        content = Buffer.from(arrayBuffer);
      }

      return {
        content,
        contentType,
        contentLength,
        fileName,
      };

    } catch (error) {
      if (error instanceof APError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new APNetworkError('Rendition request timeout after 30 seconds', error);
      }

      throw this.handleServiceError('getContentRendition', error, { href, params });
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
    if (error instanceof APValidationError) {
      // Preserve APValidationError type - these should pass through unchanged
      return error;
    } else if (error instanceof APAPIError) {
      // Preserve APAPIError type with additional context
      const newDetails = {
        ...error.details,
        operation,
        context,
      };
      return new APAPIError(error.message, error.statusCode || 500, error.code, newDetails, error.originalError);
    } else if (error instanceof APError) {
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

  /**
   * Optimize a natural language search query for AP content API
   * @param params Natural language query optimization parameters
   * @returns Optimized query with suggestions and transformations
   */
  async optimizeSearchQuery(params: OptimizeQueryParams): Promise<OptimizeQueryResponse> {
    this.validateOptimizeQueryParams(params);

    try {
      // Apply NLP patterns to transform natural language to structured query
      const nlpResult = this.applyNLPPatterns(params.natural_query);

      // Apply content preferences if provided (but avoid duplicating filters already applied by NLP)
      const preferenceFilters = this.applyContentPreferences(params.content_preferences, nlpResult);

      // Combine base query with NLP transformations and preferences
      const queryParts = [
        nlpResult.baseQuery,
        ...nlpResult.appliedFilters,
        ...preferenceFilters
      ].filter(Boolean);

      // Optimize for specific criteria
      const optimizedParts = this.optimizeQueryForCriteria(queryParts, params.optimize_for || 'relevance');

      const optimizedQuery = optimizedParts.join(' AND ');

      // Generate suggestions if requested
      const suggestions = params.suggest_filters !== false
        ? this.generateOptimizedQuerySuggestions(params.natural_query, nlpResult)
        : undefined;

      // Calculate confidence score based on transformations applied
      const confidenceScore = this.calculateQueryConfidence(nlpResult, preferenceFilters.length);

      return {
        optimized_query: optimizedQuery,
        original_query: params.natural_query,
        transformations_applied: {
          temporal_filters: nlpResult.temporalFilters,
          content_type_filters: nlpResult.contentTypeFilters,
          location_filters: nlpResult.locationFilters,
          subject_filters: nlpResult.subjectFilters,
          other_filters: nlpResult.otherFilters,
        },
        suggestions,
        confidence_score: confidenceScore,
      };
    } catch (error) {
      throw this.handleServiceError('optimizeSearchQuery', error, params);
    }
  }

  /**
   * Analyze content trends across different timeframes
   * @param params Content trend analysis parameters
   * @returns Trending topics and analysis metrics
   */
  async analyzeContentTrends(params: ContentTrendsParams = {}): Promise<ContentTrendsResponse> {
    this.validateContentTrendsParams(params);

    try {
      const timeframe = params.timeframe || 'day';
      const maxTopics = Math.min(params.max_topics || 10, 50);

      // Calculate time range for analysis
      const timeRange = this.calculateTimeRange(timeframe);

      // Build search query for trending analysis
      const searchQuery = this.buildTrendingSearchQuery(params, timeRange);

      // Perform multiple searches to gather trend data
      const trendingData = await this.gatherTrendingData(
        searchQuery,
        params.content_types,
        maxTopics
      );

      // Analyze trends and calculate metrics
      const analyzedTrends = this.analyzeTrendingTopics(trendingData, timeframe);

      // Extract geographic distribution if location data available
      const geoDistribution = this.extractGeographicTrends(trendingData);

      return {
        timeframe,
        analysis_period: {
          start: timeRange.start,
          end: timeRange.end,
        },
        trending_topics: analyzedTrends.slice(0, maxTopics),
        total_content_analyzed: trendingData.totalCount,
        content_types_analyzed: params.content_types || ['text', 'picture', 'video', 'audio', 'graphic'],
        metrics: {
          top_rising_topics: analyzedTrends
            .filter(t => t.trend_direction === 'rising')
            .slice(0, 5)
            .map(t => t.subject_name),
          most_frequent_topics: analyzedTrends
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5)
            .map(t => t.subject_name),
          geographic_hotspots: geoDistribution.slice(0, 3),
        },
      };
    } catch (error) {
      throw this.handleServiceError('analyzeContentTrends', error, params);
    }
  }

  /**
   * Get content recommendations based on criteria
   * @param params Content recommendation parameters
   * @returns Recommended content with relevance scores
   */
  async getContentRecommendations(params: ContentRecommendationsParams = {}): Promise<ContentRecommendationsResponse> {
    this.validateContentRecommendationsParams(params);

    try {
      const maxRecommendations = Math.min(params.max_recommendations || 10, 25);
      const similarityThreshold = params.similarity_threshold || 0.3;

      // Analyze seed content if provided
      let seedAnalysis;
      if (params.seed_content && params.seed_content.length > 0) {
        seedAnalysis = await this.analyzeSeedContent(params.seed_content);
      }

      // Build recommendation search strategy
      const searchStrategy = this.buildRecommendationStrategy(params, seedAnalysis);

      // Execute multiple targeted searches
      const candidateContent = await this.searchForRecommendations(searchStrategy, params);

      // Score and rank recommendations
      const scoredRecommendations = this.scoreContentRecommendations(
        candidateContent,
        params,
        seedAnalysis,
        similarityThreshold
      );

      // Filter out excluded content
      const filteredRecommendations = this.filterExcludedContent(
        scoredRecommendations,
        params.exclude_seen || []
      );

      // Sort by relevance score and limit results
      const topRecommendations = filteredRecommendations
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, maxRecommendations);

      return {
        recommendations: topRecommendations,
        seed_analysis: seedAnalysis,
        total_recommendations: topRecommendations.length,
        search_strategy: searchStrategy.description,
        filters_applied: searchStrategy.filtersApplied,
      };
    } catch (error) {
      throw this.handleServiceError('getContentRecommendations', error, params);
    }
  }

  /**
   * Private helper methods for enhanced query intelligence
   */

  private validateOptimizeQueryParams(params: OptimizeQueryParams): void {
    if (!params.natural_query || typeof params.natural_query !== 'string' || params.natural_query.trim().length === 0) {
      throw new APValidationError('Natural query is required and must be a non-empty string', 'natural_query', { natural_query: params.natural_query });
    }

    if (params.natural_query.length > 500) {
      throw new APValidationError('Natural query must be 500 characters or less', 'natural_query', { length: params.natural_query.length });
    }

    if (params.optimize_for && !['relevance', 'recency', 'popularity'].includes(params.optimize_for)) {
      throw new APValidationError('optimize_for must be one of: relevance, recency, popularity', 'optimize_for', { optimize_for: params.optimize_for });
    }
  }

  private validateContentTrendsParams(params: ContentTrendsParams): void {
    if (params.timeframe && !['hour', 'day', 'week'].includes(params.timeframe)) {
      throw new APValidationError('timeframe must be one of: hour, day, week', 'timeframe', { timeframe: params.timeframe });
    }

    if (params.max_topics !== undefined && (params.max_topics < 1 || params.max_topics > 50)) {
      throw new APValidationError('max_topics must be between 1 and 50', 'max_topics', { max_topics: params.max_topics });
    }

    if (params.content_types) {
      const validTypes = ['text', 'picture', 'graphic', 'audio', 'video'];
      const invalidTypes = params.content_types.filter(type => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        throw new APValidationError(`Invalid content types: ${invalidTypes.join(', ')}`, 'content_types', { invalid_types: invalidTypes });
      }
    }
  }

  private validateContentRecommendationsParams(params: ContentRecommendationsParams): void {
    if (params.max_recommendations !== undefined && (params.max_recommendations < 1 || params.max_recommendations > 25)) {
      throw new APValidationError('max_recommendations must be between 1 and 25', 'max_recommendations', { max_recommendations: params.max_recommendations });
    }

    if (params.similarity_threshold !== undefined && (params.similarity_threshold < 0 || params.similarity_threshold > 1)) {
      throw new APValidationError('similarity_threshold must be between 0 and 1', 'similarity_threshold', { similarity_threshold: params.similarity_threshold });
    }

    if (params.content_types) {
      const validTypes = ['text', 'picture', 'graphic', 'audio', 'video'];
      const invalidTypes = params.content_types.filter(type => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        throw new APValidationError(`Invalid content types: ${invalidTypes.join(', ')}`, 'content_types', { invalid_types: invalidTypes });
      }
    }

    if (params.recency_preference && !['latest', 'recent', 'any'].includes(params.recency_preference)) {
      throw new APValidationError('recency_preference must be one of: latest, recent, any', 'recency_preference', { recency_preference: params.recency_preference });
    }
  }

  private applyNLPPatterns(query: string): {
    baseQuery: string;
    appliedFilters: string[];
    temporalFilters: string[];
    contentTypeFilters: string[];
    locationFilters: string[];
    subjectFilters: string[];
    otherFilters: string[];
  } {
    let processedQuery = query;
    const appliedFilters: string[] = [];
    const temporalFilters: string[] = [];
    const contentTypeFilters: string[] = [];
    const locationFilters: string[] = [];
    const subjectFilters: string[] = [];
    const otherFilters: string[] = [];

    // Temporal patterns
    const temporalPatterns = [
      { pattern: /\b(today|now)\b/gi, transform: 'firstcreated:[now-1d TO *]', description: 'today' },
      { pattern: /\b(yesterday)\b/gi, transform: 'firstcreated:[now-2d TO now-1d]', description: 'yesterday' },
      { pattern: /\b(this week|recent|recently|latest)\b/gi, transform: 'firstcreated:[now-7d TO *]', description: 'this week' },
      { pattern: /\b(this month)\b/gi, transform: 'firstcreated:[now-30d TO *]', description: 'this month' },
      { pattern: /\b(last (\d+) days?)\b/gi, transform: (match: string, full: string, days: string) => `firstcreated:[now-${days}d TO *]`, description: 'last N days' }
    ];

    // Content type patterns
    const contentTypePatterns = [
      { pattern: /\b(photo|photos|picture|pictures|image|images)\b/gi, transform: 'type:picture', description: 'pictures' },
      { pattern: /\b(video|videos|footage)\b/gi, transform: 'type:video', description: 'videos' },
      { pattern: /\b(audio|sound|sounds)\b/gi, transform: 'type:audio', description: 'audio' },
      { pattern: /\b(graphic|graphics|chart|charts)\b/gi, transform: 'type:graphic', description: 'graphics' },
      { pattern: /\b(text|article|articles|story|stories|news)\b/gi, transform: 'type:text', description: 'text' }
    ];

    // Location patterns (basic - looks for "in [Location]" pattern)
    const locationPatterns = [
      { pattern: /\bin ([A-Z][a-zA-Z\s]+?)(?:\s|$|,|\.|\?|!)/g, transform: (match: string, location: string) => `place.name:"${location.trim()}"`, description: 'location filter' }
    ];

    // Apply temporal patterns
    for (const pattern of temporalPatterns) {
      if (typeof pattern.transform === 'string') {
        if (pattern.pattern.test(processedQuery)) {
          appliedFilters.push(pattern.transform);
          temporalFilters.push(pattern.description);
          processedQuery = processedQuery.replace(pattern.pattern, ' ').trim();
        }
      } else {
        const matches = processedQuery.match(pattern.pattern);
        if (matches) {
          for (const match of matches) {
            const fullMatch = match;
            const daysMatch = fullMatch.match(/\d+/);
            if (daysMatch) {
              const filter = `firstcreated:[now-${daysMatch[0]}d TO *]`;
              appliedFilters.push(filter);
              temporalFilters.push(`last ${daysMatch[0]} days`);
            }
          }
          processedQuery = processedQuery.replace(pattern.pattern, ' ').trim();
        }
      }
    }

    // Apply content type patterns
    for (const pattern of contentTypePatterns) {
      if (pattern.pattern.test(processedQuery)) {
        appliedFilters.push(pattern.transform);
        contentTypeFilters.push(pattern.description);
        processedQuery = processedQuery.replace(pattern.pattern, ' ').trim();
      }
    }

    // Apply location patterns
    for (const pattern of locationPatterns) {
      const matches = Array.from(processedQuery.matchAll(pattern.pattern));
      if (matches.length > 0) {
        for (const match of matches) {
          if (match[1]) {
            const location = match[1].trim();
            const filter = `place.name:"${location}"`;
            appliedFilters.push(filter);
            locationFilters.push(location);
          }
        }
        processedQuery = processedQuery.replace(pattern.pattern, ' ').trim();
      }
    }

    // Clean up the processed query
    const baseQuery = processedQuery.replace(/\s+/g, ' ').trim();

    return {
      baseQuery,
      appliedFilters,
      temporalFilters,
      contentTypeFilters,
      locationFilters,
      subjectFilters,
      otherFilters,
    };
  }

  private applyContentPreferences(preferences?: OptimizeQueryParams['content_preferences'], nlpResult?: any): string[] {
    if (!preferences) return [];

    const filters: string[] = [];

    // Only add type filters if NLP didn't already detect content types
    if (preferences.preferred_types && preferences.preferred_types.length > 0 &&
        (!nlpResult || nlpResult.contentTypeFilters.length === 0)) {
      if (preferences.preferred_types.length === 1) {
        filters.push(`type:${preferences.preferred_types[0]}`);
      } else {
        const typeQuery = preferences.preferred_types.map(type => `type:${type}`).join(' OR ');
        filters.push(`(${typeQuery})`);
      }
    }

    if (preferences.preferred_subjects && preferences.preferred_subjects.length > 0) {
      const subjectQuery = preferences.preferred_subjects.map(subject => `subject.name:"${subject}"`).join(' OR ');
      filters.push(`(${subjectQuery})`);
    }

    if (preferences.preferred_locations && preferences.preferred_locations.length > 0 &&
        (!nlpResult || nlpResult.locationFilters.length === 0)) {
      const locationQuery = preferences.preferred_locations.map(location => `place.name:"${location}"`).join(' OR ');
      filters.push(`(${locationQuery})`);
    }

    // Only add temporal filters if NLP didn't already detect time references
    if (preferences.recency_preference && preferences.recency_preference !== 'any' &&
        (!nlpResult || nlpResult.temporalFilters.length === 0)) {
      switch (preferences.recency_preference) {
        case 'latest':
          filters.push('firstcreated:[now-1d TO *]');
          break;
        case 'recent':
          filters.push('firstcreated:[now-7d TO *]');
          break;
      }
    }

    return filters;
  }

  private optimizeQueryForCriteria(queryParts: string[], optimizeFor: 'relevance' | 'recency' | 'popularity'): string[] {
    // For now, return as-is, but this could be enhanced with:
    // - Relevance: boost important terms, add related subject filters
    // - Recency: adjust temporal filters, add sort parameters
    // - Popularity: add urgency filters, boost high-profile subjects
    return queryParts;
  }

  private generateOptimizedQuerySuggestions(originalQuery: string, nlpResult: any): OptimizeQueryResponse['suggestions'] {
    const suggestions: OptimizeQueryResponse['suggestions'] = {
      additional_filters: [],
      alternative_queries: [],
      search_tips: [],
    };

    // Suggest additional filters based on query content
    if (!nlpResult.temporalFilters.length) {
      suggestions.additional_filters?.push('Add time filter like "today" or "this week"');
    }

    if (!nlpResult.contentTypeFilters.length) {
      suggestions.additional_filters?.push('Specify content type like "photos" or "videos"');
    }

    // Suggest alternative query approaches
    if (originalQuery.length < 10) {
      suggestions.alternative_queries?.push('Try adding more specific keywords or context');
    }

    // Add helpful search tips
    suggestions.search_tips?.push('Use quotes for exact phrases: "breaking news"');
    suggestions.search_tips?.push('Use location keywords like "in Washington" for geographic filtering');
    suggestions.search_tips?.push('Add time references like "today" or "this week" for recent content');

    return suggestions;
  }

  private calculateQueryConfidence(nlpResult: any, preferenceCount: number): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence for successful transformations
    if (nlpResult.temporalFilters.length > 0) confidence += 0.15;
    if (nlpResult.contentTypeFilters.length > 0) confidence += 0.15;
    if (nlpResult.locationFilters.length > 0) confidence += 0.1;
    if (preferenceCount > 0) confidence += 0.1;

    // Ensure confidence is within reasonable bounds
    return Math.min(Math.max(confidence, 0.2), 0.95);
  }

  // Trend analysis helper methods
  private calculateTimeRange(timeframe: 'hour' | 'day' | 'week'): { start: string; end: string } {
    const now = new Date();
    const end = now.toISOString();
    let start: Date;

    switch (timeframe) {
      case 'hour':
        start = new Date(now.getTime() - (60 * 60 * 1000));
        break;
      case 'day':
        start = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        break;
      case 'week':
        start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
    }

    return {
      start: start.toISOString(),
      end,
    };
  }

  private buildTrendingSearchQuery(params: ContentTrendsParams, timeRange: { start: string; end: string }): string {
    const queryParts: string[] = [];

    // Add time range
    queryParts.push(`firstcreated:[${timeRange.start} TO ${timeRange.end}]`);

    // Add content type filters if specified
    if (params.content_types && params.content_types.length > 0) {
      if (params.content_types.length === 1) {
        queryParts.push(`type:${params.content_types[0]}`);
      } else {
        const typeQuery = params.content_types.map(type => `type:${type}`).join(' OR ');
        queryParts.push(`(${typeQuery})`);
      }
    }

    // Add location filter if specified
    if (params.location_filter) {
      queryParts.push(`place.name:"${params.location_filter}"`);
    }

    // Add subject filter if specified
    if (params.subject_filter) {
      queryParts.push(`subject.name:"${params.subject_filter}"`);
    }

    return queryParts.join(' AND ');
  }

  private async gatherTrendingData(searchQuery: string, contentTypes?: string[], maxTopics?: number): Promise<any> {
    // Perform search to get trending data
    const searchParams: SearchParams = {
      q: searchQuery,
      page_size: 100, // Get more items for better trend analysis
      include: ['subject', 'place', 'urgency', 'firstcreated'],
    };

    const searchResponse = await this.searchContent(searchParams);

    // Extract subjects and their frequencies
    const subjectCounts = new Map<string, { count: number; codes: Set<string>; content_ids: string[]; locations: Set<string> }>();

    for (const result of searchResponse.data.items) {
      const item = result.item;
      if (item.subject) {
        for (const subject of item.subject) {
          const key = subject.name;
          if (!subjectCounts.has(key)) {
            subjectCounts.set(key, {
              count: 0,
              codes: new Set(),
              content_ids: [],
              locations: new Set(),
            });
          }

          const subjectData = subjectCounts.get(key)!;
          subjectData.count++;
          subjectData.codes.add(subject.code);
          subjectData.content_ids.push(item.altids?.itemid || item.uri);

          // Add location data if available
          if (item.place) {
            for (const place of item.place) {
              subjectData.locations.add(place.name);
            }
          }
        }
      }
    }

    return {
      totalCount: searchResponse.data.total_items,
      subjectCounts,
      searchResponse,
    };
  }

  private analyzeTrendingTopics(trendingData: any, timeframe: string): TrendingTopic[] {
    const trends: TrendingTopic[] = [];

    for (const [subjectName, data] of trendingData.subjectCounts) {
      // Simple trend analysis - in a real implementation, this would compare
      // with historical data to determine trend direction
      const trendDirection: 'rising' | 'stable' | 'declining' =
        data.count > 5 ? 'rising' :
        data.count > 2 ? 'stable' : 'declining';

      const trendStrength = Math.min(data.count / 10, 1.0); // Normalize to 0-1

      trends.push({
        subject_name: subjectName,
        subject_code: Array.from(data.codes)[0], // Use first code
        frequency: data.count,
        trend_direction: trendDirection,
        trend_strength: trendStrength,
        sample_content_ids: data.content_ids.slice(0, 3), // Up to 3 sample IDs
        geographic_distribution: data.locations.size > 0
          ? Object.fromEntries(Array.from(data.locations).map(loc => [loc, 1]))
          : undefined,
      });
    }

    // Sort by frequency descending
    return trends.sort((a, b) => b.frequency - a.frequency);
  }

  private extractGeographicTrends(trendingData: any): string[] {
    const locationCounts = new Map<string, number>();

    for (const [_, data] of trendingData.subjectCounts) {
      for (const location of data.locations) {
        locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
      }
    }

    return Array.from(locationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([location]) => location);
  }

  // Recommendation helper methods
  private async analyzeSeedContent(contentIds: string[]): Promise<ContentRecommendationsResponse['seed_analysis']> {
    const commonSubjects = new Set<string>();
    const commonLocations = new Set<string>();
    const contentTypes = new Map<string, number>();

    // Analyze each seed content item
    for (const contentId of contentIds.slice(0, 5)) { // Limit to 5 for performance
      try {
        const content = await this.getContentItem(contentId);
        const item = content.data.item;

        // Collect subjects
        if (item.subject) {
          for (const subject of item.subject) {
            commonSubjects.add(subject.name);
          }
        }

        // Collect locations
        if (item.place) {
          for (const place of item.place) {
            commonLocations.add(place.name);
          }
        }

        // Count content types
        contentTypes.set(item.type, (contentTypes.get(item.type) || 0) + 1);
      } catch (error) {
        // Skip failed content items
        continue;
      }
    }

    return {
      common_subjects: Array.from(commonSubjects).slice(0, 10),
      common_locations: Array.from(commonLocations).slice(0, 5),
      content_type_distribution: Object.fromEntries(contentTypes),
    };
  }

  private buildRecommendationStrategy(params: ContentRecommendationsParams, seedAnalysis?: any): { description: string; filtersApplied: string[] } {
    const filters: string[] = [];
    let description = 'Content recommendation';

    // Use seed analysis for recommendations
    if (seedAnalysis) {
      if (seedAnalysis.common_subjects.length > 0) {
        description += ' based on similar subjects';
        filters.push('subject-based similarity');
      }
      if (seedAnalysis.common_locations.length > 0) {
        description += ' and locations';
        filters.push('location-based similarity');
      }
    }

    // Apply explicit parameters
    if (params.subjects && params.subjects.length > 0) {
      description += ' with specified subjects';
      filters.push('explicit subject filters');
    }

    if (params.content_types && params.content_types.length > 0) {
      description += ' filtered by content type';
      filters.push('content type filters');
    }

    if (params.location_preference) {
      description += ' with location preference';
      filters.push('location preference');
    }

    if (params.recency_preference && params.recency_preference !== 'any') {
      description += ` prioritizing ${params.recency_preference} content`;
      filters.push('recency preference');
    }

    return { description, filtersApplied: filters };
  }

  private async searchForRecommendations(strategy: any, params: ContentRecommendationsParams): Promise<any[]> {
    const searchParams: SearchParams = {
      page_size: 50, // Get more candidates for better scoring
      include: ['subject', 'place', 'urgency', 'firstcreated'],
    };

    const queryParts: string[] = [];

    // Add subject-based search if specified
    if (params.subjects && params.subjects.length > 0) {
      const subjectQuery = params.subjects.map(subject => `subject.name:"${subject}"`).join(' OR ');
      queryParts.push(`(${subjectQuery})`);
    }

    // Add content type filter
    if (params.content_types && params.content_types.length > 0) {
      if (params.content_types.length === 1) {
        queryParts.push(`type:${params.content_types[0]}`);
      } else {
        const typeQuery = params.content_types.map(type => `type:${type}`).join(' OR ');
        queryParts.push(`(${typeQuery})`);
      }
    }

    // Add location preference
    if (params.location_preference) {
      queryParts.push(`place.name:"${params.location_preference}"`);
    }

    // Add recency filter
    if (params.recency_preference) {
      switch (params.recency_preference) {
        case 'latest':
          queryParts.push('firstcreated:[now-1d TO *]');
          break;
        case 'recent':
          queryParts.push('firstcreated:[now-7d TO *]');
          break;
      }
    }

    if (queryParts.length > 0) {
      searchParams.q = queryParts.join(' AND ');
    }

    const searchResponse = await this.searchContent(searchParams);
    return searchResponse.data.items;
  }

  private scoreContentRecommendations(
    candidates: any[],
    params: ContentRecommendationsParams,
    seedAnalysis?: any,
    threshold: number = 0.3
  ): ContentRecommendation[] {
    const recommendations: ContentRecommendation[] = [];

    for (const candidate of candidates) {
      const item = candidate.item;
      const contentSummary = ContentService.extractContentSummary(candidate);

      // Calculate relevance score based on multiple factors
      let relevanceScore = 0;
      const similarityFactors: ContentRecommendation['similarity_factors'] = {};
      let recommendationReason = '';

      // Subject overlap scoring
      if (seedAnalysis?.common_subjects) {
        const itemSubjects = item.subject?.map((s: any) => s.name) || [];
        const subjectOverlap = itemSubjects.filter((s: string) => seedAnalysis.common_subjects.includes(s)).length;
        const subjectSimilarity = subjectOverlap / Math.max(seedAnalysis.common_subjects.length, 1);
        similarityFactors.subject_overlap = subjectSimilarity;
        relevanceScore += subjectSimilarity * 0.4;
        if (subjectOverlap > 0) {
          recommendationReason += `Shares ${subjectOverlap} subjects with seed content. `;
        }
      }

      // Location overlap scoring
      if (seedAnalysis?.common_locations) {
        const itemLocations = item.place?.map((p: any) => p.name) || [];
        const locationOverlap = itemLocations.filter((l: string) => seedAnalysis.common_locations.includes(l)).length;
        const locationSimilarity = locationOverlap / Math.max(seedAnalysis.common_locations.length, 1);
        similarityFactors.location_overlap = locationSimilarity;
        relevanceScore += locationSimilarity * 0.2;
        if (locationOverlap > 0) {
          recommendationReason += `Same location as seed content. `;
        }
      }

      // Content type matching
      if (params.content_types) {
        if (params.content_types.includes(item.type)) {
          similarityFactors.content_type_match = 1;
          relevanceScore += 0.2;
          recommendationReason += `Matches preferred content type. `;
        }
      }

      // Temporal relevance (recency boost)
      if (item.firstcreated) {
        const contentDate = new Date(item.firstcreated);
        const daysSinceCreated = (Date.now() - contentDate.getTime()) / (24 * 60 * 60 * 1000);
        const temporalRelevance = Math.max(0, 1 - (daysSinceCreated / 30)); // Decay over 30 days
        similarityFactors.temporal_relevance = temporalRelevance;
        relevanceScore += temporalRelevance * 0.2;
      }

      // Urgency boost
      if (item.urgency && item.urgency >= 3) {
        relevanceScore += 0.1;
        recommendationReason += 'High urgency content. ';
      }

      // Only include recommendations above threshold
      if (relevanceScore >= threshold) {
        recommendations.push({
          content_id: item.altids?.itemid || item.uri,
          content_summary: {
            title: contentSummary.title,
            headline: contentSummary.headline,
            type: contentSummary.type,
            publish_date: contentSummary.publishDate,
            subjects: contentSummary.subjects,
            locations: item.place?.map((p: any) => p.name) || [],
          },
          relevance_score: Math.round(relevanceScore * 1000) / 1000, // Round to 3 decimal places
          recommendation_reason: recommendationReason.trim() || 'Content matches your criteria',
          related_subjects: item.subject?.map((s: any) => s.name) || [],
          similarity_factors: similarityFactors,
        });
      }
    }

    return recommendations;
  }

  private filterExcludedContent(recommendations: ContentRecommendation[], excludeIds: string[]): ContentRecommendation[] {
    if (excludeIds.length === 0) return recommendations;

    const excludeSet = new Set(excludeIds);
    return recommendations.filter(rec => !excludeSet.has(rec.content_id));
  }

  /**
   * Search for AP content with automatic pagination to get all results
   * @param params Auto-pagination search parameters
   * @returns All search results with performance metrics
   */
  async searchContentAll(params: SearchAllParams = {}): Promise<SearchAllResponse> {
    const startTime = Date.now();
    let cacheHits = 0;
    const errors: any[] = [];

    // Validate parameters
    this.validateSearchAllParams(params);

    const maxResults = Math.min(params.max_results || 500, 2000);
    const progressUpdates = params.progress_updates || false;
    const deduplicate = params.deduplicate !== false; // Default to true

    try {
      // Generate cache key for this search
      const cacheKey = SimpleCache.generateKey('search_all', {
        ...params,
        max_results: maxResults,
        deduplicate,
      });

      // Check cache first
      const cachedResult = globalCache.get(cacheKey);
      if (cachedResult) {
        cacheHits = 1;
        return {
          ...cachedResult,
          summary: {
            ...cachedResult.summary,
            cache_hits: 1,
            processing_time_ms: Date.now() - startTime,
          },
        };
      }

      const allItems: any[] = [];
      const seenIds = deduplicate ? new Set<string>() : null;
      let currentPage = 1;
      let totalPages = 1;
      let pagesFetched = 0;
      let hasMore = true;

      // Start with the provided page size or default to 25
      const pageSize = Math.min(params.page_size || 25, 100);

      while (hasMore && allItems.length < maxResults) {
        if (progressUpdates) {
          console.log(`Fetching page ${currentPage}/${totalPages}...`);
        }

        try {
          const searchParams: SearchParams = {
            ...params,
            page: currentPage.toString(),
            page_size: Math.min(pageSize, maxResults - allItems.length),
          };
          delete (searchParams as any).max_results;
          delete (searchParams as any).progress_updates;
          delete (searchParams as any).deduplicate;

          const response = await this.searchContent(searchParams);
          pagesFetched++;

          // Calculate total pages from first response
          if (currentPage === 1) {
            totalPages = Math.ceil(response.data.total_items / pageSize);
          }

          // Process items
          for (const item of response.data.items) {
            if (allItems.length >= maxResults) break;

            const itemId = item.item?.altids?.itemid || item.item?.uri;
            if (deduplicate && seenIds && itemId) {
              if (seenIds.has(itemId)) {
                continue; // Skip duplicate
              }
              seenIds.add(itemId);
            }

            allItems.push(item);
          }

          // Check if we have more pages
          hasMore = response.data.current_item_count === pageSize &&
                   allItems.length < maxResults &&
                   currentPage < totalPages;

          currentPage++;

          // Rate limiting: small delay between requests
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error) {
          errors.push({
            page: currentPage,
            error: error instanceof Error ? error.message : String(error),
          });

          // Continue to next page on error
          currentPage++;
          hasMore = currentPage <= totalPages && allItems.length < maxResults;
        }
      }

      const processingTime = Date.now() - startTime;
      const successRate = pagesFetched > 0 ? (pagesFetched - errors.length) / pagesFetched : 1;
      const deduplicatedCount = deduplicate && seenIds ?
        (allItems.length + (seenIds.size - allItems.length)) : undefined;

      const result: SearchAllResponse = {
        summary: {
          operation: 'search_content_all',
          total_results: allItems.length,
          pages_fetched: pagesFetched,
          cache_hits: cacheHits,
          processing_time_ms: processingTime,
          success_rate: Math.round(successRate * 1000) / 1000,
          deduplicated_count: deduplicatedCount,
        },
        full_response: {
          items: allItems,
          performance_stats: {
            processing_time_ms: processingTime,
            pages_fetched: pagesFetched,
            items_processed: allItems.length,
            cache_hits: cacheHits,
            cache_misses: cacheHits === 0 ? 1 : 0,
            success_rate: successRate,
            errors: errors.length > 0 ? errors.map(e => e.error) : undefined,
          },
          pagination_info: {
            total_pages: totalPages,
            max_results_reached: allItems.length >= maxResults,
            final_page_size: pageSize,
          },
          errors: errors.length > 0 ? errors : undefined,
        },
      };

      // Cache successful results
      if (errors.length === 0) {
        globalCache.set(cacheKey, result, CacheTTL.SEARCH_RESULTS);
      }

      return result;

    } catch (error) {
      throw this.handleServiceError('searchContentAll', error, params);
    }
  }

  /**
   * Retrieve multiple content items by IDs efficiently with batch processing
   * @param params Bulk content retrieval parameters
   * @returns Bulk retrieval results with performance metrics
   */
  async getContentBulk(params: BulkContentParams): Promise<BulkContentResponse> {
    const startTime = Date.now();
    let cacheHits = 0;
    const errors: any[] = [];

    // Validate parameters
    this.validateBulkContentParams(params);

    const { item_ids, batch_size = 10, fail_on_missing = false } = params;
    const maxBatchSize = Math.min(batch_size, 20);

    try {
      // Generate cache key
      const cacheKey = SimpleCache.generateKey('bulk_content', {
        item_ids: item_ids.sort(),
        include: params.include,
        exclude: params.exclude,
        batch_size: maxBatchSize,
      });

      // Check cache first
      const cachedResult = globalCache.get(cacheKey);
      if (cachedResult) {
        cacheHits = 1;
        return {
          ...cachedResult,
          summary: {
            ...cachedResult.summary,
            cache_hits: 1,
            processing_time_ms: Date.now() - startTime,
          },
        };
      }

      const results: BulkContentResult[] = [];
      const missingIds: string[] = [];
      let successCount = 0;
      let failureCount = 0;

      // Process items in batches
      const batches = this.createBatches(item_ids, maxBatchSize);
      let batchCount = 0;

      for (const batch of batches) {
        batchCount++;

        // Process batch items in parallel (but limited concurrency)
        const batchPromises = batch.map(async (itemId) => {
          try {
            const itemParams = {
              include: params.include,
              exclude: params.exclude,
            };

            const content = await this.getContentItem(itemId, itemParams);
            successCount++;

            return {
              content_id: itemId,
              success: true,
              content: content.data,
            } as BulkContentResult;

          } catch (error) {
            failureCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Check if it's a 404 (not found) error
            if (error instanceof APAPIError && error.statusCode === 404) {
              missingIds.push(itemId);
            } else if (error instanceof APError && error.statusCode === 404) {
              missingIds.push(itemId);
            }

            errors.push({
              item_id: itemId,
              error: errorMessage,
            });

            return {
              content_id: itemId,
              success: false,
              error: errorMessage,
            } as BulkContentResult;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Rate limiting between batches
        if (batchCount < batches.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Fail fast if requested and we have failures
        if (fail_on_missing && missingIds.length > 0) {
          throw new APValidationError(
            `Missing content items: ${missingIds.join(', ')}`,
            'item_ids',
            { missing_ids: missingIds }
          );
        }
      }

      const processingTime = Date.now() - startTime;
      const successRate = item_ids.length > 0 ? successCount / item_ids.length : 1;

      const result: BulkContentResponse = {
        summary: {
          operation: 'get_content_bulk',
          total_results: results.length,
          successful_retrievals: successCount,
          failed_retrievals: failureCount,
          processing_time_ms: processingTime,
          success_rate: Math.round(successRate * 1000) / 1000,
          batch_count: batchCount,
        },
        full_response: {
          items: results,
          performance_stats: {
            processing_time_ms: processingTime,
            items_processed: results.length,
            cache_hits: cacheHits,
            cache_misses: cacheHits === 0 ? 1 : 0,
            success_rate: successRate,
            batch_count: batchCount,
            errors: errors.length > 0 ? errors.map(e => e.error) : undefined,
          },
          missing_item_ids: missingIds,
          errors: errors.length > 0 ? errors : undefined,
        },
      };

      // Cache successful results (only if high success rate)
      if (successRate >= 0.8) {
        globalCache.set(cacheKey, result, CacheTTL.BULK_OPERATIONS);
      }

      return result;

    } catch (error) {
      throw this.handleServiceError('getContentBulk', error, params);
    }
  }

  /**
   * Get trending subjects quickly without full content analysis
   * @param params Trending subjects parameters
   * @returns Trending subjects with frequency data
   */
  async getTrendingSubjects(params: TrendingSubjectsParams = {}): Promise<TrendingSubjectsResponse> {
    const startTime = Date.now();
    let cacheHits = 0;

    // Validate parameters
    this.validateTrendingSubjectsParams(params);

    const timeframe = params.timeframe || 'day';
    const maxSubjects = Math.min(params.max_subjects || 20, 100);
    const minFrequency = params.min_frequency || 2;

    try {
      // Generate cache key
      const cacheKey = SimpleCache.generateKey('trending_subjects', {
        timeframe,
        max_subjects: maxSubjects,
        min_frequency: minFrequency,
        subject_types: params.subject_types,
      });

      // Check cache first (trending data changes frequently, so shorter TTL)
      const cachedResult = globalCache.get(cacheKey);
      if (cachedResult) {
        cacheHits = 1;
        return {
          ...cachedResult,
          summary: {
            ...cachedResult.summary,
            cache_hits: 1,
            processing_time_ms: Date.now() - startTime,
          },
        };
      }

      // Calculate time range
      const timeRange = this.calculateTimeRange(timeframe);

      // Build optimized search query for trending analysis
      const queryParts: string[] = [];
      queryParts.push(`firstcreated:[${timeRange.start} TO ${timeRange.end}]`);

      // Filter by subject types if provided
      if (params.subject_types && params.subject_types.length > 0) {
        const subjectTypeQuery = params.subject_types.map(type => `subject.name:"${type}"`).join(' OR ');
        queryParts.push(`(${subjectTypeQuery})`);
      }

      const searchQuery = queryParts.join(' AND ');

      // Perform optimized search focused on subject extraction
      const searchParams: SearchParams = {
        q: searchQuery,
        page_size: 50, // Smaller page size for faster processing
        include: ['subject', 'firstcreated', 'altids'], // Only essential fields
      };

      const searchResponse = await this.searchContent(searchParams);

      // Extract and count subjects efficiently
      const subjectCounts = new Map<string, {
        count: number;
        codes: Set<string>;
        sample_ids: string[];
      }>();

      let contentAnalyzed = 0;
      for (const result of searchResponse.data.items) {
        const item = result.item;
        contentAnalyzed++;

        if (item.subject) {
          for (const subject of item.subject) {
            const subjectName = subject.name;
            if (!subjectCounts.has(subjectName)) {
              subjectCounts.set(subjectName, {
                count: 0,
                codes: new Set(),
                sample_ids: [],
              });
            }

            const subjectData = subjectCounts.get(subjectName)!;
            subjectData.count++;
            subjectData.codes.add(subject.code);

            // Keep only first 3 sample IDs for performance
            if (subjectData.sample_ids.length < 3) {
              subjectData.sample_ids.push(item.altids?.itemid || item.uri);
            }
          }
        }
      }

      // Convert to trending subjects and apply filters
      const trendingSubjects: TrendingSubject[] = [];

      for (const [subjectName, data] of subjectCounts.entries()) {
        // Apply minimum frequency filter
        if (data.count < minFrequency) continue;

        // Calculate trend score (simple frequency-based for now)
        const trendScore = Math.min(data.count / 10, 1.0);

        trendingSubjects.push({
          subject_name: subjectName,
          subject_code: Array.from(data.codes)[0], // Use first code
          frequency: data.count,
          trend_score: Math.round(trendScore * 1000) / 1000,
          sample_content_ids: data.sample_ids,
        });
      }

      // Sort by frequency and limit results
      const sortedSubjects = trendingSubjects
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, maxSubjects);

      const processingTime = Date.now() - startTime;
      const successRate = 1.0; // Simple operation, assume success if we get here

      const result: TrendingSubjectsResponse = {
        summary: {
          operation: 'get_trending_subjects',
          total_results: sortedSubjects.length,
          timeframe,
          processing_time_ms: processingTime,
          success_rate: successRate,
          cache_hits: cacheHits,
        },
        full_response: {
          items: sortedSubjects,
          performance_stats: {
            processing_time_ms: processingTime,
            items_processed: sortedSubjects.length,
            cache_hits: cacheHits,
            cache_misses: cacheHits === 0 ? 1 : 0,
            success_rate: successRate,
          },
          analysis_period: {
            start: timeRange.start,
            end: timeRange.end,
          },
          content_analyzed: contentAnalyzed,
        },
      };

      // Cache the results
      globalCache.set(cacheKey, result, CacheTTL.TRENDING_ANALYSIS);

      return result;

    } catch (error) {
      throw this.handleServiceError('getTrendingSubjects', error, params);
    }
  }

  private validateSearchAllParams(params: SearchAllParams): void {
    // First validate base search params
    this.validateSearchParams(params);

    if (params.max_results !== undefined && (params.max_results < 1 || params.max_results > 2000)) {
      throw new APValidationError('max_results must be between 1 and 2000', 'max_results', { max_results: params.max_results });
    }

    if (params.progress_updates !== undefined && typeof params.progress_updates !== 'boolean') {
      throw new APValidationError('progress_updates must be a boolean', 'progress_updates', { progress_updates: params.progress_updates });
    }

    if (params.deduplicate !== undefined && typeof params.deduplicate !== 'boolean') {
      throw new APValidationError('deduplicate must be a boolean', 'deduplicate', { deduplicate: params.deduplicate });
    }
  }

  private validateBulkContentParams(params: BulkContentParams): void {
    if (!params.item_ids || !Array.isArray(params.item_ids)) {
      throw new APValidationError('item_ids is required and must be an array', 'item_ids', { item_ids: params.item_ids });
    }

    if (params.item_ids.length === 0) {
      throw new APValidationError('item_ids cannot be empty', 'item_ids', { item_ids: params.item_ids });
    }

    if (params.item_ids.length > 50) {
      throw new APValidationError('item_ids cannot contain more than 50 items', 'item_ids', { count: params.item_ids.length });
    }

    // Check for duplicate IDs
    const uniqueIds = new Set(params.item_ids);
    if (uniqueIds.size !== params.item_ids.length) {
      throw new APValidationError('item_ids contains duplicate values', 'item_ids');
    }

    if (params.include && !Array.isArray(params.include)) {
      throw new APValidationError('include must be an array of strings', 'include', { include: params.include });
    }

    if (params.exclude && !Array.isArray(params.exclude)) {
      throw new APValidationError('exclude must be an array of strings', 'exclude', { exclude: params.exclude });
    }

    if (params.batch_size !== undefined && (params.batch_size < 1 || params.batch_size > 20)) {
      throw new APValidationError('batch_size must be between 1 and 20', 'batch_size', { batch_size: params.batch_size });
    }

    if (params.fail_on_missing !== undefined && typeof params.fail_on_missing !== 'boolean') {
      throw new APValidationError('fail_on_missing must be a boolean', 'fail_on_missing', { fail_on_missing: params.fail_on_missing });
    }
  }

  private validateTrendingSubjectsParams(params: TrendingSubjectsParams): void {
    if (params.timeframe && !['hour', 'day', 'week'].includes(params.timeframe)) {
      throw new APValidationError('timeframe must be one of: hour, day, week', 'timeframe', { timeframe: params.timeframe });
    }

    if (params.max_subjects !== undefined && (params.max_subjects < 1 || params.max_subjects > 100)) {
      throw new APValidationError('max_subjects must be between 1 and 100', 'max_subjects', { max_subjects: params.max_subjects });
    }

    if (params.min_frequency !== undefined && (params.min_frequency < 1 || params.min_frequency > 50)) {
      throw new APValidationError('min_frequency must be between 1 and 50', 'min_frequency', { min_frequency: params.min_frequency });
    }

    if (params.subject_types && !Array.isArray(params.subject_types)) {
      throw new APValidationError('subject_types must be an array of strings', 'subject_types', { subject_types: params.subject_types });
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
