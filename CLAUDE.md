# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides access to the Associated Press Media API. It's built with TypeScript and runs on Node.js 18+, offering tools for content search, account management, and monitoring capabilities.

## Common Development Commands

### Build and Development
```bash
# Build TypeScript
npm run build

# Build and start development server
npm run dev  

# Start the server (requires build first)
npm start

# Clean build artifacts
npm run clean
```

### Code Quality
```bash
# Lint TypeScript files
npm run lint

# Format code with Prettier
npm run format
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Test with real AP API key
AP_API_KEY=your_key npm test
```

## Architecture

### High-Level Structure
The codebase follows a layered service architecture:

- **Entry Point (`src/index.ts`)**: Handles server startup, graceful shutdown, and error handling
- **MCP Server (`src/server/APMCPServer.ts`)**: Main MCP protocol implementation with tool handlers
- **Services Layer**: Domain-specific API operations
  - `ContentService.ts`: Content search, feeds, RSS functionality
  - `AccountService.ts`: Account info, plans, downloads, quotas
  - `MonitoringService.ts`: Content monitoring and alerts
- **HTTP Client (`src/http/APHttpClient.ts`)**: Centralized HTTP handling with retry logic and rate limiting
- **Configuration (`src/config/APConfig.ts`)**: Environment-based configuration management
- **Error Handling (`src/errors/APError.js`)**: Structured error types and handling
- **Types (`src/types/api.types.ts`)**: TypeScript definitions based on AP API OpenAPI schema

### Key Design Patterns
- **Service Layer Pattern**: Business logic separated into domain-specific services
- **Configuration Management**: Environment-based config with validation
- **Error Handling**: Structured error types with specific handling for API, network, and configuration errors
- **HTTP Client Abstraction**: Centralized request handling with automatic retries and rate limiting

## Environment Setup

### Required Environment Variables
```bash
AP_API_KEY=your_ap_api_key_here  # Required - get from api.ap.org
```

### Optional Configuration
```bash
AP_BASE_URL=https://api.ap.org/media/v  # API base URL
AP_TIMEOUT=30000                         # Request timeout (ms)
AP_RETRIES=3                            # Retry attempts
AP_DEBUG=false                          # Debug logging
AP_LOG_LEVEL=info                       # Log level (error, warn, info, debug)
AP_VERBOSE_LOGGING=false                # Request/response logging
```

Copy `.env.example` to `.env` and configure as needed.

## MCP Tools Architecture

The server exposes several MCP tools organized by domain:

### Content Tools
- `search_content`: Main content search with flexible parameters
- `get_content_item`: Single item retrieval by ID
- `get_content_feed`: Live AP content feed
- `get_rss_feeds`/`get_rss_feed`: RSS feed management
- `get_ondemand_content`: OnDemand queue access

### Account Tools
- `get_account_info`: Basic account information
- `get_account_plans`: Plans, entitlements, usage meters
- `get_account_downloads`: Download history

### Monitoring Tools
- `create_monitor`/`list_monitors`: Content monitoring and alerts

### Utility Tools
- `build_search_query`: Query builder with validation

## Error Handling Strategy

The codebase implements comprehensive error handling with specific error types:
- **APAPIError**: AP API-specific errors with status codes
- **APConfigurationError**: Configuration and setup errors
- **APNetworkError**: Network and connectivity issues
- Automatic retry with exponential backoff for rate limits
- Input validation with clear error messages

## Development Notes

### TypeScript Configuration
- Strict mode enabled with comprehensive type checking
- ES2022 target with ESNext modules
- Source maps and declarations generated
- Unused locals/parameters detection enabled

### Module System
- Uses ES modules (`"type": "module"` in package.json)
- All imports use `.js` extensions for compiled output
- Module resolution set to `nodenext`

### Service Dependencies
Services depend on the HTTP client which handles:
- Base URL configuration
- Authentication headers (API key)
- Retry logic and rate limiting
- Request/response logging
- Error transformation

## Testing Approach

Tests can be run with or without a real AP API key:
- Without key: Tests focus on validation and error handling
- With key: Full integration testing against live AP API
- Jest configuration supports both scenarios