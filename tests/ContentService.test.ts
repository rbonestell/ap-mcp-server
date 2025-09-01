/**
 * Tests for ContentService - Service for AP Content API operations
 * Tests all API methods, parameter validation, and error handling
 */

import { ContentService } from '../src/services/ContentService.js';
import { APHttpClient } from '../src/http/APHttpClient.js';
import { APValidationError, APError, APAPIError } from '../src/errors/APError.js';
import { 
  mockSearchResponse, 
  mockContentItem, 
  mockRSSFeeds, 
  mockAPIError 
} from './fixtures/api-responses.js';

// Mock APHttpClient
jest.mock('../src/http/APHttpClient.js');
const MockAPHttpClient = APHttpClient as jest.MockedClass<typeof APHttpClient>;

describe('ContentService', () => {
  let contentService: ContentService;
  let mockHttpClient: jest.Mocked<APHttpClient>;

  beforeEach(() => {
    mockHttpClient = new MockAPHttpClient({} as any) as jest.Mocked<APHttpClient>;
    contentService = new ContentService(mockHttpClient);
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
      const error = new APAPIError('Search failed', 'SEARCH_ERROR', 400);
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await contentService.searchContent().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
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
      const error = new APAPIError('Item not found', 'NOT_FOUND', 404);
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await contentService.getContentItem('123', { format: 'json' }).catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
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
      const error = new APAPIError('RSS feeds not available', 'RSS_ERROR', 503);
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await contentService.getRSSFeeds().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
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
      const error = new APAPIError('RSS feed not found', 'NOT_FOUND', 404);
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await contentService.getRSSFeed(999, { page_size: 10 }).catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
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

      expect(thrownError).toBeInstanceOf(APError);
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
});