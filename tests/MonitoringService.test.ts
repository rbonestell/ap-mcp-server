/**
 * Tests for MonitoringService - Service for AP Monitoring and Alerts API operations
 * Tests monitor CRUD operations, validation logic, and helper methods
 */

import { MonitoringService } from '../src/services/MonitoringService.js';
import { APHttpClient } from '../src/http/APHttpClient.js';
import { APValidationError, APError, APAPIError } from '../src/errors/APError.js';
import { Monitor } from '../src/types/api.types.js';
import { mockMonitors } from './fixtures/api-responses.js';

// Mock APHttpClient
jest.mock('../src/http/APHttpClient.js');
const MockAPHttpClient = APHttpClient as jest.MockedClass<typeof APHttpClient>;

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockHttpClient: jest.Mocked<APHttpClient>;

  beforeEach(() => {
    mockHttpClient = new MockAPHttpClient({} as any) as jest.Mocked<APHttpClient>;
    monitoringService = new MonitoringService(mockHttpClient);
  });

  // Helper function to create a valid monitor
  const createValidMonitor = (overrides: Partial<Monitor> = {}): Monitor => ({
    name: 'test-monitor',
    description: 'Test monitor description',
    playbook: 'Test playbook instructions',
    repeatAlerts: 'PT1H',
    notify: [{
      channelType: 'email',
      channelDestinations: ['test@example.com']
    }],
    conditions: [{
      type: 'idleFeed',
      enabled: true,
      criteria: {
        idleTime: 'PT15M'
      }
    }],
    ...overrides
  });

  describe('createMonitor', () => {
    test('should create monitor with valid data', async () => {
      const monitor = createValidMonitor();
      mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });

      const result = await monitoringService.createMonitor(monitor);

      expect(mockHttpClient.post).toHaveBeenCalledWith('account/monitors/create', { monitor });
      expect(result).toEqual(mockMonitors);
    });

    test('should validate monitor before creation', async () => {
      const invalidMonitor = createValidMonitor({ name: '' });

      await expect(monitoringService.createMonitor(invalidMonitor))
        .rejects.toThrow(APValidationError);
    });

    test('should handle HTTP errors with context', async () => {
      const monitor = createValidMonitor();
      const error = new APAPIError('Monitor creation failed', 'MONITOR_ERROR', 400);
      mockHttpClient.post.mockRejectedValueOnce(error);

      const thrownError = await monitoringService.createMonitor(monitor).catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.details.operation).toBe('createMonitor');
      expect(thrownError.details.context).toEqual({ monitor });
    });
  });

  describe('updateMonitor', () => {
    test('should update monitor with valid data', async () => {
      const monitor = createValidMonitor();
      const monitorId = 'test-monitor-123';
      mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.updateMonitor(monitorId, monitor);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        `account/monitors/${encodeURIComponent(monitorId)}/update`,
        { monitor }
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should validate monitor ID', async () => {
      const monitor = createValidMonitor();

      await expect(monitoringService.updateMonitor('', monitor))
        .rejects.toThrow(APValidationError);

      await expect(monitoringService.updateMonitor(null as any, monitor))
        .rejects.toThrow(APValidationError);

      await expect(monitoringService.updateMonitor(123 as any, monitor))
        .rejects.toThrow(APValidationError);
    });

    test('should URL encode monitor ID', async () => {
      const monitor = createValidMonitor();
      const monitorId = 'test monitor with spaces';
      mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      await monitoringService.updateMonitor(monitorId, monitor);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'account/monitors/test%20monitor%20with%20spaces/update',
        { monitor }
      );
    });

    test('should validate monitor definition', async () => {
      const invalidMonitor = createValidMonitor({ notify: [] });

      await expect(monitoringService.updateMonitor('test-id', invalidMonitor))
        .rejects.toThrow(APValidationError);
    });
  });

  describe('deleteMonitor', () => {
    test('should delete monitor with valid ID', async () => {
      const monitorId = 'test-monitor-123';
      mockHttpClient.delete.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.deleteMonitor(monitorId);

      expect(mockHttpClient.delete).toHaveBeenCalledWith(
        `account/monitors/${encodeURIComponent(monitorId)}/delete`
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should validate monitor ID', async () => {
      await expect(monitoringService.deleteMonitor(''))
        .rejects.toThrow(APValidationError);

      await expect(monitoringService.deleteMonitor(null as any))
        .rejects.toThrow(APValidationError);
    });

    test('should handle errors with context', async () => {
      const monitorId = 'test-monitor';
      const error = new APAPIError('Monitor not found', 'NOT_FOUND', 404);
      mockHttpClient.delete.mockRejectedValueOnce(error);

      const thrownError = await monitoringService.deleteMonitor(monitorId).catch(e => e);

      expect(thrownError.details.context).toEqual({ monitorId });
    });
  });

  describe('listMonitors', () => {
    test('should list all monitors', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.listMonitors();

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/monitors');
      expect(result).toEqual(mockMonitors);
    });

    test('should handle errors', async () => {
      const error = new APAPIError('Access denied', 'FORBIDDEN', 403);
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await monitoringService.listMonitors().catch(e => e);

      expect(thrownError.details.operation).toBe('listMonitors');
    });
  });

  describe('getMonitor', () => {
    test('should get specific monitor', async () => {
      const monitorId = 'test-monitor-123';
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.getMonitor(monitorId);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/${encodeURIComponent(monitorId)}`
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should validate monitor ID', async () => {
      await expect(monitoringService.getMonitor(''))
        .rejects.toThrow(APValidationError);

      await expect(monitoringService.getMonitor(undefined as any))
        .rejects.toThrow(APValidationError);
    });

    test('should URL encode special characters in monitor ID', async () => {
      const monitorId = 'test/monitor?id=123';
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      await monitoringService.getMonitor(monitorId);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'account/monitors/test%2Fmonitor%3Fid%3D123'
      );
    });
  });

  describe('getRecentAlerts', () => {
    test('should get recent alerts with no parameters', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.getRecentAlerts();

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/monitors/alerts', {});
      expect(result).toEqual(mockMonitors);
    });

    test('should get recent alerts with parameters', async () => {
      const options = {
        show_detail: true,
        agentid: 'agent-123'
      };

      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.getRecentAlerts(options);

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/monitors/alerts', options);
      expect(result).toEqual(mockMonitors);
    });

    test('should validate alert parameters', async () => {
      await expect(monitoringService.getRecentAlerts({ show_detail: 'true' as any }))
        .rejects.toThrow(APValidationError);

      await expect(monitoringService.getRecentAlerts({ agentid: 123 as any }))
        .rejects.toThrow(APValidationError);
    });
  });

  describe('getMonitoredSessions', () => {
    test('should get monitored sessions with parameters', async () => {
      const options = {
        show_detail: false,
        agentid: 'agent-456'
      };

      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.getMonitoredSessions(options);

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/monitors/sessions', options);
      expect(result).toEqual(mockMonitors);
    });

    test('should validate session parameters', async () => {
      await expect(monitoringService.getMonitoredSessions({ show_detail: 1 as any }))
        .rejects.toThrow(APValidationError);
    });
  });

  describe('getMonitoredSession', () => {
    test('should get monitored session without detail', async () => {
      const sessionId = 'session-123';
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.getMonitoredSession(sessionId);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/sessions/${encodeURIComponent(sessionId)}`,
        {}
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should get monitored session with detail', async () => {
      const sessionId = 'session-123';
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.getMonitoredSession(sessionId, true);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/sessions/${encodeURIComponent(sessionId)}`,
        { show_detail: true }
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should validate session ID', async () => {
      await expect(monitoringService.getMonitoredSession(''))
        .rejects.toThrow(APValidationError);

      await expect(monitoringService.getMonitoredSession(null as any))
        .rejects.toThrow(APValidationError);
    });
  });

  describe('disableSessionMonitor', () => {
    test('should disable session monitor without agent ID', async () => {
      const sessionId = 'session-123';
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.disableSessionMonitor(sessionId);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/sessions/${encodeURIComponent(sessionId)}/disable`,
        {}
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should disable session monitor with agent ID', async () => {
      const sessionId = 'session-123';
      const agentId = 'agent-456';
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.disableSessionMonitor(sessionId, agentId);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/sessions/${encodeURIComponent(sessionId)}/disable`,
        { agentid: agentId }
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should validate session ID', async () => {
      await expect(monitoringService.disableSessionMonitor(''))
        .rejects.toThrow(APValidationError);
    });
  });

  describe('enableSessionMonitor', () => {
    test('should enable session monitor', async () => {
      const sessionId = 'session-123';
      const agentId = 'agent-789';
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });

      const result = await monitoringService.enableSessionMonitor(sessionId, agentId);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/sessions/${encodeURIComponent(sessionId)}/enable`,
        { agentid: agentId }
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should validate session ID', async () => {
      await expect(monitoringService.enableSessionMonitor(''))
        .rejects.toThrow(APValidationError);
    });
  });

  describe('getMonitorStatus', () => {
    test('should get monitor status with default options', async () => {
      const monitorId = 'test-monitor';
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });
      
      const result = await monitoringService.getMonitorStatus(monitorId);
      
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/${encodeURIComponent(monitorId)}/status`,
        {}
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should get monitor status with options', async () => {
      const monitorId = 'test-monitor';
      const options = { show_detail: true, agentid: 'agent-123' };
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });
      
      const result = await monitoringService.getMonitorStatus(monitorId, options);
      
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/${encodeURIComponent(monitorId)}/status`,
        options
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should validate monitor ID', async () => {
      await expect(monitoringService.getMonitorStatus(''))
        .rejects.toThrow(APValidationError);
    });

    test('should validate status parameters', async () => {
      await expect(monitoringService.getMonitorStatus('test', { show_detail: 'invalid' as any }))
        .rejects.toThrow(APValidationError);
    });
  });

  describe('getMonitorHistory', () => {
    test('should get monitor history with default options', async () => {
      const monitorId = 'test-monitor';
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });
      
      const result = await monitoringService.getMonitorHistory(monitorId);
      
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/${encodeURIComponent(monitorId)}/history`,
        {}
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should get monitor history with all options', async () => {
      const monitorId = 'test-monitor';
      const options = {
        show_detail: true,
        agentid: 'agent-123',
        min_date: '2024-01-01',
        max_date: '2024-01-31',
        page: '1',
        page_size: 25
      };
      mockHttpClient.get.mockResolvedValueOnce({ data: mockMonitors, status: 200, statusText: 'OK', headers: {} });
      
      const result = await monitoringService.getMonitorHistory(monitorId, options);
      
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `account/monitors/${encodeURIComponent(monitorId)}/history`,
        options
      );
      expect(result).toEqual(mockMonitors);
    });

    test('should validate monitor ID', async () => {
      await expect(monitoringService.getMonitorHistory(''))
        .rejects.toThrow(APValidationError);
    });

    test('should validate history parameters', async () => {
      await expect(monitoringService.getMonitorHistory('test', { page_size: 0 }))
        .rejects.toThrow(APValidationError);
      
      await expect(monitoringService.getMonitorHistory('test', { page_size: 101 }))
        .rejects.toThrow(APValidationError);
      
      await expect(monitoringService.getMonitorHistory('test', { show_detail: 'invalid' as any }))
        .rejects.toThrow(APValidationError);
      
      await expect(monitoringService.getMonitorHistory('test', { page: 123 as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate date range', async () => {
      await expect(monitoringService.getMonitorHistory('test', { 
        min_date: '2024-01-31',
        max_date: '2024-01-01'
      }))
        .rejects.toThrow(APValidationError);
    });

    test('should handle invalid dates', async () => {
      await expect(monitoringService.getMonitorHistory('test', { 
        min_date: 'invalid-date'
      }))
        .rejects.toThrow(APValidationError);
    });
  });

  describe('Monitor validation', () => {
    describe('name validation', () => {
      test('should validate monitor name is required', async () => {
        const monitor = createValidMonitor({ name: '' });
        await expect(monitoringService.createMonitor(monitor))
          .rejects.toThrow(APValidationError);
      });

      test('should validate monitor name is string', async () => {
        const monitor = createValidMonitor({ name: 123 as any });
        await expect(monitoringService.createMonitor(monitor))
          .rejects.toThrow(APValidationError);
      });

      test('should validate monitor name length', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({ name: '' })))
          .rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({ name: 'a'.repeat(21) })))
          .rejects.toThrow(APValidationError);

        // Valid length should not throw
        mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });
        await expect(monitoringService.createMonitor(createValidMonitor({ name: 'valid-name' })))
          .resolves.toBeDefined();
      });

      test('should validate monitor name characters', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({ name: 'invalid name!' })))
          .rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({ name: 'invalid@name' })))
          .rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({ name: 'invalid#name' })))
          .rejects.toThrow(APValidationError);

        // Valid characters should not throw
        mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });
        await expect(monitoringService.createMonitor(createValidMonitor({ name: 'valid_name-123.test' })))
          .resolves.toBeDefined();
      });
    });

    describe('description validation', () => {
      test('should allow undefined description', async () => {
        const monitor = createValidMonitor();
        delete monitor.description;
        
        mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });
        await expect(monitoringService.createMonitor(monitor)).resolves.toBeDefined();
      });

      test('should validate description is string', async () => {
        const monitor = createValidMonitor({ description: 123 as any });
        await expect(monitoringService.createMonitor(monitor))
          .rejects.toThrow(APValidationError);
      });
    });

    describe('playbook validation', () => {
      test('should validate playbook is string', async () => {
        const monitor = createValidMonitor({ playbook: 123 as any });
        await expect(monitoringService.createMonitor(monitor))
          .rejects.toThrow(APValidationError);
      });
    });

    describe('repeatAlerts validation', () => {
      test('should validate repeatAlerts format', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({ repeatAlerts: 'invalid' })))
          .rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({ repeatAlerts: 'PT' })))
          .rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({ repeatAlerts: 'P1D' })))
          .rejects.toThrow(APValidationError);

        // Valid formats should not throw
        mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });
        await expect(monitoringService.createMonitor(createValidMonitor({ repeatAlerts: '0' })))
          .resolves.toBeDefined();

        mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });
        await expect(monitoringService.createMonitor(createValidMonitor({ repeatAlerts: 'PT30M' })))
          .resolves.toBeDefined();

        mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });
        await expect(monitoringService.createMonitor(createValidMonitor({ repeatAlerts: 'PT2H' })))
          .resolves.toBeDefined();
      });

      test('should validate repeatAlerts is string', async () => {
        const monitor = createValidMonitor({ repeatAlerts: 123 as any });
        await expect(monitoringService.createMonitor(monitor))
          .rejects.toThrow(APValidationError);
      });
    });

    describe('notify validation', () => {
      test('should require notify array', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({ notify: undefined as any })))
          .rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({ notify: 'not-array' as any })))
          .rejects.toThrow(APValidationError);
      });

      test('should validate notify array length', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({ notify: [] })))
          .rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({ 
          notify: Array(6).fill({ channelType: 'email', channelDestinations: ['test@example.com'] })
        }))).rejects.toThrow(APValidationError);
      });

      test('should validate notification channel type', async () => {
        const monitor = createValidMonitor({
          notify: [{
            channelType: 'sms' as any,
            channelDestinations: ['test@example.com']
          }]
        });
        
        await expect(monitoringService.createMonitor(monitor))
          .rejects.toThrow(APValidationError);
      });

      test('should validate channel destinations', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({
          notify: [{
            channelType: 'email',
            channelDestinations: undefined as any
          }]
        }))).rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({
          notify: [{
            channelType: 'email',
            channelDestinations: 'not-array' as any
          }]
        }))).rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({
          notify: [{
            channelType: 'email',
            channelDestinations: []
          }]
        }))).rejects.toThrow(APValidationError);
      });

      test('should validate email addresses', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({
          notify: [{
            channelType: 'email',
            channelDestinations: ['invalid-email']
          }]
        }))).rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({
          notify: [{
            channelType: 'email',
            channelDestinations: ['valid@example.com', 'invalid-email']
          }]
        }))).rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({
          notify: [{
            channelType: 'email',
            channelDestinations: [123 as any]
          }]
        }))).rejects.toThrow(APValidationError);
      });
    });

    describe('conditions validation', () => {
      test('should require conditions array', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({ conditions: undefined as any })))
          .rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({ conditions: 'not-array' as any })))
          .rejects.toThrow(APValidationError);
      });

      test('should validate conditions array length', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({ conditions: [] })))
          .rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({ 
          conditions: Array(6).fill({ type: 'quality', enabled: true, criteria: {} })
        }))).rejects.toThrow(APValidationError);
      });

      test('should validate condition type', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({
          conditions: [{
            type: 'invalid' as any,
            enabled: true,
            criteria: {}
          }]
        }))).rejects.toThrow(APValidationError);
      });

      test('should validate condition enabled field', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({
          conditions: [{
            type: 'quality',
            enabled: 'true' as any,
            criteria: {}
          }]
        }))).rejects.toThrow(APValidationError);
      });

      test('should validate idleFeed condition requires idleTime', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({
          conditions: [{
            type: 'idleFeed',
            enabled: true,
            criteria: {}
          }]
        }))).rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({
          conditions: [{
            type: 'idleFeed',
            enabled: true,
            criteria: { idleTime: undefined }
          }]
        }))).rejects.toThrow(APValidationError);
      });

      test('should validate idleTime format', async () => {
        await expect(monitoringService.createMonitor(createValidMonitor({
          conditions: [{
            type: 'idleFeed',
            enabled: true,
            criteria: { idleTime: 'invalid' }
          }]
        }))).rejects.toThrow(APValidationError);

        await expect(monitoringService.createMonitor(createValidMonitor({
          conditions: [{
            type: 'idleFeed',
            enabled: true,
            criteria: { idleTime: 'P1D' }
          }]
        }))).rejects.toThrow(APValidationError);

        // Valid formats should not throw
        mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });
        await expect(monitoringService.createMonitor(createValidMonitor({
          conditions: [{
            type: 'idleFeed',
            enabled: true,
            criteria: { idleTime: 'PT15M' }
          }]
        }))).resolves.toBeDefined();

        mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });
        await expect(monitoringService.createMonitor(createValidMonitor({
          conditions: [{
            type: 'idleFeed',
            enabled: true,
            criteria: { idleTime: 'PT2H30M' }
          }]
        }))).resolves.toBeDefined();
      });

      test('should allow quality condition without idleTime', async () => {
        mockHttpClient.post.mockResolvedValueOnce({ data: mockMonitors, status: 201, statusText: 'Created', headers: {} });
        await expect(monitoringService.createMonitor(createValidMonitor({
          conditions: [{
            type: 'quality',
            enabled: true,
            criteria: {}
          }]
        }))).resolves.toBeDefined();
      });
    });
  });

  describe('Static helper methods', () => {
    describe('createBasicIdleMonitor', () => {
      test('should create basic idle monitor with defaults', () => {
        const result = MonitoringService.createBasicIdleMonitor('test-monitor', ['test@example.com']);

        expect(result).toEqual({
          name: 'test-monitor',
          description: 'Monitor for idle feed - test-monitor',
          playbook: 'Check the health of your feed script when no content is received.',
          repeatAlerts: 'PT2H',
          notify: [{
            channelType: 'email',
            channelDestinations: ['test@example.com'],
          }],
          conditions: [{
            type: 'idleFeed',
            enabled: true,
            criteria: {
              idleTime: 'PT15M',
            },
          }],
        });
      });

      test('should create basic idle monitor with custom parameters', () => {
        const result = MonitoringService.createBasicIdleMonitor(
          'custom-monitor',
          ['admin@example.com', 'ops@example.com'],
          30,
          'Custom description'
        );

        expect(result.name).toBe('custom-monitor');
        expect(result.description).toBe('Custom description');
        expect(result.notify[0].channelDestinations).toEqual(['admin@example.com', 'ops@example.com']);
        expect(result.conditions[0].criteria.idleTime).toBe('PT30M');
      });
    });

    describe('createQualityMonitor', () => {
      test('should create quality monitor with defaults', () => {
        const result = MonitoringService.createQualityMonitor('quality-monitor', ['test@example.com']);

        expect(result).toEqual({
          name: 'quality-monitor',
          description: 'Quality monitor - quality-monitor',
          playbook: 'Review content quality issues and take appropriate action.',
          repeatAlerts: 'PT1H',
          notify: [{
            channelType: 'email',
            channelDestinations: ['test@example.com'],
          }],
          conditions: [{
            type: 'quality',
            enabled: true,
            criteria: {},
          }],
        });
      });

      test('should create quality monitor with custom description', () => {
        const result = MonitoringService.createQualityMonitor(
          'qa-monitor',
          ['qa@example.com'],
          'Custom quality monitor description'
        );

        expect(result.name).toBe('qa-monitor');
        expect(result.description).toBe('Custom quality monitor description');
        expect(result.notify[0].channelDestinations).toEqual(['qa@example.com']);
      });
    });
  });

  describe('Email validation', () => {
    test('should validate correct email addresses', () => {
      const service = monitoringService as any; // Access private method for testing
      
      expect(service.isValidEmail('test@example.com')).toBe(true);
      expect(service.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(service.isValidEmail('user+tag@example.org')).toBe(true);
      expect(service.isValidEmail('123@test-domain.com')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      const service = monitoringService as any;
      
      expect(service.isValidEmail('invalid')).toBe(false);
      expect(service.isValidEmail('@example.com')).toBe(false);
      expect(service.isValidEmail('user@')).toBe(false);
      expect(service.isValidEmail('user name@example.com')).toBe(false);
      expect(service.isValidEmail('user@ex ample.com')).toBe(false);
      expect(service.isValidEmail('')).toBe(false);
    });
  });

  describe('Error handling', () => {
    test('should preserve AP error details when wrapping', async () => {
      const originalError = new APAPIError('Original error', 404, 'ORIGINAL_CODE', { 
        field: 'test', 
        originalContext: 'value' 
      });
      
      mockHttpClient.get.mockRejectedValueOnce(originalError);

      const thrownError = await monitoringService.listMonitors().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.message).toBe('Original error');
      expect(thrownError.code).toBe('ORIGINAL_CODE');
      expect(thrownError.statusCode).toBe(404);
      expect(thrownError.details.operation).toBe('listMonitors');
      expect(thrownError.details.field).toBe('test');
      expect(thrownError.details.originalContext).toBe('value');
    });

    test('should create new error for non-AP errors', async () => {
      const genericError = new Error('Network timeout');
      mockHttpClient.get.mockRejectedValueOnce(genericError);

      const thrownError = await monitoringService.getRecentAlerts().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.code).toBe('MONITORING_SERVICE_ERROR');
      expect(thrownError.message).toContain('MonitoringService.getRecentAlerts failed');
      expect(thrownError.details.operation).toBe('getRecentAlerts');
      expect(thrownError.details.originalError).toBe(genericError);
    });

    test('should handle various error types', async () => {
      // String error
      mockHttpClient.post.mockRejectedValueOnce('String error');
      let thrownError = await monitoringService.createMonitor(createValidMonitor()).catch(e => e);
      expect(thrownError.message).toContain('MonitoringService.createMonitor failed: String error');

      // Null error
      mockHttpClient.delete.mockRejectedValueOnce(null);
      thrownError = await monitoringService.deleteMonitor('test').catch(e => e);
      expect(thrownError.message).toContain('MonitoringService.deleteMonitor failed');

      // Object error
      mockHttpClient.get.mockRejectedValueOnce({ error: 'object error' });
      thrownError = await monitoringService.getMonitor('test').catch(e => e);
      expect(thrownError.message).toContain('MonitoringService.getMonitor failed');
    });
  });
});