import {
  getDateRange,
  buildSearchQuery,
  getOptimalPageSize,
  formatMonitorConditions,
  formatLocation,
  getFieldFilters,
  TRENDING_CATEGORIES,
  CONTENT_TYPES
} from '../../src/prompts/utils/promptHelpers.js';

describe('promptHelpers', () => {
  beforeEach(() => {
    // Mock Date to ensure consistent test results
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getDateRange', () => {
    it('should return date range for hours ago', () => {
      const result = getDateRange(4);
      expect(result.min_date).toBe('2024-01-15T08:00:00.000Z');
      expect(result.max_date).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should return date range for days ago', () => {
      const result = getDateRange(undefined, 7);
      expect(result.min_date).toBe('2024-01-08T12:00:00.000Z');
      expect(result.max_date).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should prefer hours over days when both provided', () => {
      const result = getDateRange(2, 7);
      expect(result.min_date).toBe('2024-01-15T10:00:00.000Z');
      expect(result.max_date).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should return only max_date when no time parameters provided', () => {
      const result = getDateRange();
      expect(result.min_date).toBeUndefined();
      expect(result.max_date).toBe('2024-01-15T12:00:00.000Z');
    });
  });

  describe('buildSearchQuery', () => {
    it('should build basic search query', () => {
      const result = buildSearchQuery({
        topic: 'breaking news',
        locations: ['New York'],
        keywords: ['politics']
      });
      
      expect(result).toContain('breaking news');
      expect(result).toContain('location:"New York"');
      expect(result).toContain('politics');
    });

    it('should handle keywords with AND', () => {
      const result = buildSearchQuery({
        topic: 'news',
        keywords: ['urgent', 'breaking']
      });
      
      expect(result).toContain('news');
      expect(result).toContain('urgent AND breaking');
    });

    it('should handle exclude terms', () => {
      const result = buildSearchQuery({
        topic: 'news',
        exclude: ['sports', 'entertainment']
      });
      
      expect(result).toContain('news');
      expect(result).toContain('-"sports"');
      expect(result).toContain('-"entertainment"');
    });

    it('should handle empty options', () => {
      const result = buildSearchQuery({});
      expect(result).toBe('');
    });

    it('should combine multiple filters', () => {
      const result = buildSearchQuery({
        topic: 'breaking',
        locations: ['London', 'Paris'],
        keywords: ['urgent', 'politics'],
        exclude: ['sports']
      });
      
      expect(result).toContain('breaking');
      expect(result).toContain('(location:"London" OR location:"Paris")');
      expect(result).toContain('urgent AND politics');
      expect(result).toContain('-"sports"');
    });
  });

  describe('getOptimalPageSize', () => {
    it('should return 50 for photo content', () => {
      expect(getOptimalPageSize('photo')).toBe(50);
    });

    it('should return 50 for graphic content', () => {
      expect(getOptimalPageSize('graphic')).toBe(50);
    });

    it('should return 50 for video content', () => {
      expect(getOptimalPageSize('video')).toBe(50);
    });

    it('should return 25 for text content', () => {
      expect(getOptimalPageSize('text')).toBe(25);
    });

    it('should return 25 as default', () => {
      expect(getOptimalPageSize(undefined)).toBe(25);
      expect(getOptimalPageSize('unknown')).toBe(25);
    });
  });

  describe('formatMonitorConditions', () => {
    it('should format idle feed condition', () => {
      const result = formatMonitorConditions('idle', 10);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('idleFeed');
      expect(result[0].enabled).toBe(true);
      expect(result[0].criteria.idleTime).toBe('PT10M');
    });

    it('should format quality condition', () => {
      const result = formatMonitorConditions('quality');
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('quality');
      expect(result[0].enabled).toBe(true);
      expect(result[0].criteria).toEqual({});
    });

    it('should handle both conditions', () => {
      const result = formatMonitorConditions('both', 15);
      
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('idleFeed');
      expect(result[0].criteria.idleTime).toBe('PT15M');
      expect(result[1].type).toBe('quality');
    });

    it('should use default interval when not specified', () => {
      const result = formatMonitorConditions('idle');
      
      expect(result[0].criteria.idleTime).toBe('PT10M');
    });

    it('should return empty array for unknown type', () => {
      const result = formatMonitorConditions('unknown');
      
      expect(result).toEqual([]);
    });
  });


  describe('formatLocation', () => {
    it('should handle city, state format', () => {
      expect(formatLocation('New York, NY')).toBe('New York, NY');
    });

    it('should handle city, country format', () => {
      expect(formatLocation('London, UK')).toBe('London, UK');
    });

    it('should add wildcard for single location names', () => {
      expect(formatLocation('Paris')).toBe('Paris*');
      expect(formatLocation('Tokyo')).toBe('Tokyo*');
    });
  });

  describe('getFieldFilters', () => {
    it('should return minimal fields', () => {
      const filters = getFieldFilters('minimal');
      
      expect(filters.include).toContain('item_id');
      expect(filters.include).toContain('headline');
      expect(filters.include).toHaveLength(4);
      expect(filters.exclude).toContain('renditions');
      expect(filters.exclude).toContain('associations');
    });

    it('should return standard fields', () => {
      const filters = getFieldFilters('standard');
      
      expect(filters.include).toContain('item_id');
      expect(filters.include).toContain('headline');
      expect(filters.include).toContain('summary');
      expect(filters.include).toHaveLength(7);
      expect(filters.exclude).toContain('renditions');
      expect(filters.exclude).not.toContain('associations');
    });

    it('should return detailed fields', () => {
      const filters = getFieldFilters('detailed');
      
      expect(filters.include).toEqual([]);
      expect(filters.exclude).toEqual([]);
    });
  });

  describe('constants', () => {
    it('should export TRENDING_CATEGORIES', () => {
      expect(TRENDING_CATEGORIES).toBeInstanceOf(Array);
      expect(TRENDING_CATEGORIES).toContain('politics');
      expect(TRENDING_CATEGORIES).toContain('business');
      expect(TRENDING_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('should export CONTENT_TYPES', () => {
      expect(CONTENT_TYPES).toBeInstanceOf(Object);
      expect(CONTENT_TYPES.TEXT).toBe('text');
      expect(CONTENT_TYPES.PHOTO).toBe('picture');
      expect(CONTENT_TYPES.VIDEO).toBe('video');
      expect(CONTENT_TYPES.GRAPHIC).toBe('graphic');
      expect(CONTENT_TYPES.AUDIO).toBe('audio');
    });
  });
});