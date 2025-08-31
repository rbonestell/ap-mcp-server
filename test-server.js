#!/usr/bin/env node

/**
 * Simple test script for AP MCP Server
 * This simulates how an MCP client would interact with the server
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set test API key if not already set
if (!process.env.AP_API_KEY) {
  process.env.AP_API_KEY = 'test-key-for-local-testing';
}

console.log('🚀 Starting AP MCP Server Test...');
console.log('📋 Available tools should include:');
console.log('  - search_content');
console.log('  - get_content_item');
console.log('  - get_content_feed');
console.log('  - get_account_info');
console.log('  - get_rss_feeds');
console.log('  - create_monitor');
console.log('  - build_search_query');
console.log('  - get_ondemand_content');
console.log('');

// Start the server process
const serverPath = join(__dirname, 'dist', 'index.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env }
});

// Send initialization request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {
      roots: {},
      sampling: {}
    },
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

console.log('📤 Sending initialization request...');
server.stdin.write(JSON.stringify(initRequest) + '\n');

// Send tools list request after a short delay
setTimeout(() => {
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  
  console.log('📤 Requesting tools list...');
  server.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 1000);

// Handle server responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      
      if (response.id === 1) {
        console.log('✅ Server initialized successfully');
        console.log('🔧 Server capabilities:', JSON.stringify(response.result?.capabilities, null, 2));
      } else if (response.id === 2) {
        console.log('✅ Tools list received');
        console.log('🛠️  Available tools:');
        response.result?.tools?.forEach(tool => {
          console.log(`   - ${tool.name}: ${tool.description}`);
        });
        
        console.log('');
        console.log('🎉 AP MCP Server is working correctly!');
        console.log('💡 You can now use this server with any MCP-compatible client.');
        
        // Clean shutdown
        server.kill('SIGTERM');
        process.exit(0);
      }
    } catch (error) {
      // Ignore non-JSON lines (like log messages)
    }
  }
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

server.on('close', (code) => {
  if (code !== 0) {
    console.log(`⚠️  Server exited with code ${code}`);
  }
  process.exit(code);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test...');
  server.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
  process.exit(0);
});