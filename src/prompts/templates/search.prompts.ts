import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ContentService } from '../../services/ContentService.js';
import { 
  buildSearchQuery, 
  getDateRange, 
  getOptimalPageSize, 
  formatLocation,
  getFieldFilters,
  CONTENT_TYPES 
} from '../utils/promptHelpers.js';
import { formatSearchResults } from '../utils/responseFormatters.js';

export function registerSearchPrompts(server: McpServer, contentService: ContentService) {
  // Breaking News Search Prompt
  server.registerPrompt(
    'breaking-news-search',
    {
      title: 'Breaking News Search',
      description: 'Search for the latest breaking news on a specific topic or globally',
      argsSchema: {
        topic: z.string().optional().describe('Topic to search for (optional, defaults to all breaking news)'),
        hours_ago: z.number().min(1).max(24).default(2).describe('How many hours back to search (1-24)'),
        location: z.string().optional().describe('Location filter (e.g., "Washington", "London", "Asia")'),
        max_results: z.number().min(5).max(50).default(10).describe('Maximum number of results to return')
      }
    },
    async ({ topic, hours_ago, location, max_results }) => {
      const query = buildSearchQuery({
        topic,
        keywords: ['breaking', 'urgent', 'latest'],
        locations: location ? [formatLocation(location)] : undefined
      });
      
      const dateRange = getDateRange(hours_ago);
      const fields = getFieldFilters('standard');
      
      try {
        const results = await contentService.searchContent({
          q: query,
          ...dateRange,
          page_size: max_results,
          sort: 'newest',
          ...fields
        });
        
        const formattedResults = formatSearchResults(results, {
          includeMetadata: true,
          maxItems: max_results
        });
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Breaking News Search Results (Last ${hours_ago} hours):\n\n${formattedResults}`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error searching for breaking news: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Topic Deep Dive Prompt
  server.registerPrompt(
    'topic-deep-dive',
    {
      title: 'Topic Deep Dive',
      description: 'Comprehensive search for in-depth coverage of a specific topic',
      argsSchema: {
        topic: z.string().describe('Topic to research in depth'),
        days_back: z.number().min(1).max(30).default(7).describe('Number of days to search back (1-30)'),
        min_word_count: z.number().min(100).default(500).describe('Minimum word count for articles'),
        include_analysis: z.boolean().default(true).describe('Include analysis and opinion pieces'),
        max_results: z.number().min(10).max(100).default(25).describe('Maximum results to return')
      }
    },
    async ({ topic, days_back, min_word_count, include_analysis, max_results }) => {
      const keywords = include_analysis 
        ? [topic, '(analysis OR opinion OR editorial OR investigation)']
        : [topic];
      
      const query = buildSearchQuery({ keywords });
      const dateRange = getDateRange(undefined, days_back);
      const fields = getFieldFilters('detailed');
      
      try {
        const results = await contentService.searchContent({
          q: query,
          ...dateRange,
          page_size: max_results,
          sort: 'relevance',
          ...fields
        });
        
        // Filter by word count if possible
        if (results?.data?.items) {
          results.data.items = results.data.items.filter((item: any) => {
            const wordCount = item.word_count || (item.body_text?.split(' ').length || 0);
            return wordCount >= min_word_count;
          });
        }
        
        const formattedResults = formatSearchResults(results, {
          includeMetadata: true
        });
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Deep Dive: "${topic}" (Last ${days_back} days, ${min_word_count}+ words):\n\n${formattedResults}`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error performing deep dive search: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Multimedia Search Prompt
  server.registerPrompt(
    'multimedia-search',
    {
      title: 'Multimedia Content Search',
      description: 'Search specifically for photos, videos, graphics, and audio content',
      argsSchema: {
        topic: z.string().describe('Topic or keywords to search'),
        media_type: z.enum(['photo', 'video', 'graphic', 'audio', 'all']).default('all').describe('Type of media to search for'),
        days_back: z.number().min(1).max(90).default(7).describe('Days to search back'),
        high_quality_only: z.boolean().default(true).describe('Filter for high-quality/professional content only'),
        max_results: z.number().min(10).max(100).default(30).describe('Maximum results')
      }
    },
    async ({ topic, media_type, days_back, high_quality_only, max_results }) => {
      const query = buildSearchQuery({
        topic,
        keywords: high_quality_only ? ['professional', 'high-resolution'] : undefined
      });
      
      const dateRange = getDateRange(undefined, days_back);
      const fields = getFieldFilters('standard');
      
      // Map media_type to AP API format
      const typeFilter = media_type === 'all' ? undefined : {
        type: media_type === 'photo' ? CONTENT_TYPES.PHOTO :
              media_type === 'video' ? CONTENT_TYPES.VIDEO :
              media_type === 'graphic' ? CONTENT_TYPES.GRAPHIC :
              CONTENT_TYPES.AUDIO
      };
      
      try {
        const results = await contentService.searchContent({
          q: query,
          ...dateRange,
          ...typeFilter,
          page_size: max_results,
          sort: 'newest',
          ...fields
        });
        
        const formattedResults = formatSearchResults(results, {
          includeMetadata: true
        });
        
        const mediaTypeLabel = media_type === 'all' ? 'All Media Types' : media_type.toUpperCase();
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Multimedia Search: "${topic}" (${mediaTypeLabel}, Last ${days_back} days):\n\n${formattedResults}`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error searching multimedia content: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Regional Coverage Prompt
  server.registerPrompt(
    'regional-coverage',
    {
      title: 'Regional News Coverage',
      description: 'Get comprehensive news coverage for a specific region or location',
      argsSchema: {
        location: z.string().describe('Location/region (e.g., "California", "Europe", "Tokyo")'),
        include_national: z.boolean().default(true).describe('Include national news affecting the region'),
        include_local: z.boolean().default(true).describe('Include local news from the region'),
        days_back: z.number().min(1).max(7).default(3).describe('Days to search back'),
        max_results: z.number().min(10).max(50).default(20).describe('Maximum results')
      }
    },
    async ({ location, include_national, include_local, days_back, max_results }) => {
      const keywords = [];
      if (include_national) keywords.push('national');
      if (include_local) keywords.push('local');
      
      const query = buildSearchQuery({
        locations: [formatLocation(location)],
        keywords: keywords.length > 0 ? keywords : undefined
      });
      
      const dateRange = getDateRange(undefined, days_back);
      const fields = getFieldFilters('standard');
      
      try {
        const results = await contentService.searchContent({
          q: query,
          ...dateRange,
          page_size: max_results,
          sort: 'newest',
          ...fields
        });
        
        const formattedResults = formatSearchResults(results, {
          includeMetadata: true
        });
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Regional Coverage for ${location} (Last ${days_back} days):\n\n${formattedResults}`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error searching regional coverage: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Smart Search Assistant Prompt
  server.registerPrompt(
    'smart-search',
    {
      title: 'Smart Search Assistant',
      description: 'Intelligently search AP content with natural language queries',
      argsSchema: {
        query: z.string().describe('Natural language search query'),
        search_mode: z.enum(['fast', 'comprehensive', 'archive']).default('fast').describe('Search mode'),
        auto_expand: z.boolean().default(true).describe('Automatically expand search if few results found')
      }
    },
    async ({ query, search_mode, auto_expand }) => {
      // Determine search parameters based on mode
      const searchParams = {
        fast: { page_size: 10, days_back: 3, sort: 'newest' },
        comprehensive: { page_size: 50, days_back: 30, sort: 'relevance' },
        archive: { page_size: 100, days_back: 365, sort: 'relevance' }
      }[search_mode];
      
      const dateRange = getDateRange(undefined, searchParams.days_back);
      const fields = getFieldFilters(search_mode === 'fast' ? 'minimal' : 'standard');
      
      try {
        let results = await contentService.searchContent({
          q: query,
          ...dateRange,
          page_size: searchParams.page_size,
          sort: searchParams.sort,
          ...fields
        });
        
        // Auto-expand search if needed
        if (auto_expand && results?.data?.total < 5 && search_mode !== 'archive') {
          // Try broader search
          const broaderQuery = query.split(' ').slice(0, 2).join(' ');
          results = await contentService.searchContent({
            q: broaderQuery,
            ...dateRange,
            page_size: searchParams.page_size * 2,
            sort: searchParams.sort,
            ...fields
          });
        }
        
        const formattedResults = formatSearchResults(results, {
          includeMetadata: true
        });
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Smart Search Results (Mode: ${search_mode}):\nQuery: "${query}"\n\n${formattedResults}`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error performing smart search: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );
}