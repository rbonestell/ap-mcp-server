/**
 * Tests for response formatters utility for prompts
 * Covers formatting functions for LLM consumption
 */

import {
  formatSearchResults,
  formatTrendingTopics,
  formatRecommendations,
  formatMonitorResponse,
  formatContentAnalysis,
  createBriefing
} from '../src/prompts/utils/responseFormatters.js';

describe('Response Formatters for Prompts', () => {
  describe('formatSearchResults', () => {
    test('should format search results with all fields', () => {
      const results = {
        data: {
          items: [
            {
              headline: 'Breaking News',
              published: '2024-01-15T10:00:00Z',
              summary: 'This is a test summary that is quite long and should be truncated after 200 characters. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
              byline: 'John Doe',
              subject: [{ name: 'Politics' }, { name: 'Economy' }],
              uri: 'ap:12345',
              item_id: 'item-123'
            }
          ],
          total: 100,
          page: 1
        }
      };

      const formatted = formatSearchResults(results);
      
      expect(formatted).toContain('1. Breaking News');
      expect(formatted).toContain('Published:');
      expect(formatted).toContain('Summary:');
      expect(formatted).toContain('By: John Doe');
      expect(formatted).toContain('Topics: Politics, Economy');
      expect(formatted).toContain('ID: item-123');
    });

    test('should handle missing fields gracefully', () => {
      const results = {
        data: {
          items: [
            {
              // Minimal fields
              uri: 'ap:12345'
            }
          ]
        }
      };

      const formatted = formatSearchResults(results);
      
      expect(formatted).toContain('1. No headline');
      expect(formatted).toContain('ID: ap:12345');
      expect(formatted).not.toContain('Published:');
      expect(formatted).not.toContain('Summary:');
      expect(formatted).not.toContain('By:');
      expect(formatted).not.toContain('Topics:');
    });

    test('should respect maxItems option', () => {
      const results = {
        data: {
          items: [
            { headline: 'Item 1', uri: '1' },
            { headline: 'Item 2', uri: '2' },
            { headline: 'Item 3', uri: '3' },
            { headline: 'Item 4', uri: '4' },
            { headline: 'Item 5', uri: '5' }
          ]
        }
      };

      const formatted = formatSearchResults(results, { maxItems: 3 });
      
      expect(formatted).toContain('Item 1');
      expect(formatted).toContain('Item 2');
      expect(formatted).toContain('Item 3');
      expect(formatted).not.toContain('Item 4');
      expect(formatted).not.toContain('Item 5');
    });

    test('should include metadata when requested', () => {
      const results = {
        data: {
          items: [{ headline: 'Test', uri: '1' }],
          total: 50,
          page: 2
        }
      };

      const formatted = formatSearchResults(results, { includeMetadata: true });
      
      expect(formatted).toContain('--- Search Metadata ---');
      expect(formatted).toContain('Total Results: 50');
      expect(formatted).toContain('Page: 2');
      expect(formatted).toContain('Items Shown: 1');
    });

    test('should handle empty results', () => {
      const results = {
        data: {
          items: []
        }
      };

      const formatted = formatSearchResults(results);
      
      expect(formatted).toBe('');
    });

    test('should handle null/undefined data', () => {
      const formatted1 = formatSearchResults({});
      const formatted2 = formatSearchResults({ data: {} });
      const formatted3 = formatSearchResults({ data: { items: null } });
      
      expect(formatted1).toBe('');
      expect(formatted2).toBe('');
      expect(formatted3).toBe('');
    });

    test('should truncate long summaries', () => {
      const longSummary = 'A'.repeat(300);
      const results = {
        data: {
          items: [
            {
              headline: 'Test',
              summary: longSummary,
              uri: '1'
            }
          ]
        }
      };

      const formatted = formatSearchResults(results);
      
      expect(formatted).toContain('A'.repeat(200) + '...');
      expect(formatted).not.toContain('A'.repeat(201));
    });

    test('should handle item without item_id but with uri', () => {
      const results = {
        data: {
          items: [
            {
              headline: 'Test',
              uri: 'ap:uri-only'
              // No item_id field
            }
          ]
        }
      };

      const formatted = formatSearchResults(results);
      
      expect(formatted).toContain('ID: ap:uri-only');
    });

    test('should handle empty subject array', () => {
      const results = {
        data: {
          items: [
            {
              headline: 'Test',
              subject: [],
              uri: '1'
            }
          ]
        }
      };

      const formatted = formatSearchResults(results);
      
      expect(formatted).not.toContain('Topics:');
    });
  });

  describe('formatTrendingTopics', () => {
    test('should format trending topics with all fields', () => {
      const topics = [
        {
          name: 'Elections',
          frequency: 150,
          trend: 'rising',
          category: 'Politics'
        },
        {
          subject: 'Economy',
          frequency: 120,
          trend: 'stable'
        }
      ];

      const formatted = formatTrendingTopics(topics);
      
      expect(formatted).toContain('=== Trending Topics ===');
      expect(formatted).toContain('1. Elections');
      expect(formatted).toContain('Mentions: 150');
      expect(formatted).toContain('Trend: rising');
      expect(formatted).toContain('Category: Politics');
      expect(formatted).toContain('2. Economy');
      expect(formatted).toContain('Mentions: 120');
      expect(formatted).toContain('Trend: stable');
    });

    test('should handle empty topics array', () => {
      const formatted = formatTrendingTopics([]);
      
      expect(formatted).toBe('No trending topics found.');
    });

    test('should handle null/undefined topics', () => {
      const formatted1 = formatTrendingTopics(null as any);
      const formatted2 = formatTrendingTopics(undefined as any);
      
      expect(formatted1).toBe('No trending topics found.');
      expect(formatted2).toBe('No trending topics found.');
    });

    test('should handle topics with missing fields', () => {
      const topics = [
        {}, // Empty object
        { name: 'Test' } // Only name
      ];

      const formatted = formatTrendingTopics(topics);
      
      expect(formatted).toContain('1. Unknown topic');
      expect(formatted).toContain('2. Test');
    });

    test('should prefer name over subject field', () => {
      const topics = [
        {
          name: 'Primary Name',
          subject: 'Fallback Subject'
        }
      ];

      const formatted = formatTrendingTopics(topics);
      
      expect(formatted).toContain('Primary Name');
      expect(formatted).not.toContain('Fallback Subject');
    });
  });

  describe('formatRecommendations', () => {
    test('should format recommendations with all fields', () => {
      const recommendations = [
        {
          headline: 'Recommended Article',
          relevance_score: 0.95,
          reason: 'Related to recent searches',
          summary: 'This is a test summary that should be truncated appropriately to fit within the display limits'
        }
      ];

      const formatted = formatRecommendations(recommendations);
      
      expect(formatted).toContain('=== Content Recommendations ===');
      expect(formatted).toContain('1. Recommended Article');
      expect(formatted).toContain('Relevance: 95.0%');
      expect(formatted).toContain('Why: Related to recent searches');
      expect(formatted).toContain('Summary:');
    });

    test('should handle empty recommendations', () => {
      const formatted = formatRecommendations([]);
      
      expect(formatted).toBe('No recommendations available.');
    });

    test('should handle null/undefined recommendations', () => {
      const formatted1 = formatRecommendations(null as any);
      const formatted2 = formatRecommendations(undefined as any);
      
      expect(formatted1).toBe('No recommendations available.');
      expect(formatted2).toBe('No recommendations available.');
    });

    test('should use title when headline is missing', () => {
      const recommendations = [
        {
          title: 'Title Only',
          relevance_score: 0.8
        }
      ];

      const formatted = formatRecommendations(recommendations);
      
      expect(formatted).toContain('1. Title Only');
    });

    test('should show Untitled when no title or headline', () => {
      const recommendations = [
        {
          relevance_score: 0.7
        }
      ];

      const formatted = formatRecommendations(recommendations);
      
      expect(formatted).toContain('1. Untitled');
    });

    test('should truncate long summaries to 150 chars', () => {
      const longSummary = 'B'.repeat(200);
      const recommendations = [
        {
          headline: 'Test',
          summary: longSummary
        }
      ];

      const formatted = formatRecommendations(recommendations);
      
      expect(formatted).toContain('B'.repeat(150) + '...');
      expect(formatted).not.toContain('B'.repeat(151));
    });
  });

  describe('formatMonitorResponse', () => {
    test('should format monitor response with all fields', () => {
      const monitor = {
        name: 'Breaking News Monitor',
        id: 'mon-123',
        description: 'Monitors breaking news',
        conditions: [
          { type: 'idleFeed', enabled: true },
          { type: 'quality', enabled: false }
        ],
        notify: [
          {
            channelType: 'email',
            channelDestinations: ['user@example.com', 'admin@example.com']
          }
        ]
      };

      const formatted = formatMonitorResponse(monitor);
      
      expect(formatted).toContain('=== Monitor Created Successfully ===');
      expect(formatted).toContain('Name: Breaking News Monitor');
      expect(formatted).toContain('ID: mon-123');
      expect(formatted).toContain('Description: Monitors breaking news');
      expect(formatted).toContain('idleFeed: Enabled');
      expect(formatted).toContain('quality: Disabled');
      expect(formatted).toContain('email: user@example.com, admin@example.com');
    });

    test('should handle monitor with minimal fields', () => {
      const monitor = {
        name: 'Simple Monitor'
      };

      const formatted = formatMonitorResponse(monitor);
      
      expect(formatted).toContain('Name: Simple Monitor');
      expect(formatted).not.toContain('ID:');
      expect(formatted).not.toContain('Description:');
      expect(formatted).not.toContain('Conditions:');
      expect(formatted).not.toContain('Notifications:');
    });

    test('should handle empty conditions array', () => {
      const monitor = {
        name: 'Test',
        conditions: []
      };

      const formatted = formatMonitorResponse(monitor);
      
      expect(formatted).not.toContain('Conditions:');
    });

    test('should handle empty notify array', () => {
      const monitor = {
        name: 'Test',
        notify: []
      };

      const formatted = formatMonitorResponse(monitor);
      
      expect(formatted).not.toContain('Notifications:');
    });
  });

  describe('formatContentAnalysis', () => {
    test('should format comprehensive content analysis', () => {
      const analysis = {
        topStories: [
          { headline: 'Top Story 1', uri: '1' },
          { headline: 'Top Story 2', uri: '2' }
        ],
        trends: [
          { name: 'Trending Topic', frequency: 100 }
        ],
        coverage: {
          'Total Articles': 150,
          'Unique Sources': 25
        },
        sentiment: {
          'Positive': '40%',
          'Neutral': '50%',
          'Negative': '10%'
        }
      };

      const formatted = formatContentAnalysis(analysis);
      
      expect(formatted).toContain('=== Top Stories ===');
      expect(formatted).toContain('Top Story 1');
      expect(formatted).toContain('=== Trending Topics ===');
      expect(formatted).toContain('Trending Topic');
      expect(formatted).toContain('=== Coverage Analysis ===');
      expect(formatted).toContain('Total Articles: 150');
      expect(formatted).toContain('=== Sentiment Analysis ===');
      expect(formatted).toContain('Positive: 40%');
    });

    test('should handle partial analysis data', () => {
      const analysis = {
        topStories: [{ headline: 'Story', uri: '1' }]
        // Missing other fields
      };

      const formatted = formatContentAnalysis(analysis);
      
      expect(formatted).toContain('=== Top Stories ===');
      expect(formatted).not.toContain('=== Trending Topics ===');
      expect(formatted).not.toContain('=== Coverage Analysis ===');
      expect(formatted).not.toContain('=== Sentiment Analysis ===');
    });

    test('should handle empty analysis sections', () => {
      const analysis = {
        topStories: [],
        trends: [],
        coverage: {},
        sentiment: {}
      };

      const formatted = formatContentAnalysis(analysis);
      
      // Empty arrays don't add sections, but empty objects still do
      expect(formatted).not.toContain('=== Top Stories ===');
      expect(formatted).not.toContain('=== Trending Topics ===');
      expect(formatted).toContain('=== Coverage Analysis ===');
      expect(formatted).toContain('=== Sentiment Analysis ===');
    });
  });

  describe('createBriefing', () => {
    test('should create comprehensive briefing', () => {
      const data = {
        breakingNews: [
          { headline: 'Breaking: Major Event', uri: '1' }
        ],
        trending: [
          { name: 'Topic 1', frequency: 100 }
        ],
        recommendations: [
          { headline: 'Recommended Read', relevance_score: 0.9 }
        ],
        date: new Date('2024-01-15T10:00:00Z')
      };

      const briefing = createBriefing(data);
      
      expect(briefing).toContain('=== Daily News Briefing ===');
      expect(briefing).toContain('Date:');
      expect(briefing).toContain('Time:');
      expect(briefing).toContain('📰 BREAKING NEWS');
      expect(briefing).toContain('Breaking: Major Event');
      expect(briefing).toContain('📈 TRENDING TOPICS');
      expect(briefing).toContain('Topic 1');
      expect(briefing).toContain('💡 RECOMMENDED READING');
      expect(briefing).toContain('Recommended Read');
    });

    test('should handle briefing with no data', () => {
      const briefing = createBriefing({});
      
      expect(briefing).toContain('=== Daily News Briefing ===');
      expect(briefing).toContain('Date:');
      expect(briefing).toContain('Time:');
      expect(briefing).not.toContain('BREAKING NEWS');
      expect(briefing).not.toContain('TRENDING TOPICS');
      expect(briefing).not.toContain('RECOMMENDED READING');
    });

    test('should limit items per section', () => {
      const data = {
        breakingNews: Array(10).fill({ headline: 'News', uri: '1' }),
        trending: Array(15).fill({ name: 'Topic' }),
        recommendations: Array(10).fill({ headline: 'Rec' })
      };

      const briefing = createBriefing(data);
      
      // Should only show first 5 breaking news
      const breakingMatches = briefing.match(/\d+\. News/g);
      expect(breakingMatches?.length).toBe(5);
      
      // Should show 10 trending topics
      const trendingMatches = briefing.match(/\d+\. Topic/g);
      expect(trendingMatches?.length).toBe(10);
      
      // Should show 5 recommendations
      const recMatches = briefing.match(/\d+\. Rec/g);
      expect(recMatches?.length).toBe(5);
    });

    test('should use current date when not provided', () => {
      const briefing = createBriefing({ breakingNews: [] });
      const today = new Date();
      
      expect(briefing).toContain(today.toLocaleDateString());
    });

    test('should handle empty arrays', () => {
      const data = {
        breakingNews: [],
        trending: [],
        recommendations: []
      };

      const briefing = createBriefing(data);
      
      expect(briefing).not.toContain('BREAKING NEWS');
      expect(briefing).not.toContain('TRENDING TOPICS');
      expect(briefing).not.toContain('RECOMMENDED READING');
    });
  });
});