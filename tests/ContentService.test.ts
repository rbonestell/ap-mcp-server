/**
 * Tests for ContentService - Service for AP Content API operations
 * Tests all API methods, parameter validation, and error handling
 */

import { APAPIError, APError, APValidationError } from '../src/errors/APError.js';
import { APHttpClient } from '../src/http/APHttpClient.js';
import { ContentService } from '../src/services/ContentService.js';
import { globalCache } from '../src/utils/Cache.js';
import {
	mockContentItem,
	mockRSSFeeds,
	mockSearchResponse
} from './fixtures/api-responses.js';

// Mock APHttpClient
jest.mock('../src/http/APHttpClient.js');
const MockAPHttpClient = APHttpClient as jest.MockedClass<typeof APHttpClient>;

describe('ContentService', () => {
  let contentService: ContentService;
  let mockHttpClient: jest.Mocked<APHttpClient>;

  beforeEach(() => {
    mockHttpClient = new MockAPHttpClient({} as any) as jest.Mocked<APHttpClient>;
    // Ensure all methods are properly mocked
    mockHttpClient.get = jest.fn();
    mockHttpClient.post = jest.fn();
    mockHttpClient.put = jest.fn();
    mockHttpClient.delete = jest.fn();
    contentService = new ContentService(mockHttpClient);
  });

  afterEach(() => {
    // Clear the cache after each test
    globalCache.clear();
  });

  afterAll(() => {
    // Stop the cleanup timer to prevent hanging
    globalCache.stopCleanupTimer();
  });

  describe('searchContent', () => {
    test('should search content with no parameters', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ data: mockSearchResponse, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.searchContent();

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/search', {});
      expect(result).toEqual(mockSearchResponse);
    });

    test('should search content with valid parameters', async () => {
      const params = {
        q: 'technology',
        page_size: 25,
        include: ['headline', 'body_text'],
        exclude: ['associations'],
        page: '2'
      };

      mockHttpClient.get.mockResolvedValueOnce({ data: mockSearchResponse, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.searchContent(params);

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/search', params);
      expect(result).toEqual(mockSearchResponse);
    });

    test('should validate page parameter is numeric string', async () => {
      await expect(contentService.searchContent({ page: 'invalid' }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.searchContent({ page: 'abc123' }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate page_size is within bounds', async () => {
      await expect(contentService.searchContent({ page_size: 0 }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.searchContent({ page_size: 101 }))
        .rejects.toThrow(APValidationError);

      // Valid page sizes should not throw
      mockHttpClient.get.mockResolvedValueOnce({ data: mockSearchResponse, status: 200, statusText: 'OK', headers: {} });
      await expect(contentService.searchContent({ page_size: 1 })).resolves.toBeDefined();

      mockHttpClient.get.mockResolvedValueOnce({ data: mockSearchResponse, status: 200, statusText: 'OK', headers: {} });
      await expect(contentService.searchContent({ page_size: 100 })).resolves.toBeDefined();
    });

    test('should validate include parameter is array', async () => {
      await expect(contentService.searchContent({ include: 'not-array' as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate exclude parameter is array', async () => {
      await expect(contentService.searchContent({ exclude: 'not-array' as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should handle HTTP client errors', async () => {
      const error = new APAPIError('Search failed', 400, 'SEARCH_ERROR', {});
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await contentService.searchContent().catch(e => e);

      expect(thrownError).toBeInstanceOf(APAPIError);
      expect(thrownError.details.operation).toBe('searchContent');
    });

    test('should handle non-AP errors', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('Generic error'));

      const thrownError = await contentService.searchContent().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.message).toContain('ContentService.searchContent failed');
      expect(thrownError.code).toBe('CONTENT_SERVICE_ERROR');
    });
  });

  describe('getContentItem', () => {
    test('should get content item with valid ID', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ data: mockContentItem, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.getContentItem('123456');

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/123456', {});
      expect(result).toEqual(mockContentItem);
    });

    test('should get content item with parameters', async () => {
      const params = {
        include: ['headline', 'body_text'],
        exclude: ['associations'],
        format: 'nitf'
      };

      mockHttpClient.get.mockResolvedValueOnce({ data: mockContentItem, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.getContentItem('123456', params);

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/123456', params);
      expect(result).toEqual(mockContentItem);
    });

    test('should URL encode item IDs', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ data: mockContentItem, status: 200, statusText: 'OK', headers: {} });

      await contentService.getContentItem('tag:ap.org:2024:123456');

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/tag%3Aap.org%3A2024%3A123456', {});
    });

    test('should validate item ID is required', async () => {
      await expect(contentService.getContentItem(''))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getContentItem(null as any))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getContentItem(undefined as any))
        .rejects.toThrow(APValidationError);
    });

    test('should validate item ID is string', async () => {
      await expect(contentService.getContentItem(123 as any))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getContentItem({ id: '123' } as any))
        .rejects.toThrow(APValidationError);
    });

    test('should validate include parameter is array', async () => {
      await expect(contentService.getContentItem('123', { include: 'not-array' as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate exclude parameter is array', async () => {
      await expect(contentService.getContentItem('123', { exclude: 'not-array' as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate format parameter is string', async () => {
      await expect(contentService.getContentItem('123', { format: 123 as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should handle errors with context', async () => {
      const error = new APAPIError('Item not found', 404, 'NOT_FOUND');
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await contentService.getContentItem('123', { format: 'json' }).catch(e => e);

      expect(thrownError).toBeInstanceOf(APAPIError);
      expect(thrownError.details.operation).toBe('getContentItem');
      expect(thrownError.details.context).toEqual({ itemId: '123', format: 'json' });
    });
  });

  describe('getContentFeed', () => {
    test('should get content feed with no parameters', async () => {
      const mockFeedResponse = { data: { items: [], pagination: {} } };
      mockHttpClient.get.mockResolvedValueOnce({ data: mockFeedResponse, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.getContentFeed();

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/feed', {});
      expect(result).toEqual(mockFeedResponse);
    });

    test('should get content feed with parameters', async () => {
      const params = {
        page_size: 50,
        include: ['headline'],
        exclude: ['body_text'],
        with_monitor: 'tech-monitor',
        pricing: true
      };

      const mockFeedResponse = { data: { items: [] } };
      mockHttpClient.get.mockResolvedValueOnce({ data: mockFeedResponse, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.getContentFeed(params);

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/feed', params);
      expect(result).toEqual(mockFeedResponse);
    });

    test('should validate page_size is within bounds', async () => {
      await expect(contentService.getContentFeed({ page_size: 0 }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getContentFeed({ page_size: 101 }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate include parameter is array', async () => {
      await expect(contentService.getContentFeed({ include: 'not-array' as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate exclude parameter is array', async () => {
      await expect(contentService.getContentFeed({ exclude: 'not-array' as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate with_monitor parameter', async () => {
      // Too short
      await expect(contentService.getContentFeed({ with_monitor: 'abc' }))
        .rejects.toThrow(APValidationError);

      // Too long
      await expect(contentService.getContentFeed({ with_monitor: 'a'.repeat(25) }))
        .rejects.toThrow(APValidationError);

      // Not a string
      await expect(contentService.getContentFeed({ with_monitor: 123 as any }))
        .rejects.toThrow(APValidationError);

      // Valid length should not throw
      const mockFeedResponse = { data: { items: [] } };
      mockHttpClient.get.mockResolvedValueOnce({ data: mockFeedResponse, status: 200, statusText: 'OK', headers: {} });
      await expect(contentService.getContentFeed({ with_monitor: 'valid-monitor' })).resolves.toBeDefined();
    });
  });

  describe('getRSSFeeds', () => {
    test('should get RSS feeds', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ data: mockRSSFeeds, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.getRSSFeeds();

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/rss');
      expect(result).toEqual(mockRSSFeeds);
    });

    test('should handle errors', async () => {
      const error = new APAPIError('RSS feeds not available', 503, 'RSS_ERROR');
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await contentService.getRSSFeeds().catch(e => e);

      expect(thrownError).toBeInstanceOf(APAPIError);
      expect(thrownError.details.operation).toBe('getRSSFeeds');
    });
  });

  describe('getRSSFeed', () => {
    test('should get specific RSS feed', async () => {
      const xmlContent = '<?xml version="1.0"?><rss><channel><item>test</item></channel></rss>';
      mockHttpClient.get.mockResolvedValueOnce({ data: xmlContent, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.getRSSFeed(123);

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/rss/123', {});
      expect(result).toBe(xmlContent);
    });

    test('should get RSS feed with parameters', async () => {
      const xmlContent = '<rss>content</rss>';
      const params = {
        include: ['headline'],
        exclude: ['body_text'],
        page_size: 25
      };

      mockHttpClient.get.mockResolvedValueOnce({ data: xmlContent, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.getRSSFeed(456, params);

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/rss/456', params);
      expect(result).toBe(xmlContent);
    });

    test('should validate RSS ID is positive integer', async () => {
      await expect(contentService.getRSSFeed(0))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getRSSFeed(-1))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getRSSFeed(1.5))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getRSSFeed('123' as any))
        .rejects.toThrow(APValidationError);
    });

    test('should validate RSS parameters', async () => {
      await expect(contentService.getRSSFeed(123, { include: 'not-array' as any }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getRSSFeed(123, { exclude: 'not-array' as any }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getRSSFeed(123, { page_size: 0 }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getRSSFeed(123, { page_size: 101 }))
        .rejects.toThrow(APValidationError);
    });

    test('should handle errors with context', async () => {
      const error = new APAPIError('RSS feed not found', 404, 'NOT_FOUND');
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await contentService.getRSSFeed(999, { page_size: 10 }).catch(e => e);

      expect(thrownError).toBeInstanceOf(APAPIError);
      expect(thrownError.details.context).toEqual({ rssId: 999, page_size: 10 });
    });
  });

  describe('getOnDemandContent', () => {
    test('should get OnDemand content with no parameters', async () => {
      const mockOnDemandResponse = { data: { items: [], pagination: {} } };
      mockHttpClient.get.mockResolvedValueOnce({ data: mockOnDemandResponse, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.getOnDemandContent();

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/ondemand', {});
      expect(result).toEqual(mockOnDemandResponse);
    });

    test('should get OnDemand content with parameters', async () => {
      const params = {
        consumer_id: 'test-consumer',
        queue: 'priority',
        include: ['headline', 'body_text'],
        exclude: ['associations'],
        page_size: 20,
        pricing: true,
        session_label: 'test-session'
      };

      const mockOnDemandResponse = { data: { items: [] } };
      mockHttpClient.get.mockResolvedValueOnce({ data: mockOnDemandResponse, status: 200, statusText: 'OK', headers: {} });

      const result = await contentService.getOnDemandContent(params);

      expect(mockHttpClient.get).toHaveBeenCalledWith('content/ondemand', params);
      expect(result).toEqual(mockOnDemandResponse);
    });

    test('should validate OnDemand parameters', async () => {
      await expect(contentService.getOnDemandContent({ consumer_id: 123 as any }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getOnDemandContent({ queue: 456 as any }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getOnDemandContent({ include: 'not-array' as any }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getOnDemandContent({ exclude: 'not-array' as any }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getOnDemandContent({ page_size: 0 }))
        .rejects.toThrow(APValidationError);

      await expect(contentService.getOnDemandContent({ page_size: 101 }))
        .rejects.toThrow(APValidationError);
    });
  });

  describe('buildSearchQuery static method', () => {
    test('should build simple query', () => {
      const result = ContentService.buildSearchQuery({ query: 'technology' });
      expect(result).toBe('technology');
    });

    test('should build query with media type', () => {
      const result = ContentService.buildSearchQuery({
        query: 'news',
        mediaType: 'picture'
      });
      expect(result).toBe('news AND type:picture');
    });

    test('should build query with date range', () => {
      const result = ContentService.buildSearchQuery({
        query: 'finance',
        dateRange: { start: '2024-01-01', end: '2024-12-31' }
      });
      expect(result).toBe('finance AND firstcreated:[2024-01-01 TO *] AND firstcreated:[* TO 2024-12-31]');
    });

    test('should build query with subjects', () => {
      const result = ContentService.buildSearchQuery({
        query: 'politics',
        subjects: ['elections', 'government']
      });
      expect(result).toBe('politics AND (subject.name:"elections" OR subject.name:"government")');
    });

    test('should build query with locations', () => {
      const result = ContentService.buildSearchQuery({
        query: 'sports',
        locations: ['New York', 'California']
      });
      expect(result).toBe('sports AND (place.name:"New York" OR place.name:"California")');
    });

    test('should build complex query with all filters', () => {
      const result = ContentService.buildSearchQuery({
        query: 'breaking news',
        mediaType: 'text',
        dateRange: { start: '2024-01-01' },
        subjects: ['politics'],
        locations: ['Washington']
      });
      expect(result).toBe('breaking news AND type:text AND firstcreated:[2024-01-01 TO *] AND (subject.name:"politics") AND (place.name:"Washington")');
    });

    test('should handle empty filters', () => {
      const result = ContentService.buildSearchQuery({});
      expect(result).toBe('');
    });

    test('should handle empty arrays', () => {
      const result = ContentService.buildSearchQuery({
        query: 'test',
        subjects: [],
        locations: []
      });
      expect(result).toBe('test');
    });
  });

  describe('extractContentSummary static method', () => {
    test('should extract summary from content item', () => {
      const contentData = {
        item: {
          altids: { itemid: '123456' },
          uri: 'tag:ap.org:2024:123456',
          headline: 'Test News Article',
          title: 'Test Article Title',
          type: 'text',
          versioncreated: '2024-01-15T10:30:00Z',
          firstcreated: '2024-01-15T10:00:00Z',
          description_summary: 'This is a test summary',
          urgency: 3,
          subject: [
            { name: 'politics' },
            { name: 'government' }
          ]
        }
      };

      const result = ContentService.extractContentSummary(contentData);

      expect(result).toEqual({
        id: '123456',
        title: 'Test Article Title',
        headline: 'Test News Article',
        type: 'text',
        publishDate: '2024-01-15T10:30:00Z',
        summary: 'This is a test summary',
        urgency: 3,
        subjects: ['politics', 'government']
      });
    });

    test('should extract summary from direct content (no wrapper)', () => {
      const contentData = {
        altids: { itemid: '789012' },
        uri: 'tag:ap.org:2024:789012',
        headline: 'Direct Content',
        type: 'picture',
        firstcreated: '2024-02-01T15:00:00Z',
        urgency: 2
      };

      const result = ContentService.extractContentSummary(contentData);

      expect(result).toEqual({
        id: '789012',
        title: undefined,
        headline: 'Direct Content',
        type: 'picture',
        publishDate: '2024-02-01T15:00:00Z',
        summary: undefined,
        urgency: 2,
        subjects: []
      });
    });

    test('should use URI as fallback ID', () => {
      const contentData = {
        uri: 'tag:ap.org:2024:fallback',
        headline: 'Fallback ID Test',
        type: 'text'
      };

      const result = ContentService.extractContentSummary(contentData);

      expect(result.id).toBe('tag:ap.org:2024:fallback');
    });

    test('should handle missing subject data', () => {
      const contentData = {
        altids: { itemid: '999' },
        headline: 'No Subjects',
        type: 'text'
      };

      const result = ContentService.extractContentSummary(contentData);

      expect(result.subjects).toEqual([]);
    });

    test('should prefer versioncreated over firstcreated', () => {
      const contentData = {
        altids: { itemid: '111' },
        headline: 'Date Test',
        type: 'text',
        firstcreated: '2024-01-01T10:00:00Z',
        versioncreated: '2024-01-01T12:00:00Z'
      };

      const result = ContentService.extractContentSummary(contentData);

      expect(result.publishDate).toBe('2024-01-01T12:00:00Z');
    });
  });

  describe('Error handling', () => {
    test('should preserve AP error details when wrapping', async () => {
      const originalError = new APAPIError('Original error', 404, 'ORIGINAL_CODE', {
        field: 'test',
        originalContext: 'value'
      });

      mockHttpClient.get.mockRejectedValueOnce(originalError);

      const thrownError = await contentService.searchContent({ q: 'test' }).catch(e => e);

      expect(thrownError).toBeInstanceOf(APAPIError);
      expect(thrownError.message).toBe('Original error');
      expect(thrownError.code).toBe('ORIGINAL_CODE');
      expect(thrownError.statusCode).toBe(404);
      expect(thrownError.details.operation).toBe('searchContent');
      expect(thrownError.details.context).toEqual({ q: 'test' });
      expect(thrownError.details.field).toBe('test');
      expect(thrownError.details.originalContext).toBe('value');
    });

    test('should create new error for non-AP errors', async () => {
      const genericError = new Error('Network timeout');
      mockHttpClient.get.mockRejectedValueOnce(genericError);

      const thrownError = await contentService.getContentFeed().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.code).toBe('CONTENT_SERVICE_ERROR');
      expect(thrownError.message).toContain('ContentService.getContentFeed failed');
      expect(thrownError.details.operation).toBe('getContentFeed');
      expect(thrownError.details.originalError).toBe(genericError);
    });

    test('should handle string errors', async () => {
      mockHttpClient.get.mockRejectedValueOnce('String error');

      const thrownError = await contentService.getRSSFeeds().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.message).toContain('ContentService.getRSSFeeds failed: String error');
    });

    test('should handle null/undefined errors', async () => {
      mockHttpClient.get.mockRejectedValueOnce(null);

      const thrownError = await contentService.getContentItem('123').catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.message).toContain('ContentService.getContentItem failed');
    });
  });

  describe('Enhanced Query Intelligence', () => {
    describe('optimizeSearchQuery', () => {
      test('should optimize natural language query with NLP patterns', async () => {
        const params = {
          natural_query: 'photos of breaking news today',
          suggest_filters: true,
          optimize_for: 'relevance' as const
        };

        const result = await contentService.optimizeSearchQuery(params);

        expect(result).toMatchObject({
          optimized_query: expect.stringMatching(/breaking/),
          original_query: 'photos of breaking news today',
          transformations_applied: expect.objectContaining({
            temporal_filters: expect.arrayContaining(['today']),
            content_type_filters: expect.arrayContaining(['pictures'])
          }),
          confidence_score: expect.any(Number)
        });

        // Verify transformations were applied
        expect(result.optimized_query).toMatch(/firstcreated:\[now-1d TO \*\]/); // Today filter
        expect(result.optimized_query).toMatch(/type:picture/); // Photo filter

        expect(result.confidence_score).toBeGreaterThan(0.2);
        expect(result.confidence_score).toBeLessThanOrEqual(0.95);
      });

      test('should apply content preferences to query optimization', async () => {
        const params = {
          natural_query: 'sports updates', // Use "updates" instead of "news" to avoid NLP conflicts
          content_preferences: {
            preferred_types: ['picture' as const, 'video' as const],
            preferred_subjects: ['basketball', 'football'],
            preferred_locations: ['New York'],
            recency_preference: 'recent' as const
          }
        };

        const result = await contentService.optimizeSearchQuery(params);

        expect(result.optimized_query).toMatch(/sports/); // Base query should contain sports
        expect(result.optimized_query).toMatch(/(type:picture OR type:video)/);
        expect(result.optimized_query).toMatch(/(subject\.name:"basketball" OR subject\.name:"football")/);
        expect(result.optimized_query).toMatch(/place\.name:"New York"/);
        expect(result.optimized_query).toMatch(/firstcreated:\[now-7d TO \*\]/);
      });

      test('should generate suggestions when requested', async () => {
        const params = {
          natural_query: 'news',
          suggest_filters: true
        };

        const result = await contentService.optimizeSearchQuery(params);

        expect(result.suggestions).toBeDefined();
        expect(result.suggestions?.search_tips).toBeInstanceOf(Array);
        expect(result.suggestions?.search_tips?.length).toBeGreaterThan(0);
      });

      test('should not generate suggestions when disabled', async () => {
        const params = {
          natural_query: 'technology updates',
          suggest_filters: false
        };

        const result = await contentService.optimizeSearchQuery(params);

        expect(result.suggestions).toBeUndefined();
      });

      test('should validate required natural_query parameter', async () => {
        await expect(contentService.optimizeSearchQuery({ natural_query: '' }))
          .rejects.toThrow(APValidationError);

        await expect(contentService.optimizeSearchQuery({ natural_query: '   ' }))
          .rejects.toThrow(APValidationError);

        await expect(contentService.optimizeSearchQuery({} as any))
          .rejects.toThrow(APValidationError);
      });

      test('should validate natural_query length', async () => {
        const longQuery = 'a'.repeat(501);

        await expect(contentService.optimizeSearchQuery({ natural_query: longQuery }))
          .rejects.toThrow(APValidationError);
      });

      test('should validate optimize_for parameter', async () => {
        await expect(contentService.optimizeSearchQuery({
          natural_query: 'test',
          optimize_for: 'invalid' as any
        })).rejects.toThrow(APValidationError);
      });

      test('should handle various NLP patterns', async () => {
        const testCases = [
          {
            query: 'videos from yesterday',
            expectedPatterns: { temporal: ['yesterday'], contentType: ['videos'] }
          },
          {
            query: 'breaking news in Washington this week',
            expectedPatterns: { temporal: ['this week'], location: ['Washington'] }
          },
          {
            query: 'photos from last 3 days',
            expectedPatterns: { temporal: ['last 3 days'], contentType: ['pictures'] }
          }
        ];

        for (const testCase of testCases) {
          const result = await contentService.optimizeSearchQuery({
            natural_query: testCase.query
          });

          if (testCase.expectedPatterns.temporal) {
            expect(result.transformations_applied.temporal_filters?.length).toBeGreaterThan(0);
          }
          if (testCase.expectedPatterns.contentType) {
            expect(result.transformations_applied.content_type_filters?.length).toBeGreaterThan(0);
          }
          if (testCase.expectedPatterns.location) {
            expect(result.transformations_applied.location_filters?.length).toBeGreaterThan(0);
          }
        }
      });
    });

    describe('analyzeContentTrends', () => {
      beforeEach(() => {
        // Mock search response for trending analysis
        const mockTrendingSearchResponse = {
          data: {
            total_items: 100,
            items: [
              {
                item: {
                  altids: { itemid: '1' },
                  uri: 'tag:ap.org:2024:1',
                  subject: [
                    { name: 'Politics', code: 'POL001' },
                    { name: 'Elections', code: 'ELE001' }
                  ],
                  place: [{ name: 'Washington' }],
                  firstcreated: new Date().toISOString()
                }
              },
              {
                item: {
                  altids: { itemid: '2' },
                  uri: 'tag:ap.org:2024:2',
                  subject: [
                    { name: 'Technology', code: 'TECH001' }
                  ],
                  place: [{ name: 'California' }],
                  firstcreated: new Date().toISOString()
                }
              },
              {
                item: {
                  altids: { itemid: '3' },
                  uri: 'tag:ap.org:2024:3',
                  subject: [
                    { name: 'Politics', code: 'POL001' }
                  ],
                  place: [{ name: 'New York' }],
                  firstcreated: new Date().toISOString()
                }
              }
            ]
          }
        };

        mockHttpClient.get.mockResolvedValue({
          data: mockTrendingSearchResponse,
          status: 200,
          statusText: 'OK',
          headers: {}
        });
      });

      test('should analyze content trends with default parameters', async () => {
        const result = await contentService.analyzeContentTrends();

        expect(result).toMatchObject({
          timeframe: 'day',
          analysis_period: expect.objectContaining({
            start: expect.any(String),
            end: expect.any(String)
          }),
          trending_topics: expect.any(Array),
          total_content_analyzed: expect.any(Number),
          content_types_analyzed: expect.arrayContaining(['text', 'picture', 'video', 'audio', 'graphic']),
          metrics: expect.objectContaining({
            top_rising_topics: expect.any(Array),
            most_frequent_topics: expect.any(Array)
          })
        });

        expect(result.trending_topics.length).toBeGreaterThan(0);
        expect(result.trending_topics[0]).toMatchObject({
          subject_name: expect.any(String),
          frequency: expect.any(Number),
          trend_direction: expect.stringMatching(/^(rising|stable|declining)$/),
          trend_strength: expect.any(Number),
          sample_content_ids: expect.any(Array)
        });
      });

      test('should analyze trends for specific timeframe', async () => {
        const params = {
          timeframe: 'week' as const,
          max_topics: 5,
          include_metrics: true
        };

        const result = await contentService.analyzeContentTrends(params);

        expect(result.timeframe).toBe('week');
        expect(result.trending_topics.length).toBeLessThanOrEqual(5);

        // Check that the time range is approximately one week
        const startTime = new Date(result.analysis_period.start).getTime();
        const endTime = new Date(result.analysis_period.end).getTime();
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        const timeDiff = endTime - startTime;

        expect(timeDiff).toBeGreaterThan(weekInMs * 0.9); // Allow some variance
        expect(timeDiff).toBeLessThan(weekInMs * 1.1);
      });

      test('should filter by content types', async () => {
        const params = {
          content_types: ['text' as const, 'picture' as const],
          max_topics: 10
        };

        const result = await contentService.analyzeContentTrends(params);

        expect(mockHttpClient.get).toHaveBeenCalledWith('content/search', expect.objectContaining({
          q: expect.stringContaining('(type:text OR type:picture)')
        }));
      });

      test('should apply location and subject filters', async () => {
        const params = {
          location_filter: 'California',
          subject_filter: 'Technology'
        };

        const result = await contentService.analyzeContentTrends(params);

        expect(mockHttpClient.get).toHaveBeenCalledWith('content/search', expect.objectContaining({
          q: expect.stringMatching(/place\.name:"California".*subject\.name:"Technology"|subject\.name:"Technology".*place\.name:"California"/)
        }));
      });

      test('should validate timeframe parameter', async () => {
        await expect(contentService.analyzeContentTrends({ timeframe: 'invalid' as any }))
          .rejects.toThrow(APValidationError);
      });

      test('should validate max_topics bounds', async () => {
        await expect(contentService.analyzeContentTrends({ max_topics: 0 }))
          .rejects.toThrow(APValidationError);

        await expect(contentService.analyzeContentTrends({ max_topics: 51 }))
          .rejects.toThrow(APValidationError);
      });

      test('should validate content_types parameter', async () => {
        await expect(contentService.analyzeContentTrends({ content_types: ['invalid'] as any }))
          .rejects.toThrow(APValidationError);
      });

      test('should handle search errors gracefully', async () => {
        mockHttpClient.get.mockRejectedValueOnce(new APAPIError('Search failed', 500, 'SEARCH_ERROR'));

        await expect(contentService.analyzeContentTrends())
          .rejects.toThrow(APError);
      });
    });

    describe('getContentRecommendations', () => {
      beforeEach(() => {
        // Mock search response for recommendations
        const mockRecommendationSearchResponse = {
          data: {
            total_items: 50,
            items: [
              {
                item: {
                  altids: { itemid: 'rec1' },
                  uri: 'tag:ap.org:2024:rec1',
                  headline: 'Recommended Article 1',
                  title: 'Tech Innovation',
                  type: 'text',
                  firstcreated: new Date().toISOString(),
                  urgency: 3,
                  subject: [
                    { name: 'Technology', code: 'TECH001' },
                    { name: 'Innovation', code: 'INN001' }
                  ],
                  place: [{ name: 'California' }]
                }
              },
              {
                item: {
                  altids: { itemid: 'rec2' },
                  uri: 'tag:ap.org:2024:rec2',
                  headline: 'Recommended Article 2',
                  title: 'Sports Update',
                  type: 'picture',
                  firstcreated: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                  urgency: 2,
                  subject: [
                    { name: 'Sports', code: 'SPORT001' }
                  ],
                  place: [{ name: 'New York' }]
                }
              }
            ]
          }
        };

        mockHttpClient.get.mockResolvedValue({
          data: mockRecommendationSearchResponse,
          status: 200,
          statusText: 'OK',
          headers: {}
        });
      });

      test('should get content recommendations with default parameters', async () => {
        const result = await contentService.getContentRecommendations();

        expect(result).toMatchObject({
          recommendations: expect.any(Array),
          total_recommendations: expect.any(Number),
          search_strategy: expect.any(String),
          filters_applied: expect.any(Array)
        });

        if (result.recommendations.length > 0) {
          expect(result.recommendations[0]).toMatchObject({
            content_id: expect.any(String),
            content_summary: expect.objectContaining({
              title: expect.any(String),
              type: expect.any(String)
            }),
            relevance_score: expect.any(Number),
            recommendation_reason: expect.any(String),
            related_subjects: expect.any(Array),
            similarity_factors: expect.any(Object)
          });
        }
      });

      test('should get recommendations based on seed content', async () => {
        // First mock the getContentItem calls for seed analysis
        const mockSeedContent = {
          data: {
            item: {
              altids: { itemid: 'seed1' },
              uri: 'tag:ap.org:2024:seed1',
              type: 'text',
              subject: [
                { name: 'Technology', code: 'TECH001' },
                { name: 'AI', code: 'AI001' }
              ],
              place: [{ name: 'Silicon Valley' }]
            }
          }
        };

        mockHttpClient.get
          .mockResolvedValueOnce({ data: mockSeedContent, status: 200, statusText: 'OK', headers: {} })
          .mockResolvedValueOnce({
            data: {
              data: {
                total_items: 25,
                items: [
                  {
                    item: {
                      altids: { itemid: 'related1' },
                      uri: 'tag:ap.org:2024:related1',
                      headline: 'AI Development News',
                      type: 'text',
                      firstcreated: new Date().toISOString(),
                      subject: [{ name: 'Technology', code: 'TECH001' }, { name: 'AI', code: 'AI001' }],
                      place: [{ name: 'Silicon Valley' }]
                    }
                  }
                ]
              }
            },
            status: 200,
            statusText: 'OK',
            headers: {}
          });

        const params = {
          seed_content: ['seed1'],
          max_recommendations: 5
        };

        const result = await contentService.getContentRecommendations(params);

        expect(result.seed_analysis).toBeDefined();
        expect(result.seed_analysis?.common_subjects).toContain('Technology');
        expect(result.seed_analysis?.common_subjects).toContain('AI');
        expect(result.seed_analysis?.common_locations).toContain('Silicon Valley');
      });

      test('should filter recommendations by content type and subjects', async () => {
        const params = {
          subjects: ['Technology', 'Science'],
          content_types: ['text' as const, 'video' as const],
          max_recommendations: 10
        };

        const result = await contentService.getContentRecommendations(params);

        expect(mockHttpClient.get).toHaveBeenCalledWith('content/search', expect.objectContaining({
          q: expect.stringMatching(/(subject\.name:"Technology" OR subject\.name:"Science").*\(type:text OR type:video\)|\(type:text OR type:video\).*\(subject\.name:"Technology" OR subject\.name:"Science"\)/)
        }));
      });

      test('should apply recency preference', async () => {
        const params = {
          recency_preference: 'latest' as const
        };

        const result = await contentService.getContentRecommendations(params);

        expect(mockHttpClient.get).toHaveBeenCalledWith('content/search', expect.objectContaining({
          q: expect.stringContaining('firstcreated:[now-1d TO *]')
        }));
      });

      test('should exclude specified content', async () => {
        // Mock recommendations that include the excluded content
        const mockSearchWithExcluded = {
          data: {
            total_items: 3,
            items: [
              {
                item: {
                  altids: { itemid: 'exclude-me' },
                  uri: 'tag:ap.org:2024:exclude-me',
                  headline: 'Should be excluded',
                  type: 'text',
                  firstcreated: new Date().toISOString(),
                  subject: [{ name: 'Technology', code: 'TECH001' }]
                }
              },
              {
                item: {
                  altids: { itemid: 'keep-me' },
                  uri: 'tag:ap.org:2024:keep-me',
                  headline: 'Should be included',
                  type: 'text',
                  firstcreated: new Date().toISOString(),
                  subject: [{ name: 'Technology', code: 'TECH001' }]
                }
              }
            ]
          }
        };

        mockHttpClient.get.mockResolvedValueOnce({
          data: mockSearchWithExcluded,
          status: 200,
          statusText: 'OK',
          headers: {}
        });

        const params = {
          subjects: ['Technology'],
          exclude_seen: ['exclude-me']
        };

        const result = await contentService.getContentRecommendations(params);

        const excludedIds = result.recommendations.map(rec => rec.content_id);
        expect(excludedIds).not.toContain('exclude-me');
        if (result.recommendations.length > 0) {
          expect(excludedIds).toContain('keep-me');
        }
      });

      test('should respect similarity threshold', async () => {
        const params = {
          similarity_threshold: 0.8, // Very high threshold
          subjects: ['Technology']
        };

        const result = await contentService.getContentRecommendations(params);

        // With a high threshold, we might get fewer or no recommendations
        for (const recommendation of result.recommendations) {
          expect(recommendation.relevance_score).toBeGreaterThanOrEqual(0.8);
        }
      });

      test('should validate max_recommendations bounds', async () => {
        await expect(contentService.getContentRecommendations({ max_recommendations: 0 }))
          .rejects.toThrow(APValidationError);

        await expect(contentService.getContentRecommendations({ max_recommendations: 26 }))
          .rejects.toThrow(APValidationError);
      });

      test('should validate similarity_threshold bounds', async () => {
        await expect(contentService.getContentRecommendations({ similarity_threshold: -0.1 }))
          .rejects.toThrow(APValidationError);

        await expect(contentService.getContentRecommendations({ similarity_threshold: 1.1 }))
          .rejects.toThrow(APValidationError);
      });

      test('should validate content_types parameter', async () => {
        await expect(contentService.getContentRecommendations({ content_types: ['invalid'] as any }))
          .rejects.toThrow(APValidationError);
      });

      test('should validate recency_preference parameter', async () => {
        await expect(contentService.getContentRecommendations({ recency_preference: 'invalid' as any }))
          .rejects.toThrow(APValidationError);
      });

      test('should handle seed content analysis errors gracefully', async () => {
        // Mock getContentItem to fail for seed content
        mockHttpClient.get.mockRejectedValueOnce(new APAPIError('Content not found', 404, 'NOT_FOUND'));

        const params = {
          seed_content: ['nonexistent'],
          subjects: ['Technology']
        };

        // Should continue with recommendations even if seed analysis fails
        mockHttpClient.get.mockResolvedValueOnce({
          data: { data: { total_items: 0, items: [] } },
          status: 200,
          statusText: 'OK',
          headers: {}
        });

        const result = await contentService.getContentRecommendations(params);

        expect(result).toBeDefined();
        expect(result.search_strategy).toContain('with specified subjects');
      });

      test('should sort recommendations by relevance score', async () => {
        // Mock response with items that will have different relevance scores
        const mockDiverseItems = {
          data: {
            total_items: 3,
            items: [
              {
                item: {
                  altids: { itemid: 'low-relevance' },
                  uri: 'tag:ap.org:2024:low-relevance',
                  headline: 'Unrelated content',
                  type: 'text',
                  firstcreated: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
                  urgency: 1,
                  subject: [{ name: 'Unrelated', code: 'UNREL001' }]
                }
              },
              {
                item: {
                  altids: { itemid: 'high-relevance' },
                  uri: 'tag:ap.org:2024:high-relevance',
                  headline: 'Highly relevant content',
                  type: 'text',
                  firstcreated: new Date().toISOString(), // Now
                  urgency: 4,
                  subject: [{ name: 'Technology', code: 'TECH001' }]
                }
              }
            ]
          }
        };

        mockHttpClient.get.mockResolvedValueOnce({
          data: mockDiverseItems,
          status: 200,
          statusText: 'OK',
          headers: {}
        });

        const params = {
          subjects: ['Technology'],
          similarity_threshold: 0.1 // Low threshold to include both items
        };

        const result = await contentService.getContentRecommendations(params);

        if (result.recommendations.length >= 2) {
          // Should be sorted by relevance score descending
          expect(result.recommendations[0].relevance_score)
            .toBeGreaterThanOrEqual(result.recommendations[1].relevance_score);
        }
      });
    });

    describe('Bulk Operations & Performance', () => {
      describe('searchContentAll', () => {
        test('should search content with auto-pagination', async () => {
          // Mock first page
          const firstPageResponse = {
            ...mockSearchResponse,
            data: {
              ...mockSearchResponse.data,
              total_items: 150,
              current_item_count: 25,
              current_page: 1,
              page_size: 25,
              items: Array(25).fill(mockContentItem)
            }
          };

          // Mock second page
          const secondPageResponse = {
            ...mockSearchResponse,
            data: {
              ...mockSearchResponse.data,
              total_items: 150,
              current_item_count: 25,
              current_page: 2,
              page_size: 25,
              items: Array(25).fill(mockContentItem)
            }
          };

          mockHttpClient.get
            .mockResolvedValueOnce({ data: firstPageResponse, status: 200, statusText: 'OK', headers: {} })
            .mockResolvedValueOnce({ data: secondPageResponse, status: 200, statusText: 'OK', headers: {} });

          const result = await contentService.searchContentAll({
            q: 'test query',
            max_results: 50,
            deduplicate: false
          });

          expect(result.summary.operation).toBe('search_content_all');
          expect(result.summary.total_results).toBe(50);
          expect(result.summary.pages_fetched).toBe(2);
          expect(result.full_response.items).toHaveLength(50);
          expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
        });

        test('should handle deduplication across pages', async () => {
          const duplicatedItem = { ...mockContentItem, item: { ...mockContentItem.item, altids: { itemid: 'duplicate-123' } } };
          const uniqueItem = { ...mockContentItem, item: { ...mockContentItem.item, altids: { itemid: 'unique-456' } } };

          const firstPageResponse = {
            ...mockSearchResponse,
            data: {
              ...mockSearchResponse.data,
              total_items: 50,
              current_item_count: 25,
              items: [duplicatedItem, uniqueItem, ...Array(23).fill(mockContentItem)]
            }
          };

          const secondPageResponse = {
            ...mockSearchResponse,
            data: {
              ...mockSearchResponse.data,
              total_items: 50,
              current_item_count: 25,
              current_page: 2,
              items: [duplicatedItem, ...Array(24).fill(mockContentItem)] // Same item again
            }
          };

          mockHttpClient.get
            .mockResolvedValueOnce({ data: firstPageResponse, status: 200, statusText: 'OK', headers: {} })
            .mockResolvedValueOnce({ data: secondPageResponse, status: 200, statusText: 'OK', headers: {} });

          const result = await contentService.searchContentAll({
            q: 'test query',
            max_results: 50,
            deduplicate: true
          });

          expect(result.summary.operation).toBe('search_content_all');
          expect(result.summary.total_results).toBeLessThan(50); // Should be deduplicated
        });

        test('should validate max_results parameter', async () => {
          await expect(contentService.searchContentAll({ max_results: 0 }))
            .rejects.toThrow(APValidationError);

          await expect(contentService.searchContentAll({ max_results: 2001 }))
            .rejects.toThrow(APValidationError);
        });

        test('should handle pagination errors gracefully', async () => {
          const firstPageResponse = {
            ...mockSearchResponse,
            data: {
              ...mockSearchResponse.data,
              total_items: 100,
              current_item_count: 25,
              current_page: 1,
              page_size: 25,
              items: Array(25).fill(mockContentItem)
            }
          };

          mockHttpClient.get
            .mockResolvedValueOnce({ data: firstPageResponse, status: 200, statusText: 'OK', headers: {} })
            .mockRejectedValueOnce(new APAPIError('Page 2 failed', 500, 'PAGE_ERROR'));

          const result = await contentService.searchContentAll({
            q: 'test query',
            max_results: 50
          });

          expect(result.summary.total_results).toBe(25); // Only first page succeeded
          expect(result.full_response.errors).toBeDefined();
          expect(result.summary.success_rate).toBeLessThan(1);
        });
      });

      describe('getContentBulk', () => {
        test('should retrieve multiple content items in batches', async () => {
          const itemIds = ['item1', 'item2', 'item3', 'item4', 'item5'];
          const mockItemResponse = { data: mockContentItem };

          // Mock successful responses for all items
          itemIds.forEach(() => {
            mockHttpClient.get.mockResolvedValueOnce({
              data: mockItemResponse,
              status: 200,
              statusText: 'OK',
              headers: {}
            });
          });

          const result = await contentService.getContentBulk({
            item_ids: itemIds,
            batch_size: 2
          });

          expect(result.summary.operation).toBe('get_content_bulk');
          expect(result.summary.total_results).toBe(5);
          expect(result.summary.successful_retrievals).toBe(5);
          expect(result.summary.failed_retrievals).toBe(0);
          expect(result.summary.success_rate).toBe(1);
          expect(result.full_response.items).toHaveLength(5);
          expect(mockHttpClient.get).toHaveBeenCalledTimes(5);
        });

        test('should handle missing items gracefully', async () => {
          const itemIds = ['item1', 'missing-item', 'item3'];
          const mockItemResponse = mockContentItem;

          // Mock specific URLs - note that getContentItem encodes the itemId
          mockHttpClient.get.mockImplementation((url: string) => {
            if (url === 'content/item1') {
              return Promise.resolve({ data: mockItemResponse, status: 200, statusText: 'OK', headers: {} });
            } else if (url === 'content/missing-item') {
              return Promise.reject(new APAPIError('Not found', 404, 'NOT_FOUND'));
            } else if (url === 'content/item3') {
              return Promise.resolve({ data: mockItemResponse, status: 200, statusText: 'OK', headers: {} });
            }
            return Promise.reject(new Error(`Unexpected URL: ${url}`));
          });

          const result = await contentService.getContentBulk({
            item_ids: itemIds,
            fail_on_missing: false,
            batch_size: 1  // Force sequential processing to ensure mock order
          });

          expect(result.summary.successful_retrievals).toBe(2);
          expect(result.summary.failed_retrievals).toBe(1);
          expect(result.full_response.missing_item_ids).toContain('missing-item');
          expect(result.summary.success_rate).toBeCloseTo(0.667, 2);
        });

        test('should fail fast when fail_on_missing is true', async () => {
          const itemIds = ['item1', 'missing-item'];
          const mockItemResponse = mockContentItem;

          // Mock specific URLs - note that getContentItem encodes the itemId
          mockHttpClient.get.mockImplementation((url: string) => {
            if (url === 'content/item1') {
              return Promise.resolve({ data: mockItemResponse, status: 200, statusText: 'OK', headers: {} });
            } else if (url === 'content/missing-item') {
              return Promise.reject(new APAPIError('Not found', 404, 'NOT_FOUND'));
            }
            return Promise.reject(new Error(`Unexpected URL: ${url}`));
          });

          await expect(contentService.getContentBulk({
            item_ids: itemIds,
            fail_on_missing: true,
            batch_size: 1  // Force sequential processing to ensure mock order
          })).rejects.toThrow(APValidationError);
        });

        test('should validate item_ids parameter', async () => {
          await expect(contentService.getContentBulk({ item_ids: [] }))
            .rejects.toThrow(APValidationError);

          await expect(contentService.getContentBulk({ item_ids: Array(51).fill('item') }))
            .rejects.toThrow(APValidationError);

          await expect(contentService.getContentBulk({ item_ids: ['item1', 'item1'] }))
            .rejects.toThrow(APValidationError);
        });

        test('should validate batch_size parameter', async () => {
          await expect(contentService.getContentBulk({
            item_ids: ['item1'],
            batch_size: 0
          })).rejects.toThrow(APValidationError);

          await expect(contentService.getContentBulk({
            item_ids: ['item1'],
            batch_size: 21
          })).rejects.toThrow(APValidationError);
        });
      });

      describe('getTrendingSubjects', () => {
        test('should get trending subjects with default parameters', async () => {
          const mockTrendingResponse = {
            ...mockSearchResponse,
            data: {
              ...mockSearchResponse.data,
              items: [
                {
                  item: {
                    ...mockContentItem.item,
                    subject: [
                      { name: 'Technology', code: 'TECH001' },
                      { name: 'Innovation', code: 'INNOV001' }
                    ]
                  }
                },
                {
                  item: {
                    ...mockContentItem.item,
                    subject: [
                      { name: 'Technology', code: 'TECH001' },
                      { name: 'Business', code: 'BIZ001' }
                    ]
                  }
                }
              ]
            }
          };

          mockHttpClient.get.mockResolvedValueOnce({
            data: mockTrendingResponse,
            status: 200,
            statusText: 'OK',
            headers: {}
          });

          const result = await contentService.getTrendingSubjects();

          expect(result.summary.operation).toBe('get_trending_subjects');
          expect(result.summary.timeframe).toBe('day');
          expect(result.full_response.items).toBeDefined();
          expect(result.full_response.items.length).toBeGreaterThan(0);

          // Technology should appear twice, so it should be the top trending subject
          const topSubject = result.full_response.items[0];
          expect(topSubject.subject_name).toBe('Technology');
          expect(topSubject.frequency).toBe(2);
        });

        test('should filter subjects by minimum frequency', async () => {
          const mockTrendingResponse = {
            ...mockSearchResponse,
            data: {
              ...mockSearchResponse.data,
              items: [
                {
                  item: {
                    ...mockContentItem.item,
                    subject: [
                      { name: 'Popular Topic', code: 'POP001' },
                      { name: 'Rare Topic', code: 'RARE001' }
                    ]
                  }
                },
                {
                  item: {
                    ...mockContentItem.item,
                    subject: [
                      { name: 'Popular Topic', code: 'POP001' }
                    ]
                  }
                },
                {
                  item: {
                    ...mockContentItem.item,
                    subject: [
                      { name: 'Popular Topic', code: 'POP001' }
                    ]
                  }
                }
              ]
            }
          };

          mockHttpClient.get.mockResolvedValueOnce({
            data: mockTrendingResponse,
            status: 200,
            statusText: 'OK',
            headers: {}
          });

          const result = await contentService.getTrendingSubjects({
            min_frequency: 3
          });

          // Only 'Popular Topic' should meet the minimum frequency of 3
          expect(result.full_response.items).toHaveLength(1);
          expect(result.full_response.items[0].subject_name).toBe('Popular Topic');
          expect(result.full_response.items[0].frequency).toBe(3);
        });

        test('should validate timeframe parameter', async () => {
          await expect(contentService.getTrendingSubjects({ timeframe: 'invalid' as any }))
            .rejects.toThrow(APValidationError);
        });

        test('should validate max_subjects parameter', async () => {
          await expect(contentService.getTrendingSubjects({ max_subjects: 0 }))
            .rejects.toThrow(APValidationError);

          await expect(contentService.getTrendingSubjects({ max_subjects: 101 }))
            .rejects.toThrow(APValidationError);
        });

        test('should validate min_frequency parameter', async () => {
          await expect(contentService.getTrendingSubjects({ min_frequency: 0 }))
            .rejects.toThrow(APValidationError);

          await expect(contentService.getTrendingSubjects({ min_frequency: 51 }))
            .rejects.toThrow(APValidationError);
        });

        test('should limit results to max_subjects', async () => {
          const mockTrendingResponse = {
            ...mockSearchResponse,
            data: {
              ...mockSearchResponse.data,
              items: Array(10).fill({
                item: {
                  ...mockContentItem.item,
                  subject: [
                    { name: 'Subject1', code: 'S001' },
                    { name: 'Subject2', code: 'S002' },
                    { name: 'Subject3', code: 'S003' },
                    { name: 'Subject4', code: 'S004' },
                    { name: 'Subject5', code: 'S005' }
                  ]
                }
              })
            }
          };

          mockHttpClient.get.mockResolvedValueOnce({
            data: mockTrendingResponse,
            status: 200,
            statusText: 'OK',
            headers: {}
          });

          const result = await contentService.getTrendingSubjects({
            max_subjects: 3
          });

          expect(result.full_response.items.length).toBeLessThanOrEqual(3);
        });
      });

      describe('Performance and Caching', () => {
        test('should use cache for repeated operations', async () => {
          const mockResponse = { data: mockSearchResponse };
          mockHttpClient.get.mockResolvedValueOnce(mockResponse);

          // First call should hit the API
          const result1 = await contentService.searchContentAll({ q: 'test' });
          expect(mockHttpClient.get).toHaveBeenCalledTimes(1);

          // Second identical call should use cache (no additional API call)
          const result2 = await contentService.searchContentAll({ q: 'test' });
          expect(mockHttpClient.get).toHaveBeenCalledTimes(1); // Still only 1 call
          expect(result2.summary.cache_hits).toBe(1);
        });

        test('should track performance metrics', async () => {
          const mockResponse = { data: mockSearchResponse };
          mockHttpClient.get.mockResolvedValueOnce(mockResponse);

          const result = await contentService.searchContentAll({ q: 'test' });

          expect(result.summary.processing_time_ms).toBeGreaterThanOrEqual(0);
          expect(result.full_response.performance_stats.processing_time_ms).toBeGreaterThanOrEqual(0);
          expect(result.summary.success_rate).toBe(1);
        });

        test('should handle cache misses properly', async () => {
          const mockResponse = { data: mockSearchResponse };
          mockHttpClient.get.mockResolvedValueOnce(mockResponse);

          const result = await contentService.searchContentAll({ q: 'unique-query' });

          expect(result.summary.cache_hits).toBe(0);
          expect(result.full_response.performance_stats.cache_misses).toBe(1);
        });
      });
    });
  });
});
