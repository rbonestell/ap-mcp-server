# Associated Press Media API MCP Server

<a href="https://www.npmjs.com/package/ap-mcp-server"><img src="https://img.shields.io/npm/v/ap-mcp-server.svg" alt="NPM Version"></a>
<a href="https://github.com/rbonestell/ap-mcp-server/actions/workflows/build.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/rbonestell/ap-mcp-server/build.yml?logo=typescript&logoColor=white" alt="Build Status"></a>
<a href="https://github.com/rbonestell/ap-mcp-server/actions/workflows/test.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/rbonestell/ap-mcp-server/test.yml?branch=main&logo=jest&logoColor=white&label=tests" alt="Test Results"></a>
<a href="https://app.codecov.io/gh/rbonestell/ap-mcp-server/"><img src="https://img.shields.io/codecov/c/github/rbonestell/ap-mcp-server?logo=codecov&logoColor=white" alt="Code Coverage"></a>
<img src="https://img.shields.io/badge/tools-26-brightgreen.svg?logo=modelcontextprotocol" alt="26 Available Tools">
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>

An _**unofficial**_ Model Context Protocol (MCP) server that transforms the Associated Press Media API into an **AI-optimized content intelligence resource**. With 26 powerful tools, this MCP server enables conversational AI applications to seamlessly access, analyze, and interact with AP's comprehensive news content through natural language interfaces.

**Perfect for**: Conversational AI assistants, news analysis applications, content research tools, and automated journalism workflows.

