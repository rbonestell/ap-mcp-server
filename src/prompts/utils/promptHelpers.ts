import { z } from 'zod';

/**
 * Helper function to create date range parameters based on relative time
 */
export function getDateRange(hoursAgo?: number, daysAgo?: number): { min_date?: string; max_date?: string } {
  const now = new Date();
  const result: { min_date?: string; max_date?: string } = {};
  
  if (hoursAgo) {
    const minDate = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    result.min_date = minDate.toISOString();
  } else if (daysAgo) {
    const minDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    result.min_date = minDate.toISOString();
  }
  
  result.max_date = now.toISOString();
  return result;
}

/**
 * Build search query with intelligent defaults
 */
export function buildSearchQuery(params: {
  topic?: string;
  keywords?: string[];
  locations?: string[];
  exclude?: string[];
}): string {
  const parts: string[] = [];
  
  if (params.topic) {
    parts.push(params.topic);
  }
  
  if (params.keywords && params.keywords.length > 0) {
    parts.push(params.keywords.join(' AND '));
  }
  
  if (params.locations && params.locations.length > 0) {
    const locationQuery = params.locations.map(loc => `location:"${loc}"`).join(' OR ');
    parts.push(`(${locationQuery})`);
  }
  
  if (params.exclude && params.exclude.length > 0) {
    const excludeQuery = params.exclude.map(term => `-"${term}"`).join(' ');
    parts.push(excludeQuery);
  }
  
  return parts.join(' ');
}

/**
 * Get optimal page size based on content type
 */
export function getOptimalPageSize(contentType?: string): number {
  switch (contentType) {
    case 'photo':
    case 'graphic':
    case 'video':
      return 50; // Larger for media items
    case 'text':
    default:
      return 25; // Standard for text content
  }
}

/**
 * Format monitor conditions based on simplified input
 */
export function formatMonitorConditions(alertType: string, intervalMinutes: number = 10) {
  const conditions = [];
  
  if (alertType === 'idle' || alertType === 'both') {
    conditions.push({
      type: 'idleFeed',
      enabled: true,
      criteria: {
        idleTime: `PT${intervalMinutes}M`
      }
    });
  }
  
  if (alertType === 'quality' || alertType === 'both') {
    conditions.push({
      type: 'quality',
      enabled: true,
      criteria: {}
    });
  }
  
  return conditions;
}

/**
 * Common trending topic categories
 */
export const TRENDING_CATEGORIES = [
  'politics',
  'business',
  'technology',
  'sports',
  'entertainment',
  'health',
  'science',
  'world',
  'national',
  'local'
];

/**
 * Common content types for filtering
 */
export const CONTENT_TYPES = {
  TEXT: 'text',
  PHOTO: 'picture',
  VIDEO: 'video',
  GRAPHIC: 'graphic',
  AUDIO: 'audio'
};

/**
 * Helper to format location strings for AP API
 */
export function formatLocation(location: string): string {
  // Handle common location formats
  if (location.includes(',')) {
    // City, State or City, Country format
    return location.trim();
  }
  
  // Add wildcard for single location names
  return `${location}*`;
}

/**
 * Build include/exclude field arrays based on use case
 */
export function getFieldFilters(useCase: 'minimal' | 'standard' | 'detailed') {
  const includeFields: { [key: string]: string[] } = {
    minimal: ['item_id', 'headline', 'published', 'uri'],
    standard: ['item_id', 'headline', 'published', 'uri', 'subject', 'summary', 'byline'],
    detailed: [] // Include all fields
  };
  
  const excludeFields: { [key: string]: string[] } = {
    minimal: ['renditions', 'associations', 'edit_history'],
    standard: ['renditions', 'edit_history'],
    detailed: [] // Include everything
  };
  
  return {
    include: includeFields[useCase],
    exclude: excludeFields[useCase]
  };
}