import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { APConfigManager } from '../config/APConfig.js';
import { ErrorHandler } from '../errors/APError.js';
import { APHttpClient } from '../http/APHttpClient.js';
import { ConnectionPool } from '../http/ConnectionPool.js';
import { AccountService } from '../services/AccountService.js';
import { ContentService } from '../services/ContentService.js';
import { MonitoringService } from '../services/MonitoringService.js';
import { registerAPPrompts } from '../prompts/APPrompts.js';

// Define Zod schemas for all tools
const SearchContentSchema = z.object({
  q: z.string().optional().describe('Search query string'),
  include: z.array(z.string()).optional().describe('Fields to include in response'),
  exclude: z.array(z.string()).optional().describe('Fields to exclude from response'),
  sort: z.string().optional().describe('Sort order'),
  page: z.string().optional().describe('Page number (as string)'),
  page_size: z.number().min(1).max(100).optional().describe('Number of items per page (1-100)'),
  pricing: z.boolean().optional().describe('Include pricing information'),
  in_my_plan: z.boolean().optional().describe('Only show content in your plan'),
  session_label: z.string().optional().describe('Session label for tracking'),
});

const GetContentItemSchema = z.object({
  item_id: z.string().describe('The unique identifier for the content item'),
  include: z.array(z.string()).optional().describe('Fields to include in response'),
  exclude: z.array(z.string()).optional().describe('Fields to exclude from response'),
  pricing: z.boolean().optional().describe('Include pricing information'),
  in_my_plan: z.boolean().optional().describe('Only show if in your plan'),
  format: z.string().optional().describe('Response format'),
});

const GetContentFeedSchema = z.object({
  q: z.string().optional().describe('Filter query string'),
  include: z.array(z.string()).optional().describe('Fields to include in response'),
  exclude: z.array(z.string()).optional().describe('Fields to exclude from response'),
  page_size: z.number().min(1).max(100).optional().describe('Number of items per page (1-100)'),
  pricing: z.boolean().optional().describe('Include pricing information'),
  in_my_plan: z.boolean().optional().describe('Only show content in your plan'),
  with_monitor: z.string().min(4).max(24).regex(/^[a-zA-Z0-9_.-]*$/).optional().describe('Monitor name to associate with feed'),
  session_label: z.string().optional().describe('Session label for tracking'),
  filter_out: z.string().optional().describe('Content to filter out'),
});

const GetAccountPlansSchema = z.object({
  include: z.array(z.string()).optional().describe('Fields to include in response'),
  exclude: z.array(z.string()).optional().describe('Fields to exclude from response'),
  format: z.enum(['json', 'csv']).optional().describe('Response format'),
});

const GetAccountDownloadsSchema = z.object({
  include: z.array(z.string()).optional().describe('Fields to include in response'),
  exclude: z.array(z.string()).optional().describe('Fields to exclude from response'),
  format: z.enum(['json', 'csv']).optional().describe('Response format'),
  min_date: z.string().optional().describe('Minimum date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss or ISO-8601 duration)'),
  max_date: z.string().optional().describe('Maximum date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss or ISO-8601 duration)'),
  order: z.number().min(1).optional().describe('Sort order (positive integer)'),
});

const GetRSSFeedSchema = z.object({
  rss_id: z.number().min(1).describe('RSS feed ID (positive integer)'),
  include: z.array(z.string()).optional().describe('Fields to include in response'),
  exclude: z.array(z.string()).optional().describe('Fields to exclude from response'),
  page_size: z.number().min(1).max(100).optional().describe('Number of items per page (1-100)'),
});

const CreateMonitorSchema = z.object({
  name: z.string().min(1).max(20).regex(/^[a-zA-Z0-9_.-]*$/).describe('Monitor name (1-20 chars, alphanumeric, underscore, dot, hyphen only)'),
  description: z.string().optional().describe('Monitor description'),
  notify: z.array(z.object({
    channelType: z.enum(['email']),
    channelDestinations: z.array(z.string().email()).min(1),
  })).min(1).max(5).describe('Notification settings (1-5 channels)'),
  conditions: z.array(z.object({
    type: z.enum(['idleFeed', 'quality']),
    enabled: z.boolean(),
    criteria: z.object({
      idleTime: z.string().regex(/^PT\d*[MH]$/).optional().describe('Idle time in ISO-8601 duration format (PT2M to PT12H)'),
    }),
  })).min(1).max(5).describe('Monitor conditions (1-5 conditions)'),
  playbook: z.string().optional().describe('Instructions for when monitor triggers'),
  repeatAlerts: z.string().regex(/^(0|PT\d*[MH])$/).optional().describe('Repeat interval in ISO-8601 duration format (PT10M, PT2H) or "0" to disable'),
});

