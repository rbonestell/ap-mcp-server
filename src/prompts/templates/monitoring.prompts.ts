import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MonitoringService } from '../../services/MonitoringService.js';
import { formatMonitorConditions } from '../utils/promptHelpers.js';
import { formatMonitorResponse } from '../utils/responseFormatters.js';

export function registerMonitoringPrompts(server: McpServer, monitoringService: MonitoringService) {
  // Create News Monitor Prompt
  server.registerPrompt(
    'create-news-monitor',
    {
      title: 'Create News Monitor',
      description: 'Set up automated monitoring for specific news topics with email alerts',
      argsSchema: {
        topic: z.string().describe('Topic or keywords to monitor'),
        monitor_name: z.string().min(1).max(20).describe('Short name for the monitor (1-20 chars)'),
        email: z.string().email().describe('Email address for notifications'),
        alert_frequency: z.enum(['immediate', '10min', '30min', '1hour', '2hours']).default('30min').describe('How often to check for updates'),
        description: z.string().optional().describe('Optional description of what this monitor tracks')
      }
    },
    async ({ topic, monitor_name, email, alert_frequency, description }) => {
      // Convert frequency to minutes
      const frequencyMap = {
        'immediate': 2,
        '10min': 10,
        '30min': 30,
        '1hour': 60,
        '2hours': 120
      };
      
      const intervalMinutes = frequencyMap[alert_frequency];
      const conditions = formatMonitorConditions('idle', intervalMinutes);
      
      const monitorConfig = {
        name: monitor_name.replace(/[^a-zA-Z0-9_.-]/g, '_'), // Sanitize name
        description: description || `Monitoring news about: ${topic}`,
        notify: [{
          channelType: 'email' as const,
          channelDestinations: [email]
        }],
        conditions,
        playbook: `Monitor for news about "${topic}". Alert when new content is detected.`,
        repeatAlerts: alert_frequency === 'immediate' ? '0' : `PT${intervalMinutes}M`
      };
      
      try {
        const result = await monitoringService.createMonitor(monitorConfig);
        const formatted = formatMonitorResponse(result);
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `${formatted}\n\nThe monitor is now active and will alert you about "${topic}" every ${alert_frequency}.`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error creating monitor: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Breaking Alert Setup Prompt
  server.registerPrompt(
    'breaking-alert-setup',
    {
      title: 'Breaking News Alert Setup',
      description: 'Quick setup for urgent breaking news alerts on critical topics',
      argsSchema: {
        topics: z.array(z.string()).min(1).max(5).describe('Topics to monitor (1-5 topics)'),
        email: z.string().email().describe('Email for urgent notifications'),
        sensitivity: z.enum(['high', 'medium', 'low']).default('high').describe('Alert sensitivity level')
      }
    },
    async ({ topics, email, sensitivity }) => {
      const sensitivitySettings = {
        high: { interval: 2, repeat: '0' },      // Check every 2 min, no repeat delay
        medium: { interval: 5, repeat: 'PT10M' }, // Check every 5 min, repeat after 10 min
        low: { interval: 10, repeat: 'PT30M' }    // Check every 10 min, repeat after 30 min
      };
      
      const settings = sensitivitySettings[sensitivity];
      const monitorName = `breaking_${topics[0].substring(0, 10).replace(/\s/g, '_')}`;
      
      const conditions = formatMonitorConditions('both', settings.interval);
      
      const monitorConfig = {
        name: monitorName,
        description: `URGENT: Breaking news monitor for ${topics.join(', ')}`,
        notify: [{
          channelType: 'email' as const,
          channelDestinations: [email]
        }],
        conditions,
        playbook: `IMMEDIATE ALERT: Check for breaking news on: ${topics.join(', ')}. This is a high-priority monitor.`,
        repeatAlerts: settings.repeat
      };
      
      try {
        const result = await monitoringService.createMonitor(monitorConfig);
        const formatted = formatMonitorResponse(result);
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `🚨 BREAKING NEWS ALERT CONFIGURED 🚨\n\n${formatted}\n\nMonitoring: ${topics.join(', ')}\nSensitivity: ${sensitivity.toUpperCase()}\n\nYou will receive immediate alerts for breaking news on these topics.`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error setting up breaking news alert: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // List Active Monitors Prompt
  server.registerPrompt(
    'list-monitors',
    {
      title: 'List Active Monitors',
      description: 'View all active content monitors and their status',
      argsSchema: {
        include_status: z.boolean().default(true).describe('Include current status information'),
        include_history: z.boolean().default(false).describe('Include recent alert history')
      }
    },
    async ({ include_status, include_history }) => {
      try {
        const monitors = await monitoringService.listMonitors();
        
        if (!monitors || monitors.length === 0) {
          return {
            messages: [{
              role: 'assistant',
              content: {
                type: 'text',
                text: 'No active monitors found. Use "create-news-monitor" or "breaking-alert-setup" to create one.'
              }
            }]
          };
        }
        
        const formattedMonitors = await Promise.all(monitors.map(async (monitor: any) => {
          const parts = [`📍 ${monitor.name}`];
          
          if (monitor.description) {
            parts.push(`   Description: ${monitor.description}`);
          }
          
          if (monitor.conditions) {
            const conditionTypes = monitor.conditions.map((c: any) => c.type).join(', ');
            parts.push(`   Monitoring Type: ${conditionTypes}`);
          }
          
          if (monitor.notify && monitor.notify[0]) {
            const emails = monitor.notify[0].channelDestinations.join(', ');
            parts.push(`   Alerts To: ${emails}`);
          }
          
          if (include_status && monitor.id) {
            try {
              const status = await monitoringService.getMonitorStatus(monitor.id, { show_detail: false });
              if (status?.status) {
                parts.push(`   Status: ${status.status}`);
              }
              if (status?.last_alert) {
                parts.push(`   Last Alert: ${new Date(status.last_alert).toLocaleString()}`);
              }
            } catch (err) {
              // Status not available
            }
          }
          
          if (include_history && monitor.id) {
            try {
              const history = await monitoringService.getMonitorHistory(monitor.id, {
                page_size: 3,
                show_detail: false
              });
              if (history?.alerts && history.alerts.length > 0) {
                parts.push(`   Recent Alerts: ${history.alerts.length} in last 24 hours`);
              }
            } catch (err) {
              // History not available
            }
          }
          
          return parts.join('\n');
        }));
        
        const header = `=== Active Monitors (${monitors.length} total) ===\n`;
        const content = formattedMonitors.join('\n\n');
        
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: header + content
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error listing monitors: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );

  // Monitor Management Prompt
  server.registerPrompt(
    'manage-monitor',
    {
      title: 'Manage Monitor',
      description: 'Update or delete an existing monitor',
      argsSchema: {
        monitor_id: z.string().describe('Monitor ID or name'),
        action: z.enum(['update', 'delete', 'status']).describe('Action to perform'),
        new_email: z.string().email().optional().describe('New email for notifications (update only)'),
        new_frequency: z.enum(['immediate', '10min', '30min', '1hour']).optional().describe('New check frequency (update only)')
      }
    },
    async ({ monitor_id, action, new_email, new_frequency }) => {
      try {
        if (action === 'delete') {
          await monitoringService.deleteMonitor(monitor_id);
          return {
            messages: [{
              role: 'assistant',
              content: {
                type: 'text',
                text: `✅ Monitor "${monitor_id}" has been deleted successfully.`
              }
            }]
          };
        }
        
        if (action === 'status') {
          const status = await monitoringService.getMonitorStatus(monitor_id, { show_detail: true });
          const statusText = JSON.stringify(status, null, 2);
          return {
            messages: [{
              role: 'assistant',
              content: {
                type: 'text',
                text: `Monitor Status for "${monitor_id}":\n\n${statusText}`
              }
            }]
          };
        }
        
        if (action === 'update') {
          // Get existing monitor first
          const existing = await monitoringService.getMonitor(monitor_id);
          
          const updates: any = {
            monitor_id,
            name: existing.name,
            notify: existing.notify,
            conditions: existing.conditions
          };
          
          if (new_email) {
            updates.notify = [{
              channelType: 'email',
              channelDestinations: [new_email]
            }];
          }
          
          if (new_frequency) {
            const frequencyMap = {
              'immediate': 2,
              '10min': 10,
              '30min': 30,
              '1hour': 60
            };
            const intervalMinutes = frequencyMap[new_frequency];
            updates.conditions = formatMonitorConditions('idle', intervalMinutes);
            updates.repeatAlerts = new_frequency === 'immediate' ? '0' : `PT${intervalMinutes}M`;
          }
          
          const result = await monitoringService.updateMonitor(updates);
          const formatted = formatMonitorResponse(result);
          
          return {
            messages: [{
              role: 'assistant',
              content: {
                type: 'text',
                text: `✅ Monitor Updated:\n\n${formatted}`
              }
            }]
          };
        }
      } catch (error) {
        return {
          messages: [{
            role: 'assistant',
            content: {
              type: 'text',
              text: `Error managing monitor: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }]
        };
      }
    }
  );
}