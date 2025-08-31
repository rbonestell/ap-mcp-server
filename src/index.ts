#!/usr/bin/env node

/**
 * Associated Press MCP Server
 * Entry point for the MCP server that provides access to AP Media API
 */

import { APMCPServer } from './server/APMCPServer.js';
import { APConfigurationError } from './errors/APError.js';

async function main() {
  try {
    // Create and start the MCP server
    const server = new APMCPServer();
    await server.run();
  } catch (error) {
    // Handle configuration errors specifically
    if (error instanceof APConfigurationError) {
      console.error('Configuration Error:', error.message);
      console.error('Please check your environment variables and configuration.');
      console.error('Required: AP_API_KEY environment variable');
      console.error('Optional: AP_BASE_URL, AP_TIMEOUT, AP_RETRIES');
      process.exit(1);
    }

    // Handle other errors
    console.error('Failed to start AP MCP Server:', error);
    process.exit(1);
  }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});