const GetMonitorSchema = z.object({
  monitor_id: z.string().min(1).describe('Monitor ID or name'),
});

const UpdateMonitorSchema = z.object({
  monitor_id: z.string().min(1).describe('Monitor ID or name'),
  name: z.string().min(1).max(20).regex(/^[a-zA-Z0-9_.-]*$/).describe('Monitor name (1-20 chars, alphanumeric, underscore, dot, hyphen only)'),
  description: z.string().optional().describe('Monitor description'),
  notify: z.array(z.object({
    channelType: z.enum(['email']),
    channelDestinations: z.array(z.string().email()).min(1),
  })).min(1).max(5).describe('Notification channels (1-5 channels)'),
  conditions: z.array(z.object({
    type: z.enum(['idleFeed', 'quality']).describe('Condition type'),
    enabled: z.boolean().describe('Whether condition is enabled'),
    criteria: z.object({
      idleTime: z.string().regex(/^PT\d*[MH]$/).optional().describe('Idle time in ISO-8601 duration format (PT2M to PT12H)'),
    }),
  })).min(1).max(5).describe('Monitor conditions (1-5 conditions)'),
  playbook: z.string().optional().describe('Instructions for when monitor triggers'),
  repeatAlerts: z.string().regex(/^(0|PT\d*[MH])$/).optional().describe('Repeat interval in ISO-8601 duration format (PT10M, PT2H) or "0" to disable'),
});

const GetMonitorStatusSchema = z.object({
  monitor_id: z.string().min(1).describe('Monitor ID or name'),
  agentid: z.string().optional().describe('Agent ID filter'),
  show_detail: z.boolean().optional().describe('Show detailed information'),
});

const GetMonitorHistorySchema = z.object({
  monitor_id: z.string().min(1).describe('Monitor ID or name'),
  agentid: z.string().optional().describe('Agent ID filter'),
  min_date: z.string().optional().describe('Minimum date filter'),
  max_date: z.string().optional().describe('Maximum date filter'),
  page: z.string().optional().describe('Page number (as string)'),
  page_size: z.number().min(1).max(100).optional().describe('Number of items per page (1-100)'),
  show_detail: z.boolean().optional().describe('Show detailed information'),
});

const GetFollowedTopicsSchema = z.object({
  format: z.enum(['json', 'csv']).optional().describe('Response format'),
  include: z.array(z.string()).optional().describe('Fields to include in response'),
});

const GetOndemandContentSchema = z.object({
  queue: z.string().optional().describe('The ID of the desired queue'),
  consumer_id: z.string().optional().describe('A user defined identifier for the consumer of this feed. Each unique consumer ID will receive every item once.'),
  include: z.array(z.string()).optional().describe('Fields to include in response'),
  exclude: z.array(z.string()).optional().describe('Fields to exclude from response'),
  page_size: z.number().min(1).max(100).optional().describe('Number of items per page (1-100)'),
  pricing: z.boolean().optional().describe('Include pricing information'),
  session_label: z.string().optional().describe('Session label for tracking'),
});

const BuildSearchQuerySchema = z.object({
  query: z.string().optional().describe('Base text query'),
  dateRange: z.object({
    start: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    end: z.string().optional().describe('End date (YYYY-MM-DD)'),
  }).optional().describe('Date range filter'),
  locations: z.array(z.string()).optional().describe('Location/place filters'),
  subjects: z.array(z.string()).optional().describe('Subject/topic filters'),
  mediaType: z.enum(['text', 'picture', 'graphic', 'audio', 'video']).optional().describe('Media type filter'),
});

