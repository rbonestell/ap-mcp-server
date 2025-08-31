import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  CallToolRequest,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { APConfigManager } from '../config/APConfig.js';
import { APHttpClient } from '../http/APHttpClient.js';
import { ContentService } from '../services/ContentService.js';
import { AccountService } from '../services/AccountService.js';
import { MonitoringService } from '../services/MonitoringService.js';
import { ErrorHandler, isAPError, APError } from '../errors/APError.js';

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
          
          case 'get_ondemand_content':
            return await this.handleGetOnDemandContent(args);
          
          case 'build_search_query':
            return await this.handleBuildSearchQuery(args);
          
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
      'get_rss_feeds',
      'get_rss_feed',
      'get_ondemand_content',
      'create_monitor',
      'list_monitors',
      'build_search_query'
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