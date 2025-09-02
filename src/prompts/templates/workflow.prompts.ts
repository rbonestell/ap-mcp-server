import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ContentService } from '../../services/ContentService.js';
import { getDateRange, TRENDING_CATEGORIES } from '../utils/promptHelpers.js';
import { createBriefing, formatSearchResults } from '../utils/responseFormatters.js';

export function registerWorkflowPrompts(server: McpServer, contentService: ContentService) {
  // Daily News Briefing Prompt
  server.registerPrompt(
    'daily-news-briefing',
    {
      title: 'Daily News Briefing',
      description: 'Generate a comprehensive daily news briefing with breaking news, trending topics, and recommendations',
      argsSchema: {
        categories: z.array(z.enum(['all', ...TRENDING_CATEGORIES] as [string, ...string[]])).default(['all']).describe('Categories to include'),
        location: z.string().optional().describe('Location focus for the briefing'),
        include_breaking: z.boolean().default(true).describe('Include breaking news section'),
        include_trending: z.boolean().default(true).describe('Include trending topics'),
        include_recommendations: z.boolean().default(true).describe('Include content recommendations')
      }
    },
    async ({ categories, location, include_breaking, include_trending, include_recommendations }) => {
      try {
        const briefingData: any = {
          date: new Date()
        };
        
        // Fetch breaking news if requested
        if (include_breaking) {
          const dateRange = getDateRange(4); // Last 4 hours
          const breakingResults = await contentService.searchContent({
            q: location ? `breaking news ${location}` : 'breaking news',
            ...dateRange,
            page_size: 10,
            sort: 'newest'
          });
          briefingData.breakingNews = breakingResults?.data?.items || [];
        }
        
        // Fetch trending topics if requested
        if (include_trending) {
          const trendParams: any = {
            timeframe: 'day',
            max_subjects: 15,
            min_frequency: 3
          };
          
          if (categories.length > 0 && !categories.includes('all')) {
            trendParams.subject_types = categories;
          }
          
          if (location) {
            trendParams.location_filter = location;
          }
          
          briefingData.trending = await contentService.getTrendingSubjects(trendParams);
        }
        
        // Get content recommendations if requested
        if (include_recommendations) {
          const recParams: any = {
            max_recommendations: 8,
            recency_preference: 'recent'
          };
          
          if (categories.length > 0 && !categories.includes('all')) {
            recParams.subjects = categories;
          }
          
          if (location) {
            recParams.location_preference = location;
          }
          
          briefingData.recommendations = await contentService.getRecommendations(recParams);
        }
        
        const briefing = createBriefing(briefingData);
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: briefing
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error generating briefing: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Research Workflow Prompt
  server.registerPrompt(
    'research-workflow',
    {
      title: 'Research Assistant Workflow',
      description: 'Comprehensive research workflow for investigating a topic',
      argsSchema: {
        topic: z.string().describe('Topic to research'),
        depth: z.enum(['quick', 'standard', 'deep']).default('standard').describe('Research depth'),
        time_range_days: z.number().min(1).max(90).default(30).describe('Days to search back'),
        include_multimedia: z.boolean().default(false).describe('Include photos and videos'),
        include_analysis: z.boolean().default(true).describe('Include analysis pieces')
      }
    },
    async ({ topic, depth, time_range_days, include_multimedia, include_analysis }) => {
      try {
        const sections = [];
        const dateRange = getDateRange(undefined, time_range_days);
        
        // Determine search parameters based on depth
        const depthSettings = {
          quick: { articles: 10, analysis: 5, multimedia: 5 },
          standard: { articles: 25, analysis: 10, multimedia: 10 },
          deep: { articles: 50, analysis: 20, multimedia: 20 }
        };
        
        const settings = depthSettings[depth];
        
        // 1. Recent coverage
        sections.push('=== RECENT COVERAGE ===');
        const recentResults = await contentService.searchContent({
          q: topic,
          ...dateRange,
          page_size: settings.articles,
          sort: 'newest'
        });
        sections.push(formatSearchResults(recentResults, { maxItems: settings.articles }));
        
        // 2. Analysis and opinion pieces
        if (include_analysis) {
          sections.push('\n=== ANALYSIS & OPINION ===');
          const analysisResults = await contentService.searchContent({
            q: `${topic} AND (analysis OR opinion OR editorial OR investigation)`,
            ...dateRange,
            page_size: settings.analysis,
            sort: 'relevance'
          });
          sections.push(formatSearchResults(analysisResults, { maxItems: settings.analysis }));
        }
        
        // 3. Multimedia content
        if (include_multimedia) {
          sections.push('\n=== MULTIMEDIA CONTENT ===');
          const multimediaResults = await contentService.searchContent({
            q: topic,
            ...dateRange,
            page_size: settings.multimedia,
            sort: 'newest',
            type: 'picture' // Search for photos
          });
          sections.push(formatSearchResults(multimediaResults, { maxItems: settings.multimedia }));
        }
        
        // 4. Trending aspects
        sections.push('\n=== RELATED TRENDING TOPICS ===');
        const trending = await contentService.getTrendingSubjects({
          timeframe: 'week',
          max_subjects: 10,
          subject_types: [topic]
        });
        
        if (trending && trending.length > 0) {
          const trendList = trending.map((t: any, i: number) => 
            `${i+1}. ${t.name || t.subject} (${t.frequency || 0} mentions)`
          ).join('\n');
          sections.push(trendList);
        } else {
          sections.push('No specific trending subtopics found.');
        }
        
        // 5. Summary statistics
        const totalArticles = recentResults?.data?.total || 0;
        sections.push(`\n=== RESEARCH SUMMARY ===`);
        sections.push(`Topic: "${topic}"`);
        sections.push(`Time Range: Last ${time_range_days} days`);
        sections.push(`Total Articles Found: ${totalArticles}`);
        sections.push(`Research Depth: ${depth}`);
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: sections.join('\n')
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error in research workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Content Curation Prompt
  server.registerPrompt(
    'content-curation',
    {
      title: 'Content Curation Workflow',
      description: 'Curate content for specific audiences or purposes',
      argsSchema: {
        audience: z.enum(['general', 'business', 'academic', 'youth', 'professional']).describe('Target audience'),
        topics: z.array(z.string()).min(1).max(5).describe('Topics to curate (1-5)'),
        content_mix: z.object({
          news: z.number().min(0).max(100).default(40),
          analysis: z.number().min(0).max(100).default(30),
          features: z.number().min(0).max(100).default(20),
          multimedia: z.number().min(0).max(100).default(10)
        }).describe('Content mix percentages (should total 100)'),
        total_items: z.number().min(10).max(50).default(20).describe('Total items to curate')
      }
    },
    async ({ audience, topics, content_mix, total_items }) => {
      try {
        // Calculate items per category based on mix
        const mixTotal = content_mix.news + content_mix.analysis + content_mix.features + content_mix.multimedia;
        const newsCount = Math.round((content_mix.news / mixTotal) * total_items);
        const analysisCount = Math.round((content_mix.analysis / mixTotal) * total_items);
        const featuresCount = Math.round((content_mix.features / mixTotal) * total_items);
        const multimediaCount = Math.round((content_mix.multimedia / mixTotal) * total_items);
        
        const sections = [];
        const topicQuery = topics.join(' OR ');
        const dateRange = getDateRange(undefined, 7); // Last week
        
        // Adjust search based on audience
        const audienceModifiers = {
          general: '',
          business: ' AND (business OR economy OR market OR finance)',
          academic: ' AND (research OR study OR university OR education)',
          youth: ' AND (youth OR generation OR student OR teen)',
          professional: ' AND (industry OR professional OR career OR executive)'
        };
        
        const audienceMod = audienceModifiers[audience];
        
        sections.push(`=== CURATED CONTENT FOR ${audience.toUpperCase()} AUDIENCE ===`);
        sections.push(`Topics: ${topics.join(', ')}`);
        sections.push(`Content Mix: News ${content_mix.news}% | Analysis ${content_mix.analysis}% | Features ${content_mix.features}% | Multimedia ${content_mix.multimedia}%\n`);
        
        // Fetch news items
        if (newsCount > 0) {
          sections.push('📰 NEWS');
          const newsResults = await contentService.searchContent({
            q: `(${topicQuery})${audienceMod}`,
            ...dateRange,
            page_size: newsCount,
            sort: 'newest'
          });
          sections.push(formatSearchResults(newsResults, { maxItems: newsCount }));
        }
        
        // Fetch analysis
        if (analysisCount > 0) {
          sections.push('\n📊 ANALYSIS & INSIGHTS');
          const analysisResults = await contentService.searchContent({
            q: `(${topicQuery}) AND (analysis OR opinion OR commentary)${audienceMod}`,
            ...dateRange,
            page_size: analysisCount,
            sort: 'relevance'
          });
          sections.push(formatSearchResults(analysisResults, { maxItems: analysisCount }));
        }
        
        // Fetch feature stories
        if (featuresCount > 0) {
          sections.push('\n✨ FEATURE STORIES');
          const featureResults = await contentService.searchContent({
            q: `(${topicQuery}) AND (feature OR profile OR investigation)${audienceMod}`,
            ...dateRange,
            page_size: featuresCount,
            sort: 'relevance'
          });
          sections.push(formatSearchResults(featureResults, { maxItems: featuresCount }));
        }
        
        // Fetch multimedia
        if (multimediaCount > 0) {
          sections.push('\n🎬 MULTIMEDIA');
          const multimediaResults = await contentService.searchContent({
            q: `(${topicQuery})${audienceMod}`,
            ...dateRange,
            page_size: multimediaCount,
            sort: 'newest',
            type: 'picture'
          });
          sections.push(formatSearchResults(multimediaResults, { maxItems: multimediaCount }));
        }
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: sections.join('\n')
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error in content curation: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Story Development Workflow
  server.registerPrompt(
    'story-development',
    {
      title: 'Story Development Helper',
      description: 'Assist in developing a story by finding background, context, and related coverage',
      argsSchema: {
        story_topic: z.string().describe('Main story topic or angle'),
        story_type: z.enum(['news', 'feature', 'investigation', 'profile']).describe('Type of story being developed'),
        needs: z.array(z.enum(['background', 'timeline', 'experts', 'similar_stories', 'data', 'visuals'])).describe('What you need for the story')
      }
    },
    async ({ story_topic, story_type, needs }) => {
      try {
        const sections = [];
        sections.push(`=== STORY DEVELOPMENT ASSISTANT ===`);
        sections.push(`Topic: "${story_topic}"`);
        sections.push(`Story Type: ${story_type}\n`);
        
        // Background research
        if (needs.includes('background')) {
          sections.push('📚 BACKGROUND & CONTEXT');
          const backgroundResults = await contentService.searchContent({
            q: `${story_topic} AND (background OR context OR history OR explainer)`,
            page_size: 10,
            sort: 'relevance'
          });
          sections.push(formatSearchResults(backgroundResults, { maxItems: 5 }));
        }
        
        // Timeline of events
        if (needs.includes('timeline')) {
          sections.push('\n⏱️ TIMELINE OF EVENTS');
          const timelineResults = await contentService.searchContent({
            q: story_topic,
            page_size: 15,
            sort: 'oldest' // Start with oldest for timeline
          });
          sections.push(formatSearchResults(timelineResults, { maxItems: 10 }));
        }
        
        // Expert sources and quotes
        if (needs.includes('experts')) {
          sections.push('\n👥 EXPERT SOURCES & QUOTES');
          const expertResults = await contentService.searchContent({
            q: `${story_topic} AND (expert OR professor OR analyst OR researcher OR "according to")`,
            page_size: 10,
            sort: 'relevance'
          });
          sections.push(formatSearchResults(expertResults, { maxItems: 8 }));
        }
        
        // Similar stories for reference
        if (needs.includes('similar_stories')) {
          sections.push('\n📑 SIMILAR STORIES & APPROACHES');
          const similarResults = await contentService.searchContent({
            q: `${story_topic} AND ${story_type}`,
            page_size: 10,
            sort: 'relevance'
          });
          sections.push(formatSearchResults(similarResults, { maxItems: 8 }));
        }
        
        // Data and statistics
        if (needs.includes('data')) {
          sections.push('\n📊 DATA & STATISTICS');
          const dataResults = await contentService.searchContent({
            q: `${story_topic} AND (data OR statistics OR survey OR poll OR study OR report)`,
            page_size: 10,
            sort: 'relevance'
          });
          sections.push(formatSearchResults(dataResults, { maxItems: 8 }));
        }
        
        // Visual content
        if (needs.includes('visuals')) {
          sections.push('\n📷 VISUAL CONTENT AVAILABLE');
          const visualResults = await contentService.searchContent({
            q: story_topic,
            page_size: 10,
            sort: 'newest',
            type: 'picture'
          });
          sections.push(formatSearchResults(visualResults, { maxItems: 8 }));
        }
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: sections.join('\n')
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error in story development: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );
}