const OptimizeSearchQuerySchema = z.object({
  natural_query: z.string().max(500).describe('Natural language search intent (e.g., "photos of breaking news today")'),
  optimize_for: z.enum(['relevance', 'recency', 'popularity']).default('relevance').describe('Optimization target for the query'),
  suggest_filters: z.boolean().default(true).describe('Whether to suggest additional filters and improvements'),
  content_preferences: z.object({
    preferred_types: z.array(z.enum(['text', 'picture', 'graphic', 'audio', 'video'])).optional().describe('Preferred content types'),
    preferred_subjects: z.array(z.string()).optional().describe('Preferred subjects/topics'),
    preferred_locations: z.array(z.string()).optional().describe('Preferred locations'),
    recency_preference: z.enum(['latest', 'recent', 'any']).optional().describe('Time preference for content'),
  }).optional().describe('User content preferences to apply'),
});

const AnalyzeContentTrendsSchema = z.object({
  timeframe: z.enum(['hour', 'day', 'week']).default('day').describe('Time period for trend analysis'),
  subject_filter: z.string().optional().describe('Focus analysis on specific subject area'),
  location_filter: z.string().optional().describe('Focus analysis on specific location'),
  content_types: z.array(z.enum(['text', 'picture', 'graphic', 'audio', 'video'])).optional().describe('Content types to include in analysis'),
  max_topics: z.number().min(1).max(50).default(10).describe('Maximum number of trending topics to return'),
  include_metrics: z.boolean().default(true).describe('Include detailed trend metrics and analysis'),
});

const GetContentRecommendationsSchema = z.object({
  seed_content: z.array(z.string()).optional().describe('Content IDs to base recommendations on'),
  subjects: z.array(z.string()).optional().describe('Subject preferences for recommendations'),
  content_types: z.array(z.enum(['text', 'picture', 'graphic', 'audio', 'video'])).optional().describe('Preferred content types'),
  location_preference: z.string().optional().describe('Preferred location for content'),
  recency_preference: z.enum(['latest', 'recent', 'any']).default('any').describe('Time preference for recommended content'),
  max_recommendations: z.number().min(1).max(25).default(10).describe('Maximum number of recommendations to return'),
  similarity_threshold: z.number().min(0).max(1).default(0.3).describe('Minimum similarity score for recommendations (0-1)'),
  exclude_seen: z.array(z.string()).optional().describe('Content IDs to exclude from recommendations'),
});

const SearchContentAllSchema = z.object({
  q: z.string().optional().describe('Search query string'),
  include: z.array(z.string()).optional().describe('Fields to include in response'),
  exclude: z.array(z.string()).optional().describe('Fields to exclude from response'),
  sort: z.string().optional().describe('Sort order'),
  page_size: z.number().min(1).max(100).optional().describe('Number of items per page (1-100)'),
  pricing: z.boolean().optional().describe('Include pricing information'),
  in_my_plan: z.boolean().optional().describe('Only show content in your plan'),
  session_label: z.string().optional().describe('Session label for tracking'),
  max_results: z.number().min(1).max(2000).default(500).describe('Maximum total results to retrieve (1-2000)'),
  progress_updates: z.boolean().default(false).describe('Whether to show progress during pagination'),
  deduplicate: z.boolean().default(true).describe('Remove duplicate items across pages'),
});

const GetContentBulkSchema = z.object({
  item_ids: z.array(z.string()).min(1).max(50).describe('Array of content item IDs to retrieve (1-50 items)'),
  include: z.array(z.string()).optional().describe('Fields to include in response'),
  exclude: z.array(z.string()).optional().describe('Fields to exclude from response'),
  batch_size: z.number().min(1).max(20).default(10).describe('Items processed per batch (1-20)'),
  fail_on_missing: z.boolean().default(false).describe('Whether to fail if any items are missing'),
});

const GetTrendingSubjectsSchema = z.object({
  timeframe: z.enum(['hour', 'day', 'week']).default('day').describe('Time period for trend analysis'),
  max_subjects: z.number().min(1).max(100).default(20).describe('Maximum subjects to return (1-100)'),
  min_frequency: z.number().min(1).max(50).default(2).describe('Minimum occurrences to be considered trending'),
  subject_types: z.array(z.string()).optional().describe('Filter by specific subject types'),
});

