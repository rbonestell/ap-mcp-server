import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ContentService } from '../../services/ContentService.js';
import { TRENDING_CATEGORIES } from '../utils/promptHelpers.js';
import { 
  formatTrendingTopics, 
  formatRecommendations, 
  formatContentAnalysis 
} from '../utils/responseFormatters.js';

export function registerAnalysisPrompts(server: McpServer, contentService: ContentService) {
  // Trend Analysis Prompt
  server.registerPrompt(
    'trend-analysis',
    {
      title: 'Trend Analysis',
      description: 'Analyze trending topics and patterns in news coverage',
      argsSchema: {
        category: z.enum(['all', ...TRENDING_CATEGORIES] as [string, ...string[]]).default('all').describe('Category to analyze'),
        timeframe: z.enum(['hour', 'day', 'week']).default('day').describe('Time period for trend analysis'),
        location_filter: z.string().optional().describe('Filter trends by location'),
        include_sentiment: z.boolean().default(false).describe('Include sentiment analysis'),
        max_topics: z.number().min(5).max(50).default(20).describe('Maximum trending topics to return')
      }
    },
    async ({ category, timeframe, location_filter, include_sentiment, max_topics }) => {
      try {
        const params: any = {
          timeframe,
          max_topics
        };
        
        if (category !== 'all') {
          params.subject_filter = category;
        }
        
        if (location_filter) {
          params.location_filter = location_filter;
        }
        
        if (include_sentiment) {
          params.include_metrics = true;
        }
        
        const trends = await contentService.analyzeTrends(params);
        
        const formattedTrends = formatTrendingTopics(trends);
        
        const header = `=== Trend Analysis ===\nCategory: ${category}\nTimeframe: ${timeframe}\n${location_filter ? `Location: ${location_filter}\n` : ''}\n`;
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: header + formattedTrends
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error analyzing trends: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Content Recommendations Prompt
  server.registerPrompt(
    'content-recommendations',
    {
      title: 'Content Recommendations',
      description: 'Get AI-powered content recommendations based on topics or past content',
      argsSchema: {
        based_on: z.string().optional().describe('Topic or content ID to base recommendations on'),
        subjects: z.array(z.string()).optional().describe('Subject preferences'),
        content_types: z.array(z.enum(['text', 'photo', 'video', 'graphic', 'audio'])).optional().describe('Preferred content types'),
        location_preference: z.string().optional().describe('Preferred location for content'),
        max_recommendations: z.number().min(5).max(25).default(10).describe('Number of recommendations')
      }
    },
    async ({ based_on, subjects, content_types, location_preference, max_recommendations }) => {
      try {
        const params: any = {
          max_recommendations
        };
        
        if (based_on) {
          // If it looks like a content ID, use as seed
          if (based_on.includes(':') || based_on.length > 20) {
            params.seed_content = [based_on];
          } else {
            // Otherwise treat as subject
            params.subjects = [based_on];
          }
        }
        
        if (subjects && subjects.length > 0) {
          params.subjects = subjects;
        }
        
        if (content_types && content_types.length > 0) {
          params.content_types = content_types;
        }
        
        if (location_preference) {
          params.location_preference = location_preference;
        }
        
        const recommendations = await contentService.getRecommendations(params);
        
        const formattedRecs = formatRecommendations(recommendations);
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: formattedRecs
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error getting recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Coverage Comparison Prompt
  server.registerPrompt(
    'coverage-comparison',
    {
      title: 'Coverage Comparison',
      description: 'Compare news coverage across different time periods or topics',
      argsSchema: {
        topic: z.string().describe('Topic to analyze'),
        period1_days_ago: z.number().min(1).max(30).describe('Start of first period (days ago)'),
        period2_days_ago: z.number().min(1).max(30).describe('Start of second period (days ago)'),
        period_length_days: z.number().min(1).max(7).default(3).describe('Length of each period in days'),
        metrics: z.array(z.enum(['volume', 'sentiment', 'sources', 'locations'])).default(['volume', 'sources']).describe('Metrics to compare')
      }
    },
    async ({ topic, period1_days_ago, period2_days_ago, period_length_days, metrics }) => {
      try {
        // Search for period 1
        const period1Start = new Date();
        period1Start.setDate(period1Start.getDate() - period1_days_ago);
        const period1End = new Date(period1Start);
        period1End.setDate(period1End.getDate() + period_length_days);
        
        const results1 = await contentService.searchContent({
          q: topic,
          min_date: period1Start.toISOString(),
          max_date: period1End.toISOString(),
          page_size: 100
        });
        
        // Search for period 2
        const period2Start = new Date();
        period2Start.setDate(period2Start.getDate() - period2_days_ago);
        const period2End = new Date(period2Start);
        period2End.setDate(period2End.getDate() + period_length_days);
        
        const results2 = await contentService.searchContent({
          q: topic,
          min_date: period2Start.toISOString(),
          max_date: period2End.toISOString(),
          page_size: 100
        });
        
        // Analyze and compare
        const comparison: any = {
          coverage: {
            [`Period 1 (${period1_days_ago} days ago)`]: results1?.data?.total || 0,
            [`Period 2 (${period2_days_ago} days ago)`]: results2?.data?.total || 0,
            'Change': `${((results2?.data?.total || 0) - (results1?.data?.total || 0))} articles`
          }
        };
        
        if (metrics.includes('sources')) {
          const sources1 = new Set(results1?.data?.items?.map((i: any) => i.source) || []);
          const sources2 = new Set(results2?.data?.items?.map((i: any) => i.source) || []);
          comparison.coverage['Unique Sources Period 1'] = sources1.size;
          comparison.coverage['Unique Sources Period 2'] = sources2.size;
        }
        
        if (metrics.includes('locations')) {
          const locations1 = new Set(results1?.data?.items?.flatMap((i: any) => i.locations || []) || []);
          const locations2 = new Set(results2?.data?.items?.flatMap((i: any) => i.locations || []) || []);
          comparison.coverage['Locations Covered Period 1'] = locations1.size;
          comparison.coverage['Locations Covered Period 2'] = locations2.size;
        }
        
        const formattedAnalysis = formatContentAnalysis(comparison);
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Coverage Comparison: "${topic}"\n\n${formattedAnalysis}`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error comparing coverage: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Quick Trending Topics Prompt
  server.registerPrompt(
    'quick-trending',
    {
      title: 'Quick Trending Topics',
      description: 'Get a quick snapshot of what\'s trending right now',
      argsSchema: {
        max_topics: z.number().min(5).max(20).default(10).describe('Number of topics to show')
      }
    },
    async ({ max_topics }) => {
      try {
        const trending = await contentService.getTrendingSubjects({
          timeframe: 'hour',
          max_subjects: max_topics,
          min_frequency: 2
        });
        
        const formattedTrends = formatTrendingTopics(trending);
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `🔥 Trending Right Now:\n\n${formattedTrends}`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error fetching trending topics: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );
}