> [!NOTE]
> For more info about the AP Media API, visit the AP [developer documentation](https://developer.ap.org/ap-media-api/).

## 🔑 Key Features

### 🤖 Conversational AI Features

- **Natural Language Query Processing**: Convert conversational queries into optimized AP API searches
- **Intelligent Content Recommendations**: AI-powered content discovery and related article suggestions
- **Trend Analysis**: Real-time trending topic detection and analysis
- **Smart Query Optimization**: Automatic query enhancement for better search results

### 📈 Performance & Scale

- **Bulk Operations**: Handle up to 2,000 search results and 50 items in single operations
- **Intelligent Caching**: TTL-based caching system for improved performance
- **Auto-Pagination**: Seamlessly handle large result sets with automatic pagination
- **Production-Ready**: Enterprise-grade performance and reliability

### 📰 Complete Content Intelligence

- **26 Comprehensive Tools**: Full coverage of AP Media API functionality
- **Live Content Feeds**: Real-time access to AP's breaking news and updates
- **Advanced Search**: Multi-parameter search with flexible filtering and sorting
- **Content Monitoring**: Create and manage automated content alerts and monitors

### 🛡️ Enterprise-Grade Foundation

- **Full Type Safety**: Complete TypeScript implementation with OpenAPI-based types
- **Robust Error Handling**: Graceful handling of API errors, rate limits, and network issues
- **Secure Configuration**: Environment-based configuration with validation
- **Comprehensive Testing**: High test coverage with both unit and integration tests

## Quick Start

### Prerequisites

- Node.js 18+
- An Associated Press API key (get one at [api.ap.org](https://api.ap.org))

### Installation

#### Claude Code (CLI)

Add to your Claude Code MCP configuration:

```json
{
	"mcpServers": {
		"ap-media": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "ap-mcp-server"],
			"env": {
				"AP_API_KEY": "your_api_key_here"
			}
		}
	}
}
```

#### Visual Studio Code et al.

For VS Code, Windsurf, Cursor, Void, and other VS Code-based editors:

Add the following server definition to your workspace MCP settings (`.vscode/mcp.json`):

```json
{
	"servers": {
		"ap-media": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "ap-mcp-server"],
			"env": {
				"AP_API_KEY": "your_api_key_here"
			}
		}
	}
}
```

#### Generic MCP Client Configuration

Applies to Claude Desktop, ChatGPT Desktop, OpenAI Codex, etc.

For most MCP-compatible AI tools, use this standard configuration format:

```json
{
	"mcpServers": {
		"ap-media": {
			"command": "npx",
			"args": ["-y", "ap-mcp-server"],
			"env": {
				"AP_API_KEY": "your_api_key_here"
			}
		}
	}
}
```

## 🤖 AI & LLM Integration

The AP MCP Server is designed to be used directly by AI tools, chatbots, and LLM applications through the MCP protocol. AI assistants can access AP news content using natural language:

### Natural Language AI Interactions

- **"Find recent articles about artificial intelligence in healthcare"**
- **"Show me trending topics in technology this week"**
- **"Get the latest breaking news about climate change"**
- **"Find related articles to this story about renewable energy"**

AI tools automatically convert these requests into the appropriate MCP tool calls.

### Smart Content Discovery

- **Trend Detection**: Automatically identify what's trending in news
- **Content Recommendations**: Get AI-suggested related articles and topics
- **Query Enhancement**: Transform vague queries into precise, optimized searches
- **Bulk Analysis**: Process large amounts of content for pattern recognition

### AI Application Types

- **News Chatbots**: AI assistants with conversational access to AP news
- **Research Assistants**: AI tools for journalists and researchers
- **Analysis Systems**: Automated news trend and pattern analysis
- **Content Curation**: AI-powered content discovery and recommendation engines

## Configuration

### Environment Variables

| Variable              | Required | Default                      | Description                           |
| --------------------- | -------- | ---------------------------- | ------------------------------------- |
| `AP_API_KEY`          | ✅       | -                            | Your AP API key                       |
| `AP_BASE_URL`         | ❌       | `https://api.ap.org/media/v` | AP API base URL                       |
| `AP_TIMEOUT`          | ❌       | `30000`                      | Request timeout (ms)                  |
| `AP_RETRIES`          | ❌       | `3`                          | Retry attempts for failed requests    |
| `AP_DEBUG`            | ❌       | `false`                      | Enable debug logging                  |
| `AP_LOG_LEVEL`        | ❌       | `info`                       | Log level (error, warn, info, debug)  |
| `AP_VERBOSE_LOGGING`  | ❌       | `false`                      | Enable request/response logging       |
| `AP_CACHE_ENABLED`    | ❌       | `true`                       | Enable intelligent caching system     |
| `AP_CACHE_TTL_TRENDS` | ❌       | `300000`                     | Trending topics cache TTL (5 minutes) |
| `AP_CACHE_TTL_SEARCH` | ❌       | `180000`                     | Search results cache TTL (3 minutes)  |

## 🛠️ Available Tools (26 Total)

### 🔍 Core Search & Content Tools

#### `search_content`

Advanced content search with flexible filtering and sorting options.

**Parameters:**

- `query` (string): Search query
- `sort` (string): Sort criteria (default: `_score:desc`)
- `page` (number): Page number (starts at 1)
- `page_size` (number): Items per page (max 100)
- `include`/`exclude` (arrays): Field filtering
- `pricing` (boolean): Include pricing information
- `in_my_plan` (boolean): Only return items in your plan

**AI Usage:**
When an AI tool receives a request like "Find AI healthcare articles", it automatically converts this to appropriate search parameters including query terms, sorting, and field selection.

#### `search_content_all`

Auto-paginated search for large result sets (up to 2,000 items).

**Parameters:**

- Same as `search_content` but automatically handles pagination
- `max_items` (number): Maximum items to retrieve (default: 1000, max: 2000)

**Perfect for:** Bulk analysis, trend detection, comprehensive research.

#### `get_content_item`

Retrieve a specific content item by its ID.

**Parameters:**

- `item_id` (string, required): The AP item ID
- `include`/`exclude` (arrays): Field filtering
- `pricing` (boolean): Include pricing information

#### `get_content_bulk`

Retrieve multiple content items efficiently (up to 50 items).

**Parameters:**

- `item_ids` (array, required): Array of AP item IDs (max 50)
- `include`/`exclude` (arrays): Field filtering
- `pricing` (boolean): Include pricing information

**Perfect for:** Batch content retrieval, related article fetching.

#### `get_content_feed`

Access the live AP content feed for real-time news.

**Parameters:**

- `query` (string): Filter query
- `page_size` (number): Number of items to return
- `include`/`exclude` (arrays): Field filtering

#### `get_rss_feeds` & `get_rss_feed`

List and access RSS feeds for your account.

**Parameters for `get_rss_feed`:**

- `rss_id` (number, required): RSS feed ID
- `page_size` (number): Items per page
- `include`/`exclude` (arrays): Field filtering

#### `get_ondemand_content`

Access your organization's OnDemand queue.

**Parameters:**

- `consumer_id` (string): Consumer identifier
- `queue` (string): Queue ID
- `page_size` (number): Items per page

### 🤖 AI-Powered Intelligence Tools

#### `optimize_search_query`

Convert natural language queries into optimized AP API searches using NLP.

**Parameters:**

- `natural_query` (string, required): Natural language query
- `context` (object): Additional context for optimization

**AI Usage:**
When an AI receives "Find recent articles about AI in healthcare", this tool automatically converts it to an optimized AP API query with proper keywords, date filters, and content type specifications.

#### `analyze_content_trends`

Analyze trending topics and patterns in news content.

**Parameters:**

- `query` (string): Base query for trend analysis
- `time_range` (string): Time period to analyze ("24h", "7d", "30d")
- `trend_type` (string): Type of trend analysis ("topics", "entities", "sentiment")

**Perfect for:** Understanding news patterns, identifying emerging stories.

#### `get_content_recommendations`

Get AI-powered content recommendations based on a reference item.

**Parameters:**

- `reference_item_id` (string): Item ID to base recommendations on
- `recommendation_type` (string): "related", "similar", or "trending"
- `max_results` (number): Maximum recommendations (default: 10)

**Perfect for:** Content discovery, related article suggestions.

#### `get_trending_subjects`

Fast discovery of currently trending topics with caching.

**Parameters:**

- `time_window` (string): Time window for trends ("1h", "6h", "24h")
- `category` (string): Optional category filter
- `min_mentions` (number): Minimum mention threshold

**Perfect for:** Real-time trend monitoring, content planning.

### 📊 Account Management Tools

#### `get_account_info`

Basic account information and available endpoints.

#### `get_account_plans`

Account plans, entitlements, and usage meters.

#### `get_account_downloads`

Download history and usage tracking.

**Parameters:**

- `min_date` (string): Start date (YYYY-MM-DD or ISO-8601)
- `max_date` (string): End date (YYYY-MM-DD or ISO-8601)
- `format` (string): Response format (`json` or `csv`)

#### `get_account_quotas`

Current API quotas and usage limits.

#### `get_followed_topics`

List of topics you're following.

### 🔔 Advanced Monitoring Tools

#### `create_monitor`

Create content monitors for automated alerts.

**Parameters:**

- `name` (string, required): Monitor name
- `description` (string): Description
- `conditions` (array): Monitoring conditions
- `notify` (array): Notification settings

#### `list_monitors`

List all existing monitors.

#### `get_monitor`

Get detailed information about a specific monitor.

**Parameters:**

- `monitor_id` (string, required): Monitor ID

#### `update_monitor`

Update an existing monitor's settings.

**Parameters:**

- `monitor_id` (string, required): Monitor ID
- `updates` (object): Fields to update

#### `delete_monitor`

Delete a monitor.

**Parameters:**

- `monitor_id` (string, required): Monitor ID

#### `get_monitor_status`

Check the status of a monitor.

**Parameters:**

- `monitor_id` (string, required): Monitor ID

#### `get_monitor_history`

Get historical data for a monitor.

**Parameters:**

- `monitor_id` (string, required): Monitor ID
- `start_date` (string): Start date for history
- `end_date` (string): End date for history

### 🔧 Utility Tools

#### `build_search_query`

Build structured search queries with validation.

**Parameters:**

- `keywords` (array): Keywords to search
- `operators` (array): Search operators (AND, OR, NOT)
- `date_range` (object): Date range filters
- `content_types` (array): Content type filters

## 📈 Complete API Coverage

This MCP server provides **complete coverage** of the AP Media API with intelligent enhancements:

### Content Endpoints

- ✅ `/content/search` - Content search (Enhanced with auto-pagination and bulk operations)
- ✅ `/content/{item_id}` - Single item lookup (Enhanced with bulk retrieval)
- ✅ `/content/feed` - Live content feed
- ✅ `/content/rss` - RSS feed list
- ✅ `/content/rss/{rss_id}` - Specific RSS feed
- ✅ `/content/ondemand` - OnDemand queue

### Account Endpoints

- ✅ `/account` - Account information
- ✅ `/account/plans` - Plans and entitlements
- ✅ `/account/downloads` - Download history
- ✅ `/account/quotas` - API quotas and usage limits
- ✅ `/account/followedtopics` - Followed topics management

### Monitoring Endpoints (Complete Implementation)

- ✅ `/account/monitors/create` - Create content monitor
- ✅ `/account/monitors` - List all monitors
- ✅ `/account/monitors/{id}` - Get specific monitor details
- ✅ `/account/monitors/{id}/update` - Update monitor settings
- ✅ `/account/monitors/{id}/delete` - Delete monitor
- ✅ `/account/monitors/{id}/status` - Monitor status and health
- ✅ `/account/monitors/{id}/history` - Monitor historical data

### 🚀 AI & Performance Enhancements

- **NLP Query Processing**: Natural language to AP API query conversion
- **Intelligent Caching**: TTL-based caching for improved performance
- **Bulk Operations**: Process up to 2,000 items in single operations
- **Trend Analysis**: Real-time trending topic detection and analysis
- **Content Recommendations**: AI-powered content discovery
- **Auto-Pagination**: Seamless handling of large result sets

### 📊 Performance Benchmarks

- **Response Time**: < 200ms for cached queries
- **Bulk Processing**: Up to 50 items per batch request
- **Auto-Pagination**: Handle up to 2,000 results automatically
- **Cache Hit Rate**: ~85% for trending topics and frequent searches
- **Concurrent Requests**: Optimized for high-throughput applications

## 💡 AI Usage Patterns

### Bulk Operations Workflow

AI tools can efficiently process large amounts of news content:

1. **Discover Trending Topics**: Use `get_trending_subjects` to identify what's currently trending
2. **Comprehensive Search**: Use `search_content_all` to get extensive results on trending topics (up to 2,000 items)
3. **Detailed Analysis**: Use `get_content_bulk` to retrieve full content for the most relevant articles (up to 50 items)

### AI-Powered Content Discovery

AI assistants leverage multiple tools for intelligent content discovery:

1. **Query Optimization**: `optimize_search_query` converts natural language to precise search parameters
2. **Trend Analysis**: `analyze_content_trends` provides insights into content patterns and emerging stories
3. **Content Recommendations**: `get_content_recommendations` suggests related articles based on reference content

### Monitoring Setup for AI Applications

AI systems can set up automated content monitoring:

1. **Create Monitors**: Set up content alerts for specific topics, keywords, or breaking news
2. **Track Performance**: Monitor status and get historical data to understand content patterns
3. **Automated Alerts**: Receive notifications when matching content is published

### Caching & Performance Optimization

The server implements intelligent caching to optimize performance:

#### Cache Types & TTL

- **Trending Topics**: 5 minutes (frequently changing data)
- **Search Results**: 3 minutes (balance between freshness and performance)
- **Account Info**: 15 minutes (relatively static data)
- **Monitor Data**: 10 minutes (moderate update frequency)

#### Cache Configuration

```bash
# Customize cache behavior
AP_CACHE_ENABLED=true
AP_CACHE_TTL_TRENDS=300000    # 5 minutes in milliseconds
AP_CACHE_TTL_SEARCH=180000    # 3 minutes in milliseconds
```

#### Performance Tips

1. **Use bulk operations** for processing multiple items
2. **Enable caching** for repeated queries
3. **Leverage trending topics cache** for real-time applications
4. **Batch related requests** to minimize API calls
5. **Use auto-pagination** for large datasets instead of manual pagination

## Development

### Error Handling

The server implements comprehensive error handling:

- **APAPIError**: AP API-specific errors with status codes
- **APConfigurationError**: Configuration and setup errors
- **APNetworkError**: Network and connectivity issues
- **Rate Limiting**: Automatic retry with exponential backoff
- **Validation**: Input validation with clear error messages

### Testing

Run the test suite:

```bash
npm test
```

## Security

- API keys are passed via environment variables only
- No sensitive data is logged or stored
- All requests use HTTPS
- Input validation prevents injection attacks
- Rate limiting prevents API abuse

## ⚠️ Limitations & Considerations

### AP API Constraints

- Requires a valid AP API key with appropriate permissions
- Rate limits enforced by AP API (varies by plan, automatically handled with retry logic)
- Download history limited to last 365 days
- Date range queries limited to 60 days maximum
- Advanced monitoring features may require premium AP API plan

### Performance Considerations

- **Bulk operations** respect AP API rate limits (automatic throttling applied)
- **Cache TTL** can be customized based on your freshness vs. performance needs
- **Large result sets** (>1000 items) may take longer due to auto-pagination
- **AI-powered features** may have slight latency for complex natural language processing

### Intelligent Limits

- `search_content_all`: Maximum 2,000 items (configurable)
- `get_content_bulk`: Maximum 50 items per request
- Caching system automatically manages memory usage with TTL expiration
- AI recommendations limited to 50 suggestions per request for optimal performance

## Troubleshooting

### Common Issues

1. **"AP_API_KEY is required"**
   - Ensure your `.env` file contains `AP_API_KEY=your_key_here`
   - Check that the key is valid and active

2. **"401 Unauthorized"**
   - Verify your API key is correct
   - Check that your key has the required permissions

3. **"Rate limit exceeded"**
   - The server will automatically retry with backoff
   - Consider reducing request frequency

4. **"Network timeout"**
   - Increase `AP_TIMEOUT` in your environment
   - Check network connectivity

### Debug Mode

Enable debug logging:

```bash
export AP_DEBUG=true
export AP_LOG_LEVEL=debug
npm start
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues related to:

- **This MCP server**: Open an issue on GitHub
- **AP API**: Contact AP support at api.ap.org
- **MCP protocol**: See the Model Context Protocol documentation