/**
 * Main MCP Server for Associated Press API
 * Now using McpServer for better tool management and validation
 * Includes connection pooling for improved performance
 */
export class APMCPServer {
  private readonly server: McpServer;
  private readonly config: APConfigManager;
  private readonly connectionPool: ConnectionPool;
  private readonly httpClient: APHttpClient;
  private readonly contentService: ContentService;
  private readonly accountService: AccountService;
  private readonly monitoringService: MonitoringService;

  constructor(config?: Partial<import('../types/api.types.js').APConfig>) {
    // Initialize configuration
    this.config = config ? new APConfigManager(config) : APConfigManager.fromEnvironment();

    // Initialize connection pool for HTTP client reuse
    this.connectionPool = new ConnectionPool(5);

    // Get HTTP client from pool
    this.httpClient = this.connectionPool.acquire(this.config);

    // Initialize services with pooled client
    this.contentService = new ContentService(this.httpClient, this.config);
    this.accountService = new AccountService(this.httpClient);
    this.monitoringService = new MonitoringService(this.httpClient);

    // Initialize MCP server using McpServer
    this.server = new McpServer({
      name: 'ap-mcp-server',
      version: '1.2.0',
    });

    this.setupTools();
    this.setupPrompts();
  }

  /**
   * Setup all MCP prompts for simplified usage
   */
  private setupPrompts(): void {
    registerAPPrompts(this.server, this.contentService, this.monitoringService);
  }

