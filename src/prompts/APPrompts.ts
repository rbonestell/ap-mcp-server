import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ContentService } from '../services/ContentService.js';
import { MonitoringService } from '../services/MonitoringService.js';
import { registerSearchPrompts } from './templates/search.prompts.js';
import { registerMonitoringPrompts } from './templates/monitoring.prompts.js';
import { registerAnalysisPrompts } from './templates/analysis.prompts.js';
import { registerWorkflowPrompts } from './templates/workflow.prompts.js';

/**
 * Register all AP Media API prompts with the MCP server
 * 
 * This module provides intelligent prompt templates that simplify
 * and optimize usage of the AP Media API through conversational interfaces.
 * 
 * @param server - The MCP server instance
 * @param contentService - The content service for AP API operations
 * @param monitoringService - The monitoring service for alerts and monitors
 */
export function registerAPPrompts(
  server: McpServer,
  contentService: ContentService,
  monitoringService: MonitoringService
) {
  // Register search-related prompts
  // These prompts handle various search scenarios with optimized defaults
  registerSearchPrompts(server, contentService);
  
  // Register monitoring and alert prompts
  // These prompts simplify the creation and management of content monitors
  registerMonitoringPrompts(server, monitoringService);
  
  // Register analysis and trending prompts
  // These prompts provide insights into trending topics and content patterns
  registerAnalysisPrompts(server, contentService);
  
  // Register workflow prompts
  // These prompts orchestrate complex multi-step operations
  registerWorkflowPrompts(server, contentService);
  
  // Log successful registration
  console.log('✅ AP Media API Prompts registered successfully');
  console.log('   - Search prompts: breaking-news-search, topic-deep-dive, multimedia-search, regional-coverage, smart-search');
  console.log('   - Monitoring prompts: create-news-monitor, breaking-alert-setup, list-monitors, manage-monitor');
  console.log('   - Analysis prompts: trend-analysis, content-recommendations, coverage-comparison, quick-trending');
  console.log('   - Workflow prompts: daily-news-briefing, research-workflow, content-curation, story-development');
}

/**
 * Get information about available prompts
 * Useful for documentation and discovery
 */
export function getPromptInfo() {
  return {
    categories: {
      search: {
        description: 'Search and discovery prompts for finding AP content',
        prompts: [
          'breaking-news-search',
          'topic-deep-dive',
          'multimedia-search',
          'regional-coverage',
          'smart-search'
        ]
      },
      monitoring: {
        description: 'Create and manage content monitors and alerts',
        prompts: [
          'create-news-monitor',
          'breaking-alert-setup',
          'list-monitors',
          'manage-monitor'
        ]
      },
      analysis: {
        description: 'Analyze trends, get recommendations, and compare coverage',
        prompts: [
          'trend-analysis',
          'content-recommendations',
          'coverage-comparison',
          'quick-trending'
        ]
      },
      workflow: {
        description: 'Complex multi-step workflows for content operations',
        prompts: [
          'daily-news-briefing',
          'research-workflow',
          'content-curation',
          'story-development'
        ]
      }
    },
    total_prompts: 17,
    benefits: [
      'Simplified access to AP Media API functionality',
      'Optimized parameters for common use cases',
      'Natural language interaction patterns',
      'Reduced token usage through abstraction',
      'Built-in best practices and intelligent defaults'
    ]
  };
}