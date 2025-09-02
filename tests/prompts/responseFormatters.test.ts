import {
  formatSearchResults,
  formatTrendingTopics,
  formatRecommendations,
  formatMonitorResponse,
  formatContentAnalysis,
  createBriefing
} from '../../src/prompts/utils/responseFormatters.js';

describe('responseFormatters', () => {
  describe('formatSearchResults', () => {
    it('should format search results with items', () => {
      const mockResults = {
        data: {
          total: 50,
          items: [
            {
              item_id: 'AP-001',
              headline: 'Breaking News Story',
              summary: 'This is a summary',
              published: '2024-01-15T10:00:00Z',
              byline: 'John Doe',
              source: 'AP',
              urgency: 3
            },
            {
              item_id: 'AP-002',
              headline: 'Another Story',
              summary: 'Another summary',
              published: '2024-01-15T09:00:00Z',
              byline: 'Jane Smith',
              source: 'AP'
            }
          ]
        }
      };

      const result = formatSearchResults(mockResults);
      
      expect(result).toContain('1. Breaking News Story');
      expect(result).toContain('Published:');
      expect(result).toContain('Summary: This is a summary');
      expect(result).toContain('By: John Doe');
      expect(result).toContain('2. Another Story');
      expect(result).toContain('By: Jane Smith');
    });

    it('should handle empty results', () => {
      const mockResults = {
        data: {
          total: 0,
          items: []
        }
      };

      const result = formatSearchResults(mockResults);
      expect(result).toBe('');
    });

    it('should handle null results', () => {
      const result = formatSearchResults(null);
      expect(result).toBe('');
    });

    it('should limit items when maxItems is specified', () => {
      const mockResults = {
        data: {
          total: 10,
          items: [
            { item_id: '1', headline: 'Story 1' },
            { item_id: '2', headline: 'Story 2' },
            { item_id: '3', headline: 'Story 3' },
            { item_id: '4', headline: 'Story 4' },
            { item_id: '5', headline: 'Story 5' }
          ]
        }
      };

      const result = formatSearchResults(mockResults, { maxItems: 2 });
      
      expect(result).toContain('1. Story 1');
      expect(result).toContain('2. Story 2');
      expect(result).not.toContain('3. Story 3');
    });

    it('should include metadata when specified', () => {
      const mockResults = {
        data: {
          total: 100,
          page: 2,
          items: [
            {
              item_id: 'AP-001',
              headline: 'Test Story',
              subject: [
                { name: 'Politics' },
                { name: 'Economy' }
              ]
            }
          ]
        }
      };

      const result = formatSearchResults(mockResults, { includeMetadata: true });
      
      expect(result).toContain('Topics: Politics, Economy');
      expect(result).toContain('--- Search Metadata ---');
      expect(result).toContain('Total Results: 100');
      expect(result).toContain('Page: 2');
      expect(result).toContain('Items Shown: 1');
    });
  });

  describe('formatTrendingTopics', () => {
    it('should format trending topics array', () => {
      const topics = [
        { name: 'Politics', frequency: 150 },
        { name: 'Sports', frequency: 120 },
        { name: 'Technology', frequency: 80 }
      ];

      const result = formatTrendingTopics(topics);
      
      expect(result).toContain('=== Trending Topics ===');
      expect(result).toContain('1. Politics');
      expect(result).toContain('Mentions: 150');
      expect(result).toContain('2. Sports');
      expect(result).toContain('Mentions: 120');
      expect(result).toContain('3. Technology');
      expect(result).toContain('Mentions: 80');
    });

    it('should handle topics with subject field', () => {
      const topics = [
        { subject: 'Breaking News', frequency: 200 }
      ];

      const result = formatTrendingTopics(topics);
      expect(result).toContain('1. Breaking News');
      expect(result).toContain('Mentions: 200');
    });

    it('should handle empty topics array', () => {
      const result = formatTrendingTopics([]);
      expect(result).toBe('No trending topics found.');
    });

    it('should handle null topics', () => {
      const result = formatTrendingTopics(null);
      expect(result).toBe('No trending topics found.');
    });
  });

  describe('formatRecommendations', () => {
    it('should format recommendations with scores', () => {
      const recommendations = [
        {
          item_id: 'REC-001',
          headline: 'Recommended Story 1',
          relevance_score: 0.95,
          summary: 'Summary 1'
        },
        {
          item_id: 'REC-002',
          headline: 'Recommended Story 2',
          relevance_score: 0.87,
          summary: 'Summary 2'
        }
      ];

      const result = formatRecommendations(recommendations);
      
      expect(result).toContain('=== Content Recommendations ===');
      expect(result).toContain('1. Recommended Story 1');
      expect(result).toContain('Relevance: 95.0%');
      expect(result).toContain('2. Recommended Story 2');
      expect(result).toContain('Relevance: 87.0%');
    });

    it('should handle recommendations without scores', () => {
      const recommendations = [
        {
          item_id: 'REC-001',
          headline: 'Story without score',
          summary: 'A summary'
        }
      ];

      const result = formatRecommendations(recommendations);
      expect(result).toContain('Story without score');
      expect(result).not.toContain('Relevance:');
    });

    it('should handle empty recommendations', () => {
      const result = formatRecommendations([]);
      expect(result).toBe('No recommendations available.');
    });
  });

  describe('formatMonitorResponse', () => {
    it('should format monitor creation response', () => {
      const monitor = {
        name: 'Breaking News Monitor',
        description: 'Monitors breaking news',
        conditions: [
          {
            type: 'idleFeed',
            enabled: true,
            criteria: { idleTime: 'PT2H' }
          }
        ],
        notify: [
          {
            channelType: 'email',
            channelDestinations: ['user@example.com']
          }
        ]
      };

      const result = formatMonitorResponse(monitor);
      
      expect(result).toContain('=== Monitor Created Successfully ===');
      expect(result).toContain('Name: Breaking News Monitor');
      expect(result).toContain('Description: Monitors breaking news');
      expect(result).toContain('Conditions:');
      expect(result).toContain('- idleFeed: Enabled');
      expect(result).toContain('Notifications:');
      expect(result).toContain('- email: user@example.com');
    });

    it('should handle monitor without description', () => {
      const monitor = {
        name: 'Simple Monitor',
        conditions: [],
        notify: []
      };

      const result = formatMonitorResponse(monitor);
      expect(result).toContain('Name: Simple Monitor');
      expect(result).not.toContain('Description:');
    });
  });

  describe('formatContentAnalysis', () => {
    it('should format content analysis object', () => {
      const analysis = {
        coverage: {
          'Period 1': 100,
          'Period 2': 150,
          'Change': '+50%'
        },
        sentiment: {
          positive: 60,
          neutral: 30,
          negative: 10
        }
      };

      const result = formatContentAnalysis(analysis);
      
      expect(result).toContain('=== Coverage Analysis ===');
      expect(result).toContain('Period 1: 100');
      expect(result).toContain('Period 2: 150');
      expect(result).toContain('Change: +50%');
      expect(result).toContain('=== Sentiment Analysis ===');
      expect(result).toContain('positive: 60');
    });

    it('should handle analysis with single section', () => {
      const analysis = {
        coverage: {
          total: 500,
          average: 50
        }
      };

      const result = formatContentAnalysis(analysis);
      expect(result).toContain('=== Coverage Analysis ===');
      expect(result).toContain('total: 500');
      expect(result).toContain('average: 50');
    });
  });

  describe('createBriefing', () => {
    it('should create daily briefing with all sections', () => {
      const data = {
        date: new Date('2024-01-15T12:00:00Z'),
        breakingNews: [
          { headline: 'Breaking Story 1' },
          { headline: 'Breaking Story 2' }
        ],
        trending: [
          { name: 'Trending Topic 1', frequency: 100 }
        ],
        recommendations: [
          { headline: 'Recommended Story', relevance_score: 0.9 }
        ]
      };

      const result = createBriefing(data);
      
      expect(result).toContain('=== Daily News Briefing ===');
      expect(result).toContain('Date:');
      expect(result).toContain('📰 BREAKING NEWS');
      expect(result).toContain('1. Breaking Story 1');
      expect(result).toContain('2. Breaking Story 2');
      expect(result).toContain('📈 TRENDING TOPICS');
      expect(result).toContain('1. Trending Topic 1');
      expect(result).toContain('💡 RECOMMENDED READING');
      expect(result).toContain('1. Recommended Story');
    });

    it('should handle briefing with missing sections', () => {
      const data = {
        date: new Date('2024-01-15T12:00:00Z'),
        breakingNews: [
          { headline: 'Only Breaking News' }
        ]
      };

      const result = createBriefing(data);
      
      expect(result).toContain('=== Daily News Briefing ===');
      expect(result).toContain('📰 BREAKING NEWS');
      expect(result).toContain('1. Only Breaking News');
      expect(result).not.toContain('📈 TRENDING TOPICS');
      expect(result).not.toContain('💡 RECOMMENDED READING');
    });

    it('should handle empty briefing data', () => {
      const data = {
        date: new Date('2024-01-15T12:00:00Z')
      };

      const result = createBriefing(data);
      
      expect(result).toContain('=== Daily News Briefing ===');
      expect(result).toContain('Date:');
      expect(result).not.toContain('📰 BREAKING NEWS');
      expect(result).not.toContain('📈 TRENDING TOPICS');
    });
  });
});