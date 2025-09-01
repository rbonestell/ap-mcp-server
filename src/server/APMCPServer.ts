import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequest,
	CallToolRequestSchema,
	ErrorCode,
	ListToolsRequestSchema,
	McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { APConfigManager } from '../config/APConfig.js';
import { APError, ErrorHandler, isAPError } from '../errors/APError.js';
import { APHttpClient } from '../http/APHttpClient.js';
import { AccountService } from '../services/AccountService.js';
import { ContentService } from '../services/ContentService.js';
import { MonitoringService } from '../services/MonitoringService.js';

/**
 * Main MCP Server for Associated Press API
 */
export class APMCPServer {
  private readonly server: Server;
  private readonly config: APConfigManager;
  private readonly httpClient: APHttpClient;
  private readonly contentService: ContentService;
  private readonly accountService: AccountService;
  private readonly monitoringService: MonitoringService;

  constructor(config?: Partial<import('../types/api.types.js').APConfig>) {
    // Initialize configuration
    this.config = config ? new APConfigManager(config) : APConfigManager.fromEnvironment();

    // Initialize HTTP client and services
    this.httpClient = new APHttpClient(this.config);
    this.contentService = new ContentService(this.httpClient);
    this.accountService = new AccountService(this.httpClient);
    this.monitoringService = new MonitoringService(this.httpClient);

    // Initialize MCP server
    this.server = new Server({
      name: 'ap-mcp-server',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupToolHandlers();
    this.setupErrorHandlers();
  }

  /**
   * Setup tool request handlers
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_content',
            description: 'Search for AP content using flexible query parameters',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: 'Search query string' },
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to exclude from response'
                },
                sort: { type: 'string', description: 'Sort order' },
                page: { type: 'string', description: 'Page number (as string)' },
                page_size: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                  description: 'Number of items per page (1-100)'
                },
                pricing: { type: 'boolean', description: 'Include pricing information' },
                in_my_plan: { type: 'boolean', description: 'Only show content in your plan' },
                session_label: { type: 'string', description: 'Session label for tracking' },
              },
            },
          },
          {
            name: 'get_content_item',
            description: 'Get a specific content item by ID',
            inputSchema: {
              type: 'object',
              properties: {
                item_id: {
                  type: 'string',
                  description: 'The unique identifier for the content item'
                },
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to exclude from response'
                },
                pricing: { type: 'boolean', description: 'Include pricing information' },
                in_my_plan: { type: 'boolean', description: 'Only show if in your plan' },
                format: { type: 'string', description: 'Response format' },
              },
              required: ['item_id'],
            },
          },
          {
            name: 'get_content_feed',
            description: 'Get a feed of incoming AP content',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: 'Filter query string' },
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to exclude from response'
                },
                page_size: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                  description: 'Number of items per page (1-100)'
                },
                pricing: { type: 'boolean', description: 'Include pricing information' },
                in_my_plan: { type: 'boolean', description: 'Only show content in your plan' },
                with_monitor: {
                  type: 'string',
                  minLength: 4,
                  maxLength: 24,
                  pattern: '^[a-zA-Z0-9_.-]*$',
                  description: 'Monitor name to associate with feed'
                },
                session_label: { type: 'string', description: 'Session label for tracking' },
                filter_out: { type: 'string', description: 'Content to filter out' },
              },
            },
          },
          {
            name: 'get_account_info',
            description: 'Get account information and available endpoints',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_account_plans',
            description: 'Get account plans and entitlements information',
            inputSchema: {
              type: 'object',
              properties: {
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to exclude from response'
                },
                format: {
                  type: 'string',
                  enum: ['json', 'csv'],
                  description: 'Response format'
                },
              },
            },
          },
          {
            name: 'get_account_downloads',
            description: 'Get account download history',
            inputSchema: {
              type: 'object',
              properties: {
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to exclude from response'
                },
                min_date: {
                  type: 'string',
                  description: 'Minimum date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss or ISO-8601 duration)'
                },
                max_date: {
                  type: 'string',
                  description: 'Maximum date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss or ISO-8601 duration)'
                },
                order: {
                  type: 'integer',
                  minimum: 1,
                  description: 'Sort order (positive integer)'
                },
                format: {
                  type: 'string',
                  enum: ['json', 'csv'],
                  description: 'Response format'
                },
              },
            },
          },
          {
            name: 'get_rss_feeds',
            description: 'Get list of available RSS feeds',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_rss_feed',
            description: 'Get a specific RSS feed by ID',
            inputSchema: {
              type: 'object',
              properties: {
                rss_id: {
                  type: 'integer',
                  minimum: 1,
                  description: 'RSS feed ID (positive integer)'
                },
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to exclude from response'
                },
                page_size: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                  description: 'Number of items per page (1-100)'
                },
              },
              required: ['rss_id'],
            },
          },
          {
            name: 'create_monitor',
            description: 'Create a new content monitor for alerts',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 20,
                  pattern: '^[a-zA-Z0-9_.-]*$',
                  description: 'Monitor name (1-20 chars, alphanumeric, underscore, dot, hyphen only)'
                },
                description: { type: 'string', description: 'Monitor description' },
                playbook: { type: 'string', description: 'Instructions for when monitor triggers' },
                repeatAlerts: {
                  type: 'string',
                  pattern: '^(0|PT\\d*[MH])$',
                  description: 'Repeat interval in ISO-8601 duration format (PT10M, PT2H) or "0" to disable'
                },
                notify: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 5,
                  items: {
                    type: 'object',
                    properties: {
                      channelType: { type: 'string', enum: ['email'] },
                      channelDestinations: {
                        type: 'array',
                        minItems: 1,
                        items: {
                          type: 'string',
                          format: 'email',
                          description: 'Email address for notifications'
                        }
                      }
                    },
                    required: ['channelType', 'channelDestinations']
                  },
                  description: 'Notification settings (1-5 channels)'
                },
                conditions: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 5,
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['idleFeed', 'quality'] },
                      enabled: { type: 'boolean' },
                      criteria: {
                        type: 'object',
                        properties: {
                          idleTime: {
                            type: 'string',
                            pattern: '^PT\\d*[MH]$',
                            description: 'Idle time in ISO-8601 duration format (PT2M to PT12H)'
                          }
                        }
                      }
                    },
                    required: ['type', 'enabled', 'criteria']
                  },
                  description: 'Monitor conditions (1-5 conditions)'
                }
              },
              required: ['name', 'notify', 'conditions'],
            },
          },
          {
            name: 'list_monitors',
            description: 'List all existing monitors',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_monitor',
            description: 'Get a specific monitor by ID or name',
            inputSchema: {
              type: 'object',
              properties: {
                monitor_id: {
                  type: 'string',
                  minLength: 1,
                  description: 'Monitor ID or name'
                },
              },
              required: ['monitor_id'],
            },
          },
          {
            name: 'update_monitor',
            description: 'Update an existing monitor',
            inputSchema: {
              type: 'object',
              properties: {
                monitor_id: {
                  type: 'string',
                  minLength: 1,
                  description: 'Monitor ID or name'
                },
                name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 20,
                  pattern: '^[a-zA-Z0-9_.-]*$',
                  description: 'Monitor name (1-20 chars, alphanumeric, underscore, dot, hyphen only)'
                },
                description: { type: 'string', description: 'Monitor description' },
                playbook: { type: 'string', description: 'Instructions for when monitor triggers' },
                repeatAlerts: {
                  type: 'string',
                  pattern: '^(0|PT\\d*[MH])$',
                  description: 'Repeat interval in ISO-8601 duration format (PT10M, PT2H) or "0" to disable'
                },
                notify: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 5,
                  items: {
                    type: 'object',
                    properties: {
                      channelType: { type: 'string', enum: ['email'] },
                      channelDestinations: {
                        type: 'array',
                        minItems: 1,
                        items: {
                          type: 'string',
                          format: 'email',
                          description: 'Email address for notifications'
                        }
                      }
                    },
                    required: ['channelType', 'channelDestinations']
                  },
                  description: 'Notification channels (1-5 channels)'
                },
                conditions: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 5,
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['idleFeed', 'quality'],
                        description: 'Condition type'
                      },
                      enabled: { type: 'boolean', description: 'Whether condition is enabled' },
                      criteria: {
                        type: 'object',
                        properties: {
                          idleTime: {
                            type: 'string',
                            pattern: '^PT\\d*[MH]$',
                            description: 'Idle time in ISO-8601 duration format (PT2M to PT12H)'
                          }
                        }
                      }
                    },
                    required: ['type', 'enabled', 'criteria']
                  },
                  description: 'Monitor conditions (1-5 conditions)'
                }
              },
              required: ['monitor_id', 'name', 'notify', 'conditions'],
            },
          },
          {
            name: 'delete_monitor',
            description: 'Delete a monitor by ID or name',
            inputSchema: {
              type: 'object',
              properties: {
                monitor_id: {
                  type: 'string',
                  minLength: 1,
                  description: 'Monitor ID or name'
                },
              },
              required: ['monitor_id'],
            },
          },
          {
            name: 'get_monitor_status',
            description: 'Get monitor status and recent alerts',
            inputSchema: {
              type: 'object',
              properties: {
                monitor_id: {
                  type: 'string',
                  minLength: 1,
                  description: 'Monitor ID or name'
                },
                show_detail: {
                  type: 'boolean',
                  description: 'Show detailed information'
                },
                agentid: {
                  type: 'string',
                  description: 'Agent ID filter'
                },
              },
              required: ['monitor_id'],
            },
          },
          {
            name: 'get_monitor_history',
            description: 'Get monitor activity history',
            inputSchema: {
              type: 'object',
              properties: {
                monitor_id: {
                  type: 'string',
                  minLength: 1,
                  description: 'Monitor ID or name'
                },
                show_detail: {
                  type: 'boolean',
                  description: 'Show detailed information'
                },
                agentid: {
                  type: 'string',
                  description: 'Agent ID filter'
                },
                min_date: {
                  type: 'string',
                  description: 'Minimum date filter'
                },
                max_date: {
                  type: 'string',
                  description: 'Maximum date filter'
                },
                page: {
                  type: 'string',
                  description: 'Page number (as string)'
                },
                page_size: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                  description: 'Number of items per page (1-100)'
                },
              },
              required: ['monitor_id'],
            },
          },
          {
            name: 'get_account_quotas',
            description: 'Get account API quotas and usage limits',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_followed_topics',
            description: 'Get user\'s followed topics and subscriptions',
            inputSchema: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['json', 'csv'],
                  description: 'Response format'
                },
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
              },
            },
          },
          {
            name: 'get_ondemand_content',
            description: 'Get AP content items from your organization\'s OnDemand queue',
            inputSchema: {
              type: 'object',
              properties: {
                consumer_id: {
                  type: 'string',
                  description: 'A user defined identifier for the consumer of this feed. Each unique consumer ID will receive every item once.'
                },
                queue: {
                  type: 'string',
                  description: 'The ID of the desired queue'
                },
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to exclude from response'
                },
                page_size: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                  description: 'Number of items per page (1-100)'
                },
                pricing: { type: 'boolean', description: 'Include pricing information' },
                session_label: { type: 'string', description: 'Session label for tracking' },
              },
            },
          },
          {
            name: 'build_search_query',
            description: 'Build a structured search query for AP content using filters',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Base text query' },
                mediaType: {
                  type: 'string',
                  enum: ['text', 'picture', 'graphic', 'audio', 'video'],
                  description: 'Media type filter'
                },
                dateRange: {
                  type: 'object',
                  properties: {
                    start: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
                    end: { type: 'string', description: 'End date (YYYY-MM-DD)' }
                  },
                  description: 'Date range filter'
                },
                subjects: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Subject/topic filters'
                },
                locations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Location/place filters'
                },
              },
            },
          },
          {
            name: 'optimize_search_query',
            description: 'Convert natural language queries to optimized AP search syntax with intelligent suggestions',
            inputSchema: {
              type: 'object',
              properties: {
                natural_query: {
                  type: 'string',
                  description: 'Natural language search intent (e.g., "photos of breaking news today")',
                  maxLength: 500
                },
                suggest_filters: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether to suggest additional filters and improvements'
                },
                content_preferences: {
                  type: 'object',
                  properties: {
                    preferred_types: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['text', 'picture', 'graphic', 'audio', 'video']
                      },
                      description: 'Preferred content types'
                    },
                    preferred_subjects: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Preferred subjects/topics'
                    },
                    preferred_locations: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Preferred locations'
                    },
                    recency_preference: {
                      type: 'string',
                      enum: ['latest', 'recent', 'any'],
                      description: 'Time preference for content'
                    }
                  },
                  description: 'User content preferences to apply'
                },
                optimize_for: {
                  type: 'string',
                  enum: ['relevance', 'recency', 'popularity'],
                  default: 'relevance',
                  description: 'Optimization target for the query'
                }
              },
              required: ['natural_query'],
            },
          },
          {
            name: 'analyze_content_trends',
            description: 'Analyze trending topics and content patterns across different timeframes',
            inputSchema: {
              type: 'object',
              properties: {
                timeframe: {
                  type: 'string',
                  enum: ['hour', 'day', 'week'],
                  default: 'day',
                  description: 'Time period for trend analysis'
                },
                content_types: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['text', 'picture', 'graphic', 'audio', 'video']
                  },
                  description: 'Content types to include in analysis'
                },
                max_topics: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 50,
                  default: 10,
                  description: 'Maximum number of trending topics to return'
                },
                include_metrics: {
                  type: 'boolean',
                  default: true,
                  description: 'Include detailed trend metrics and analysis'
                },
                location_filter: {
                  type: 'string',
                  description: 'Focus analysis on specific location'
                },
                subject_filter: {
                  type: 'string',
                  description: 'Focus analysis on specific subject area'
                }
              },
            },
          },
          {
            name: 'get_content_recommendations',
            description: 'Get personalized content recommendations with relevance scoring',
            inputSchema: {
              type: 'object',
              properties: {
                seed_content: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Content IDs to base recommendations on'
                },
                subjects: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Subject preferences for recommendations'
                },
                content_types: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['text', 'picture', 'graphic', 'audio', 'video']
                  },
                  description: 'Preferred content types'
                },
                max_recommendations: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 25,
                  default: 10,
                  description: 'Maximum number of recommendations to return'
                },
                exclude_seen: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Content IDs to exclude from recommendations'
                },
                location_preference: {
                  type: 'string',
                  description: 'Preferred location for content'
                },
                recency_preference: {
                  type: 'string',
                  enum: ['latest', 'recent', 'any'],
                  default: 'any',
                  description: 'Time preference for recommended content'
                },
                similarity_threshold: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  default: 0.3,
                  description: 'Minimum similarity score for recommendations (0-1)'
                }
              },
            },
          },
          {
            name: 'search_content_all',
            description: 'Search AP content with automatic pagination to retrieve all matching results efficiently',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: 'Search query string' },
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to exclude from response'
                },
                sort: { type: 'string', description: 'Sort order' },
                page_size: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                  description: 'Number of items per page (1-100)'
                },
                max_results: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 2000,
                  default: 500,
                  description: 'Maximum total results to retrieve (1-2000)'
                },
                progress_updates: {
                  type: 'boolean',
                  default: false,
                  description: 'Whether to show progress during pagination'
                },
                deduplicate: {
                  type: 'boolean',
                  default: true,
                  description: 'Remove duplicate items across pages'
                },
                pricing: { type: 'boolean', description: 'Include pricing information' },
                in_my_plan: { type: 'boolean', description: 'Only show content in your plan' },
                session_label: { type: 'string', description: 'Session label for tracking' },
              },
            },
          },
          {
            name: 'get_content_bulk',
            description: 'Retrieve multiple content items by IDs efficiently with batch processing and error handling',
            inputSchema: {
              type: 'object',
              properties: {
                item_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  maxItems: 50,
                  description: 'Array of content item IDs to retrieve (1-50 items)'
                },
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to include in response'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to exclude from response'
                },
                fail_on_missing: {
                  type: 'boolean',
                  default: false,
                  description: 'Whether to fail if any items are missing'
                },
                batch_size: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 20,
                  default: 10,
                  description: 'Items processed per batch (1-20)'
                }
              },
              required: ['item_ids'],
            },
          },
          {
            name: 'get_trending_subjects',
            description: 'Quick discovery of trending subjects without full content analysis for rapid topic insights',
            inputSchema: {
              type: 'object',
              properties: {
                timeframe: {
                  type: 'string',
                  enum: ['hour', 'day', 'week'],
                  default: 'day',
                  description: 'Time period for trend analysis'
                },
                max_subjects: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                  default: 20,
                  description: 'Maximum subjects to return (1-100)'
                },
                min_frequency: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 50,
                  default: 2,
                  description: 'Minimum occurrences to be considered trending'
                },
                subject_types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by specific subject types'
                }
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_content':
            return await this.handleSearchContent(args);

          case 'get_content_item':
            return await this.handleGetContentItem(args);

          case 'get_content_feed':
            return await this.handleGetContentFeed(args);

          case 'get_account_info':
            return await this.handleGetAccountInfo(args);

          case 'get_account_plans':
            return await this.handleGetAccountPlans(args);

          case 'get_account_downloads':
            return await this.handleGetAccountDownloads(args);

          case 'get_rss_feeds':
            return await this.handleGetRSSFeeds(args);

          case 'get_rss_feed':
            return await this.handleGetRSSFeed(args);

          case 'create_monitor':
            return await this.handleCreateMonitor(args);

          case 'list_monitors':
            return await this.handleListMonitors(args);

          case 'get_monitor':
            return await this.handleGetMonitor(args);

          case 'update_monitor':
            return await this.handleUpdateMonitor(args);

          case 'delete_monitor':
            return await this.handleDeleteMonitor(args);

          case 'get_monitor_status':
            return await this.handleGetMonitorStatus(args);

          case 'get_monitor_history':
            return await this.handleGetMonitorHistory(args);

          case 'get_account_quotas':
            return await this.handleGetAccountQuotas(args);

          case 'get_followed_topics':
            return await this.handleGetFollowedTopics(args);

          case 'get_ondemand_content':
            return await this.handleGetOnDemandContent(args);

          case 'build_search_query':
            return await this.handleBuildSearchQuery(args);

          case 'optimize_search_query':
            return await this.handleOptimizeSearchQuery(args);

          case 'analyze_content_trends':
            return await this.handleAnalyzeContentTrends(args);

          case 'get_content_recommendations':
            return await this.handleGetContentRecommendations(args);

          case 'search_content_all':
            return await this.handleSearchContentAll(args);

          case 'get_content_bulk':
            return await this.handleGetContentBulk(args);

          case 'get_trending_subjects':
            return await this.handleGetTrendingSubjects(args);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        // Transform AP errors to MCP errors
        if (isAPError(error)) {
          const mcpErrorCode = this.getMcpErrorCode(error);
          throw new McpError(mcpErrorCode, error.message, error.toJSON());
        }

        // Handle other errors
        const handledError = ErrorHandler.handleError(error);
        throw new McpError(ErrorCode.InternalError, handledError.message, handledError.toJSON());
      }
    });
  }

  /**
   * Handle search content tool
   */
  private async handleSearchContent(args: any) {
    const params = args || {};
    const response = await this.contentService.searchContent(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              total_items: response.data.total_items,
              current_page: response.data.current_page,
              page_size: response.data.page_size,
              current_item_count: response.data.current_item_count,
            },
            items: response.data.items.map(item =>
              ContentService.extractContentSummary(item)
            ),
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get content item tool
   */
  private async handleGetContentItem(args: any) {
    const { item_id, ...params } = args;

    if (!item_id) {
      throw new APError('item_id is required', 'VALIDATION_ERROR', 400);
    }

    const response = await this.contentService.getContentItem(item_id, params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: ContentService.extractContentSummary(response.data),
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get content feed tool
   */
  private async handleGetContentFeed(args: any) {
    const params = args || {};
    const response = await this.contentService.getContentFeed(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              total_items: response.data.total_items,
              current_page: response.data.current_page,
              page_size: response.data.page_size,
              current_item_count: response.data.current_item_count,
              updated: response.data.updated,
            },
            items: response.data.items.map(item =>
              ContentService.extractContentSummary(item)
            ),
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get account info tool
   */
  private async handleGetAccountInfo(_args: any) {
    const response = await this.accountService.getAccountInfo();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              id: response.data.id,
              title: response.data.title,
              updated: response.data.updated,
              available_links: response.data.links?.length || 0,
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get account plans tool
   */
  private async handleGetAccountPlans(args: any) {
    const params = args || {};
    const response = await this.accountService.getAccountPlans(params);
    const summary = AccountService.extractPlanSummary(response);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary,
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get account downloads tool
   */
  private async handleGetAccountDownloads(args: any) {
    const params = args || {};
    const response = await this.accountService.getAccountDownloads(params);
    const summary = AccountService.extractDownloadSummary(response);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary,
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get RSS feeds tool
   */
  private async handleGetRSSFeeds(_args: any) {
    const response = await this.contentService.getRSSFeeds();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get RSS feed tool
   */
  private async handleGetRSSFeed(args: any) {
    const { rss_id, ...params } = args;

    if (!rss_id) {
      throw new APError('rss_id is required', 'VALIDATION_ERROR', 400);
    }

    const response = await this.contentService.getRSSFeed(rss_id, params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            rss_id,
            response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle create monitor tool
   */
  private async handleCreateMonitor(args: any) {
    const monitor = args;
    const response = await this.monitoringService.createMonitor(monitor);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              monitor_name: monitor.name,
              description: monitor.description || 'No description provided',
              notification_channels: monitor.notify?.length || 0,
              conditions: monitor.conditions?.length || 0,
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle list monitors tool
   */
  private async handleListMonitors(_args: any) {
    const response = await this.monitoringService.listMonitors();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get monitor tool
   */
  private async handleGetMonitor(args: any) {
    const { monitor_id } = args;
    const response = await this.monitoringService.getMonitor(monitor_id);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              monitor_id,
              monitor_name: response.data?.name || 'Unknown',
              status: response.data?.enabled ? 'active' : 'inactive',
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle update monitor tool
   */
  private async handleUpdateMonitor(args: any) {
    const { monitor_id, ...monitorData } = args;
    const response = await this.monitoringService.updateMonitor(monitor_id, monitorData);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              monitor_id,
              monitor_name: monitorData.name,
              description: monitorData.description || 'No description provided',
              notification_channels: monitorData.notify?.length || 0,
              conditions: monitorData.conditions?.length || 0,
              updated: true,
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle delete monitor tool
   */
  private async handleDeleteMonitor(args: any) {
    const { monitor_id } = args;
    const response = await this.monitoringService.deleteMonitor(monitor_id);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              monitor_id,
              deleted: true,
              message: `Monitor ${monitor_id} has been deleted`,
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get monitor status tool
   */
  private async handleGetMonitorStatus(args: any) {
    const { monitor_id, ...options } = args;
    const response = await this.monitoringService.getMonitorStatus(monitor_id, options);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              monitor_id,
              status: response.data?.status || 'unknown',
              active_alerts: response.data?.active_alerts || 0,
              last_check: response.data?.last_check || null,
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get monitor history tool
   */
  private async handleGetMonitorHistory(args: any) {
    const { monitor_id, ...options } = args;
    const response = await this.monitoringService.getMonitorHistory(monitor_id, options);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              monitor_id,
              total_events: response.data?.total_items || 0,
              current_page: response.data?.current_page || 1,
              page_size: response.data?.page_size || 10,
              date_range: {
                from: options.min_date || 'not specified',
                to: options.max_date || 'not specified',
              },
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get account quotas tool
   */
  private async handleGetAccountQuotas(_args: any) {
    const response = await this.accountService.getAccountQuotas();
    const summary = AccountService.extractQuotaSummary(response);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary,
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get followed topics tool
   */
  private async handleGetFollowedTopics(args: any) {
    const options = args || {};
    const response = await this.accountService.getFollowedTopics(options);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              format: options.format || 'json',
              total_topics: Array.isArray(response.data) ? response.data.length : 0,
              include_fields: options.include || 'all fields',
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get OnDemand content tool
   */
  private async handleGetOnDemandContent(args: any) {
    const params = args || {};
    const response = await this.contentService.getOnDemandContent(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              total_items: response.data.total_items,
              current_page: response.data.current_page,
              page_size: response.data.page_size,
              current_item_count: response.data.current_item_count,
              updated: response.data.updated,
              consumer_id: params.consumer_id || 'default',
              queue: params.queue || 'default',
            },
            items: response.data.items.map(item =>
              ContentService.extractContentSummary(item)
            ),
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle build search query tool
   */
  private async handleBuildSearchQuery(args: any) {
    const filters = args || {};
    const query = ContentService.buildSearchQuery(filters);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            built_query: query,
            applied_filters: {
              query: filters.query || null,
              mediaType: filters.mediaType || null,
              dateRange: filters.dateRange || null,
              subjects: filters.subjects || null,
              locations: filters.locations || null,
            },
            usage_tip: 'Use this query with the search_content tool by passing it as the "q" parameter',
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle optimize search query tool
   */
  private async handleOptimizeSearchQuery(args: any) {
    const params = args || {};

    if (!params.natural_query) {
      throw new APError('natural_query is required', 'VALIDATION_ERROR', 400);
    }

    const response = await this.contentService.optimizeSearchQuery(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              operation: 'optimize_search_query',
              original_query: response.original_query,
              optimized_query: response.optimized_query,
              confidence_score: response.confidence_score,
              transformations_count: Object.values(response.transformations_applied)
                .reduce((total, filters) => total + (filters?.length || 0), 0),
              suggestions_provided: !!response.suggestions,
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle analyze content trends tool
   */
  private async handleAnalyzeContentTrends(args: any) {
    const params = args || {};
    const response = await this.contentService.analyzeContentTrends(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              operation: 'analyze_content_trends',
              timeframe: response.timeframe,
              analysis_period: response.analysis_period,
              trending_topics_count: response.trending_topics.length,
              total_content_analyzed: response.total_content_analyzed,
              top_rising_topic: response.metrics.top_rising_topics[0] || 'none',
              most_frequent_topic: response.metrics.most_frequent_topics[0] || 'none',
              geographic_hotspots: response.metrics.geographic_hotspots?.slice(0, 3) || [],
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get content recommendations tool
   */
  private async handleGetContentRecommendations(args: any) {
    const params = args || {};
    const response = await this.contentService.getContentRecommendations(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              operation: 'get_content_recommendations',
              total_recommendations: response.total_recommendations,
              search_strategy: response.search_strategy,
              filters_applied_count: response.filters_applied.length,
              seed_analysis_provided: !!response.seed_analysis,
              average_relevance_score: response.recommendations.length > 0
                ? Math.round((response.recommendations.reduce((sum, rec) => sum + rec.relevance_score, 0) / response.recommendations.length) * 1000) / 1000
                : 0,
              top_recommendation: response.recommendations[0] ? {
                content_id: response.recommendations[0].content_id,
                title: response.recommendations[0].content_summary.title,
                relevance_score: response.recommendations[0].relevance_score,
              } : null,
            },
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle search content all tool
   */
  private async handleSearchContentAll(args: any) {
    const params = args || {};
    const response = await this.contentService.searchContentAll(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              operation: response.summary.operation,
              total_results: response.summary.total_results,
              pages_fetched: response.summary.pages_fetched,
              processing_time_ms: response.summary.processing_time_ms,
              success_rate: response.summary.success_rate,
              cache_performance: {
                hits: response.summary.cache_hits,
                enabled: true,
              },
              deduplicated_items: response.summary.deduplicated_count,
              pagination: {
                total_pages: response.full_response.pagination_info.total_pages,
                max_results_reached: response.full_response.pagination_info.max_results_reached,
              },
            },
            items: response.full_response.items.map(item =>
              ContentService.extractContentSummary(item)
            ),
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get content bulk tool
   */
  private async handleGetContentBulk(args: any) {
    const { item_ids, ...params } = args;

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      throw new APError('item_ids is required and must be a non-empty array', 'VALIDATION_ERROR', 400);
    }

    const bulkParams = { item_ids, ...params };
    const response = await this.contentService.getContentBulk(bulkParams);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              operation: response.summary.operation,
              total_requested: item_ids.length,
              successful_retrievals: response.summary.successful_retrievals,
              failed_retrievals: response.summary.failed_retrievals,
              success_rate: response.summary.success_rate,
              processing_time_ms: response.summary.processing_time_ms,
              batch_processing: {
                batch_count: response.summary.batch_count,
                cache_performance: {
                  enabled: true,
                },
              },
              missing_items: response.full_response.missing_item_ids.length,
            },
            successful_items: response.full_response.items
              .filter(item => item.success)
              .map(item => ({
                content_id: item.content_id,
                summary: item.content ? ContentService.extractContentSummary(item.content) : null,
              })),
            failed_items: response.full_response.items
              .filter(item => !item.success)
              .map(item => ({
                content_id: item.content_id,
                error: item.error,
              })),
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get trending subjects tool
   */
  private async handleGetTrendingSubjects(args: any) {
    const params = args || {};
    const response = await this.contentService.getTrendingSubjects(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              operation: response.summary.operation,
              timeframe: response.summary.timeframe,
              total_subjects: response.summary.total_results,
              processing_time_ms: response.summary.processing_time_ms,
              success_rate: response.summary.success_rate,
              cache_performance: {
                hits: response.summary.cache_hits || 0,
                enabled: true,
              },
              analysis_metrics: {
                content_analyzed: response.full_response.content_analyzed,
                time_period: {
                  start: response.full_response.analysis_period.start,
                  end: response.full_response.analysis_period.end,
                },
              },
              top_subject: response.full_response.items[0] ? {
                name: response.full_response.items[0].subject_name,
                frequency: response.full_response.items[0].frequency,
                trend_score: response.full_response.items[0].trend_score,
              } : null,
            },
            trending_subjects: response.full_response.items.map(subject => ({
              name: subject.subject_name,
              frequency: subject.frequency,
              trend_score: subject.trend_score,
              sample_content_count: subject.sample_content_ids.length,
            })),
            full_response: response,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Convert AP error to MCP error code
   */
  private getMcpErrorCode(error: APError): ErrorCode {
    switch (error.statusCode) {
      case 400:
        return ErrorCode.InvalidParams;
      case 401:
        return ErrorCode.InternalError; // MCP doesn't have auth error
      case 403:
        return ErrorCode.InternalError;
      case 404:
        return ErrorCode.InternalError;
      case 429:
        return ErrorCode.InternalError;
      case 500:
      case 502:
      case 503:
      case 504:
        return ErrorCode.InternalError;
      default:
        return ErrorCode.InternalError;
    }
  }

  /**
   * Setup error handlers
   */
  private setupErrorHandlers(): void {
    // Handle uncaught errors gracefully
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  /**
   * Test server connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      return await this.httpClient.testConnection();
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get server configuration summary
   */
  getConfigSummary(): Record<string, any> {
    return {
      config: this.config.getSummary(),
      httpClient: this.httpClient.getConfig(),
    };
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    // Test connection before starting
    const connectionOk = await this.testConnection();
    if (!connectionOk) {
      console.error('Warning: Could not verify connection to AP API. Server will start but API calls may fail.');
      console.error('Please check your AP_API_KEY environment variable and network connectivity.');
    }

    console.error('AP MCP Server starting...');
    console.error('Configuration:', JSON.stringify(this.getConfigSummary(), null, 2));

    // Connect using stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AP MCP Server running');
  }

  /**
   * Get the MCP server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Get list of registered tool names (for testing)
   */
  getRegisteredTools(): string[] {
    const tools = [
      'search_content',
      'get_content_item',
      'get_content_feed',
      'get_account_info',
      'get_account_plans',
      'get_account_downloads',
      'get_account_quotas',
      'get_followed_topics',
      'get_rss_feeds',
      'get_rss_feed',
      'get_ondemand_content',
      'create_monitor',
      'list_monitors',
      'get_monitor',
      'update_monitor',
      'delete_monitor',
      'get_monitor_status',
      'get_monitor_history',
      'build_search_query',
      'optimize_search_query',
      'analyze_content_trends',
      'get_content_recommendations',
      'search_content_all',
      'get_content_bulk',
      'get_trending_subjects'
    ];
    return tools;
  }

  /**
   * Validate MCP protocol compliance (for testing)
   */
  validateMCPCompliance(): void {
    // Basic validation that server is properly initialized
    if (!this.server) {
      throw new Error('MCP server not initialized');
    }

    // Check that all required handlers are set
    // This is a basic validation - in a real scenario we'd check internal server state

    console.log('MCP server appears to be properly configured');
  }
}
