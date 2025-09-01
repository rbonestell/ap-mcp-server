# Associated Press MCP Server

A Model Context Protocol (MCP) server that provides access to the Associated Press Media API. This server allows MCP clients to search, retrieve, and interact with AP's comprehensive news content, account information, and monitoring capabilities.

> [!NOTE]
> For more info about the AP Media API, visit the AP [developer documentation](https://developer.ap.org/ap-media-api/).

## Features

- **Content Operations**: Search content, get specific items, access live feeds, RSS feeds
- **Account Management**: View account info, plans, download history, quotas
- **Monitoring & Alerts**: Create and manage content monitors (basic implementation)
- **Comprehensive Type Safety**: Full TypeScript implementation with OpenAPI-based types
- **Robust Error Handling**: Graceful handling of API errors, rate limits, and network issues
- **Environment Configuration**: Easy setup with environment variables

## Quick Start

### Prerequisites

- Node.js 18+
- An Associated Press API key (get one at [api.ap.org](https://api.ap.org))

### Installation

1. Clone or download this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

4. Add your AP API key to `.env`:

   ```bash
   AP_API_KEY=your_actual_api_key_here
   ```

5. Build and start the server:
   ```bash
   npm run build
   npm start
   ```

## Configuration

### Environment Variables

| Variable       | Required | Default                      | Description                          |
| -------------- | -------- | ---------------------------- | ------------------------------------ |
| `AP_API_KEY`   | ✅       | -                            | Your AP API key                      |
| `AP_BASE_URL`  | ❌       | `https://api.ap.org/media/v` | AP API base URL                      |
| `AP_TIMEOUT`   | ❌       | `30000`                      | Request timeout (ms)                 |
| `AP_RETRIES`   | ❌       | `3`                          | Retry attempts for failed requests   |
| `AP_DEBUG`     | ❌       | `false`                      | Enable debug logging                 |
| `AP_LOG_LEVEL` | ❌       | `info`                       | Log level (error, warn, info, debug) |

### MCP Client Configuration

Add this to your MCP client configuration:

```json
{
	"mcpServers": {
		"ap-media": {
			"command": "node",
			"args": ["path/to/ap-mcp-server/dist/index.js"],
			"env": {
				"AP_API_KEY": "your_api_key_here"
			}
		}
	}
}
```

## Available Tools

### Content Tools

#### `search_content`

Search AP content using flexible query parameters.

**Parameters:**

- `query` (string): Search query
- `sort` (string): Sort criteria (default: `_score:desc`)
- `page` (number): Page number (starts at 1)
- `page_size` (number): Items per page
- `include` (array): Fields to include in response
- `exclude` (array): Fields to exclude from response
- `pricing` (boolean): Include pricing information
- `in_my_plan` (boolean): Only return items in your plan

**Example:**

```typescript
{
  "query": "climate change",
  "page_size": 10,
  "sort": "versioncreated:desc"
}
```

#### `get_content_item`

Get a specific content item by its ID.

**Parameters:**

- `item_id` (string, required): The AP item ID
- `include` (array): Fields to include
- `exclude` (array): Fields to exclude
- `pricing` (boolean): Include pricing information

#### `get_content_feed`

Access the live AP content feed.

**Parameters:**

- `query` (string): Filter query
- `page_size` (number): Number of items to return
- `include`/`exclude` (arrays): Field filtering
- `pricing` (boolean): Include pricing

#### `get_rss_feeds`

List all available RSS feeds for your account.

#### `get_rss_feed`

Get content from a specific RSS feed.

**Parameters:**

- `rss_id` (number, required): RSS feed ID
- `page_size` (number): Items per page
- `include`/`exclude` (arrays): Field filtering

#### `get_ondemand_content`

Access your organization's OnDemand queue.

**Parameters:**

- `consumer_id` (string): Consumer identifier
- `queue` (string): Queue ID
- `page_size` (number): Items per page

### Account Tools

#### `get_account_info`

Get basic account information and available endpoints.

#### `get_account_plans`

View your account plans, entitlements, and usage meters.

#### `get_account_downloads`

View your download history.

**Parameters:**

- `min_date` (string): Start date (YYYY-MM-DD or ISO-8601)
- `max_date` (string): End date (YYYY-MM-DD or ISO-8601)
- `format` (string): Response format (`json` or `csv`)

### Monitoring Tools

#### `create_monitor`

Create a new content monitor for alerts.

**Parameters:**

- `name` (string, required): Monitor name
- `description` (string): Monitor description
- `conditions` (array): Monitoring conditions
- `notify` (array): Notification settings

#### `list_monitors`

List all your existing monitors.

### Utility Tools

#### `build_search_query`

Helper tool to build structured search queries with validation.

**Parameters:**

- `keywords` (array): Keywords to search
- `operators` (array): Search operators (AND, OR, NOT)
- `date_range` (object): Date range filters
- `content_types` (array): Content type filters

## API Coverage

This MCP server provides access to the following AP API endpoints:

### Content Endpoints

- ✅ `/content/search` - Content search
- ✅ `/content/{item_id}` - Single item lookup
- ✅ `/content/feed` - Live content feed
- ✅ `/content/rss` - RSS feed list
- ✅ `/content/rss/{rss_id}` - Specific RSS feed
- ✅ `/content/ondemand` - OnDemand queue

### Account Endpoints

- ✅ `/account` - Account information
- ✅ `/account/plans` - Plans and entitlements
- ✅ `/account/downloads` - Download history
- ✅ `/account/quotas` - API quotas
- ✅ `/account/followedtopics` - Followed topics

### Monitoring Endpoints (Basic)

- ✅ `/account/monitors/create` - Create monitor
- ✅ `/account/monitors` - List monitors
- ✅ `/account/monitors/{id}` - Get monitor
- ✅ `/account/monitors/{id}/update` - Update monitor
- ✅ `/account/monitors/{id}/delete` - Delete monitor

## Development

### Project Structure

```
src/
├── server/
│   └── APMCPServer.ts          # Main MCP server
├── services/
│   ├── ContentService.ts       # Content API operations
│   ├── AccountService.ts       # Account operations
│   └── MonitoringService.ts    # Monitor management
├── http/
│   └── APHttpClient.ts         # HTTP client with retry logic
├── types/
│   └── api.types.ts           # TypeScript type definitions
├── config/
│   └── APConfig.ts            # Configuration management
├── errors/
│   └── APError.ts             # Error handling
├── utils/
│   └── validators.ts          # Input validation
└── index.ts                   # Entry point
```

### Scripts

```bash
npm run build       # Build TypeScript
npm run dev         # Build and start
npm start          # Start the server
npm test           # Run tests
npm run lint       # Lint TypeScript files
npm run format     # Format code with Prettier
npm run clean      # Remove build artifacts
```

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

Test with a real AP API key:

```bash
AP_API_KEY=your_key npm test
```

## Security

- API keys are passed via environment variables only
- No sensitive data is logged or stored
- All requests use HTTPS
- Input validation prevents injection attacks
- Rate limiting prevents API abuse

## Limitations

- Requires a valid AP API key with appropriate permissions
- Rate limits enforced by AP API (varies by plan)
- Download history limited to last 365 days
- Date range queries limited to 60 days maximum
- Monitoring features require appropriate API plan

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