  /**
   * Setup all MCP tools with Zod validation
   */
  private setupTools(): void {
    // Content Tools
    this.server.registerTool(
      'search_content',
      {
        title: 'Search Content',
        description: 'Search for AP content using flexible query parameters',
        inputSchema: SearchContentSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.searchContent(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_content_item',
      {
        title: 'Get Content Item',
        description: 'Get a specific content item by ID',
        inputSchema: GetContentItemSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.getContentItem(params.item_id, params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_content_feed',
      {
        title: 'Get Content Feed',
        description: 'Get a feed of incoming AP content',
        inputSchema: GetContentFeedSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.getContentFeed(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    // Account Tools
    this.server.registerTool(
      'get_account_info',
      {
        title: 'Get Account Info',
        description: 'Get account information and available endpoints',
        inputSchema: z.object({}).shape,
      },
      async () => {
        try {
          const result = await this.accountService.getAccountInfo();
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_account_plans',
      {
        title: 'Get Account Plans',
        description: 'Get account plans and entitlements information',
        inputSchema: GetAccountPlansSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.accountService.getAccountPlans(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_account_downloads',
      {
        title: 'Get Account Downloads',
        description: 'Get account download history',
        inputSchema: GetAccountDownloadsSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.accountService.getAccountDownloads(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_account_quotas',
      {
        title: 'Get Account Quotas',
        description: 'Get account API quotas and usage limits',
        inputSchema: z.object({}).shape,
      },
      async () => {
        try {
          const result = await this.accountService.getAccountQuotas();
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    // RSS Tools
    this.server.registerTool(
      'get_rss_feeds',
      {
        title: 'Get RSS Feeds',
        description: 'Get list of available RSS feeds',
        inputSchema: z.object({}).shape,
      },
      async () => {
        try {
          const result = await this.contentService.getRSSFeeds();
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_rss_feed',
      {
        title: 'Get RSS Feed',
        description: 'Get a specific RSS feed by ID',
        inputSchema: GetRSSFeedSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.getRSSFeed(params.rss_id, params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    // Monitoring Tools
    this.server.registerTool(
      'create_monitor',
      {
        title: 'Create Monitor',
        description: 'Create a new content monitor for alerts',
        inputSchema: CreateMonitorSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.monitoringService.createMonitor(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'list_monitors',
      {
        title: 'List Monitors',
        description: 'List all existing monitors',
        inputSchema: z.object({}).shape,
      },
      async () => {
        try {
          const result = await this.monitoringService.listMonitors();
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_monitor',
      {
        title: 'Get Monitor',
        description: 'Get a specific monitor by ID or name',
        inputSchema: GetMonitorSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.monitoringService.getMonitor(params.monitor_id);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'update_monitor',
      {
        title: 'Update Monitor',
        description: 'Update an existing monitor',
        inputSchema: UpdateMonitorSchema.shape,
      },
      async (params) => {
        try {
          const { monitor_id, ...updateData } = params;
          const result = await this.monitoringService.updateMonitor(monitor_id, updateData);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'delete_monitor',
      {
        title: 'Delete Monitor',
        description: 'Delete a monitor by ID or name',
        inputSchema: GetMonitorSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.monitoringService.deleteMonitor(params.monitor_id);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_monitor_status',
      {
        title: 'Get Monitor Status',
        description: 'Get monitor status and recent alerts',
        inputSchema: GetMonitorStatusSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.monitoringService.getMonitorStatus(params.monitor_id, params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_monitor_history',
      {
        title: 'Get Monitor History',
        description: 'Get monitor activity history',
        inputSchema: GetMonitorHistorySchema.shape,
      },
      async (params) => {
        try {
          const result = await this.monitoringService.getMonitorHistory(params.monitor_id, params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    // Additional Tools
    this.server.registerTool(
      'get_followed_topics',
      {
        title: 'Get Followed Topics',
        description: "Get user's followed topics and subscriptions",
        inputSchema: GetFollowedTopicsSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.accountService.getFollowedTopics(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_ondemand_content',
      {
        title: 'Get OnDemand Content',
        description: "Get AP content items from your organization's OnDemand queue",
        inputSchema: GetOndemandContentSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.getOnDemandContent(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    // Utility Tools
    this.server.registerTool(
      'build_search_query',
      {
        title: 'Build Search Query',
        description: 'Build a structured search query for AP content using filters',
        inputSchema: BuildSearchQuerySchema.shape,
      },
      async (params) => {
        try {
          const result = await ContentService.buildSearchQuery(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'optimize_search_query',
      {
        title: 'Optimize Search Query',
        description: 'Convert natural language queries to optimized AP search syntax with intelligent suggestions',
        inputSchema: OptimizeSearchQuerySchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.optimizeSearchQuery(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'analyze_content_trends',
      {
        title: 'Analyze Content Trends',
        description: 'Analyze trending topics and content patterns across different timeframes',
        inputSchema: AnalyzeContentTrendsSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.analyzeContentTrends(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_content_recommendations',
      {
        title: 'Get Content Recommendations',
        description: 'Get personalized content recommendations with relevance scoring',
        inputSchema: GetContentRecommendationsSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.getContentRecommendations(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'search_content_all',
      {
        title: 'Search Content All',
        description: 'Search AP content with automatic pagination to retrieve all matching results efficiently',
        inputSchema: SearchContentAllSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.searchContentAll(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_content_bulk',
      {
        title: 'Get Content Bulk',
        description: 'Retrieve multiple content items by IDs efficiently with batch processing and error handling',
        inputSchema: GetContentBulkSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.getContentBulk(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );

    this.server.registerTool(
      'get_trending_subjects',
      {
        title: 'Get Trending Subjects',
        description: 'Quick discovery of trending subjects without full content analysis for rapid topic insights',
        inputSchema: GetTrendingSubjectsSchema.shape,
      },
      async (params) => {
        try {
          const result = await this.contentService.getTrendingSubjects(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return this.handleToolError(error);
        }
      }
    );
  }

  /**
   * Handle errors in a consistent way for all tools
   */
  private handleToolError(error: unknown): { content: Array<{ type: 'text'; text: string }>, isError?: boolean } {
    const errorInfo = ErrorHandler.handleError(error);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(errorInfo, null, 2),
      }],
      isError: true,
    };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // Connect using stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Run the server (alias for start for backward compatibility)
   */
  async run(): Promise<void> {
    await this.start();
  }

  /**
   * Clean up resources
   */
  async stop(): Promise<void> {
    // Release connection back to pool
    this.connectionPool.release(this.config);

    // Clean up connection pool on shutdown
    this.connectionPool.cleanup();

    // Note: McpServer doesn't have a close method, but we can clean up other resources
    console.log('Server resources cleaned up');
  }
}
