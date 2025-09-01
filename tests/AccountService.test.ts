/**
 * Tests for AccountService - Service for AP Account API operations
 * Tests all account methods, parameter validation, and data extraction utilities
 */

import { AccountService } from '../src/services/AccountService.js';
import { APHttpClient } from '../src/http/APHttpClient.js';
import { APValidationError, APError, APAPIError } from '../src/errors/APError.js';
import { 
  mockAccountInfo, 
  mockAccountPlans, 
  mockDownloads 
} from './fixtures/api-responses.js';

// Mock APHttpClient
jest.mock('../src/http/APHttpClient.js');
const MockAPHttpClient = APHttpClient as jest.MockedClass<typeof APHttpClient>;

describe('AccountService', () => {
  let accountService: AccountService;
  let mockHttpClient: jest.Mocked<APHttpClient>;

  beforeEach(() => {
    mockHttpClient = new MockAPHttpClient({} as any) as jest.Mocked<APHttpClient>;
    accountService = new AccountService(mockHttpClient);
  });

  describe('getAccountInfo', () => {
    test('should get account information', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ data: mockAccountInfo, status: 200, statusText: 'OK', headers: {} });

      const result = await accountService.getAccountInfo();

      expect(mockHttpClient.get).toHaveBeenCalledWith('account');
      expect(result).toEqual(mockAccountInfo);
    });

    test('should handle errors', async () => {
      const error = new APAPIError('Account not found', 'ACCOUNT_ERROR', 404);
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await accountService.getAccountInfo().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.details.operation).toBe('getAccountInfo');
    });
  });

  describe('getAccountPlans', () => {
    test('should get account plans with no parameters', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ data: mockAccountPlans, status: 200, statusText: 'OK', headers: {} });

      const result = await accountService.getAccountPlans();

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/plans', {});
      expect(result).toEqual(mockAccountPlans);
    });

    test('should get account plans with parameters', async () => {
      const options = {
        include: ['entitlements', 'usage'],
        exclude: ['details'],
        format: 'json' as const
      };

      mockHttpClient.get.mockResolvedValueOnce({ data: mockAccountPlans, status: 200, statusText: 'OK', headers: {} });

      const result = await accountService.getAccountPlans(options);

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/plans', options);
      expect(result).toEqual(mockAccountPlans);
    });

    test('should validate include parameter is array', async () => {
      await expect(accountService.getAccountPlans({ include: 'not-array' as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate exclude parameter is array', async () => {
      await expect(accountService.getAccountPlans({ exclude: 'not-array' as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate format parameter', async () => {
      await expect(accountService.getAccountPlans({ format: 'xml' as any }))
        .rejects.toThrow(APValidationError);

      await expect(accountService.getAccountPlans({ format: 'invalid' as any }))
        .rejects.toThrow(APValidationError);

      // Valid formats should not throw
      mockHttpClient.get.mockResolvedValueOnce({ data: mockAccountPlans, status: 200, statusText: 'OK', headers: {} });
      await expect(accountService.getAccountPlans({ format: 'json' })).resolves.toBeDefined();
      
      mockHttpClient.get.mockResolvedValueOnce({ data: mockAccountPlans, status: 200, statusText: 'OK', headers: {} });
      await expect(accountService.getAccountPlans({ format: 'csv' })).resolves.toBeDefined();
    });

    test('should handle errors with context', async () => {
      const error = new APAPIError('Plans not available', 'PLANS_ERROR', 503);
      const options = { format: 'csv' as const };
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await accountService.getAccountPlans(options).catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.details.operation).toBe('getAccountPlans');
      expect(thrownError.details.context).toEqual(options);
    });
  });

  describe('getAccountDownloads', () => {
    test('should get account downloads with no parameters', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ data: mockDownloads, status: 200, statusText: 'OK', headers: {} });

      const result = await accountService.getAccountDownloads();

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/downloads', {});
      expect(result).toEqual(mockDownloads);
    });

    test('should get account downloads with parameters', async () => {
      const params = {
        include: ['item', 'charge'],
        exclude: ['metadata'],
        format: 'json' as const,
        min_date: '2024-01-01',
        max_date: '2024-01-31',
        order: 1
      };

      mockHttpClient.get.mockResolvedValueOnce({ data: mockDownloads, status: 200, statusText: 'OK', headers: {} });

      const result = await accountService.getAccountDownloads(params);

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/downloads', params);
      expect(result).toEqual(mockDownloads);
    });

    test('should validate download parameters', async () => {
      await expect(accountService.getAccountDownloads({ include: 'not-array' as any }))
        .rejects.toThrow(APValidationError);

      await expect(accountService.getAccountDownloads({ exclude: 'not-array' as any }))
        .rejects.toThrow(APValidationError);

      await expect(accountService.getAccountDownloads({ format: 'xml' as any }))
        .rejects.toThrow(APValidationError);
    });

    test('should validate date parameters', async () => {
      await expect(accountService.getAccountDownloads({ min_date: 'invalid-date' }))
        .rejects.toThrow(APValidationError);

      await expect(accountService.getAccountDownloads({ max_date: '2024/01/01' }))
        .rejects.toThrow(APValidationError);

      await expect(accountService.getAccountDownloads({ min_date: '2024-13-01' }))
        .rejects.toThrow(APValidationError);

      // Valid dates should not throw
      mockHttpClient.get.mockResolvedValueOnce({ data: mockDownloads, status: 200, statusText: 'OK', headers: {} });
      await expect(accountService.getAccountDownloads({ min_date: '2024-01-01' })).resolves.toBeDefined();
      
      mockHttpClient.get.mockResolvedValueOnce({ data: mockDownloads, status: 200, statusText: 'OK', headers: {} });
      await expect(accountService.getAccountDownloads({ max_date: '2024-01-15T10:30:00' })).resolves.toBeDefined();
      
      mockHttpClient.get.mockResolvedValueOnce({ data: mockDownloads, status: 200, statusText: 'OK', headers: {} });
      await expect(accountService.getAccountDownloads({ min_date: 'P7D' })).resolves.toBeDefined(); // ISO-8601 duration
    });

    test('should validate order parameter', async () => {
      await expect(accountService.getAccountDownloads({ order: 0 }))
        .rejects.toThrow(APValidationError);

      await expect(accountService.getAccountDownloads({ order: -1 }))
        .rejects.toThrow(APValidationError);

      await expect(accountService.getAccountDownloads({ order: 1.5 }))
        .rejects.toThrow(APValidationError);

      await expect(accountService.getAccountDownloads({ order: 'invalid' as any }))
        .rejects.toThrow(APValidationError);

      // Valid order should not throw
      mockHttpClient.get.mockResolvedValueOnce({ data: mockDownloads, status: 200, statusText: 'OK', headers: {} });
      await expect(accountService.getAccountDownloads({ order: 1 })).resolves.toBeDefined();
    });

    test('should validate date range', async () => {
      // Date range exceeds 60 days
      await expect(accountService.getAccountDownloads({ 
        min_date: '2024-01-01', 
        max_date: '2024-03-05' 
      })).rejects.toThrow(APValidationError);

      // min_date after max_date
      await expect(accountService.getAccountDownloads({ 
        min_date: '2024-01-15', 
        max_date: '2024-01-10' 
      })).rejects.toThrow(APValidationError);

      // Valid range should not throw
      mockHttpClient.get.mockResolvedValueOnce({ data: mockDownloads, status: 200, statusText: 'OK', headers: {} });
      await expect(accountService.getAccountDownloads({ 
        min_date: '2024-01-01', 
        max_date: '2024-01-30' 
      })).resolves.toBeDefined();

      // Exactly 60 days should not throw
      mockHttpClient.get.mockResolvedValueOnce({ data: mockDownloads, status: 200, statusText: 'OK', headers: {} });
      await expect(accountService.getAccountDownloads({ 
        min_date: '2024-01-01', 
        max_date: '2024-03-01' 
      })).resolves.toBeDefined();
    });

    test('should handle errors with context', async () => {
      const error = new APAPIError('Downloads unavailable', 'DOWNLOADS_ERROR', 503);
      const params = { min_date: '2024-01-01', order: 1 };
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await accountService.getAccountDownloads(params).catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.details.context).toEqual(params);
    });
  });

  describe('getAccountQuotas', () => {
    test('should get account quotas', async () => {
      const mockQuotas = {
        data: {
          account: 'test_account',
          updated: '2024-01-15T10:00:00Z',
          quotas: [
            { method: 'GET', limit: 1000, period: 'hour' },
            { method: 'POST', limit: 100, period: 'hour' }
          ]
        }
      };

      mockHttpClient.get.mockResolvedValueOnce({ data: mockQuotas, status: 200, statusText: 'OK', headers: {} });

      const result = await accountService.getAccountQuotas();

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/quotas');
      expect(result).toEqual(mockQuotas);
    });

    test('should handle errors', async () => {
      const error = new APAPIError('Quotas not available', 'QUOTAS_ERROR', 503);
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await accountService.getAccountQuotas().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.details.operation).toBe('getAccountQuotas');
    });
  });

  describe('getFollowedTopics', () => {
    test('should get followed topics with no parameters', async () => {
      const mockTopics = { data: { topics: [] } };
      mockHttpClient.get.mockResolvedValueOnce({ data: mockTopics, status: 200, statusText: 'OK', headers: {} });

      const result = await accountService.getFollowedTopics();

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/followedtopics', {});
      expect(result).toEqual(mockTopics);
    });

    test('should get followed topics with parameters', async () => {
      const options = {
        format: 'csv' as const,
        include: ['topic_name', 'created_date']
      };

      const mockTopics = { data: { topics: [] } };
      mockHttpClient.get.mockResolvedValueOnce({ data: mockTopics, status: 200, statusText: 'OK', headers: {} });

      const result = await accountService.getFollowedTopics(options);

      expect(mockHttpClient.get).toHaveBeenCalledWith('account/followedtopics', options);
      expect(result).toEqual(mockTopics);
    });

    test('should validate followed topics parameters', async () => {
      await expect(accountService.getFollowedTopics({ format: 'xml' as any }))
        .rejects.toThrow(APValidationError);

      await expect(accountService.getFollowedTopics({ include: 'not-array' as any }))
        .rejects.toThrow(APValidationError);

      // Valid parameters should not throw
      mockHttpClient.get.mockResolvedValueOnce({ data: { data: { topics: [] } }, status: 200, statusText: 'OK', headers: {} });
      await expect(accountService.getFollowedTopics({ format: 'json' })).resolves.toBeDefined();
    });

    test('should handle errors with context', async () => {
      const error = new APAPIError('Topics unavailable', 'TOPICS_ERROR', 404);
      const options = { format: 'csv' as const };
      mockHttpClient.get.mockRejectedValueOnce(error);

      const thrownError = await accountService.getFollowedTopics(options).catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.details.context).toEqual(options);
    });
  });

  describe('extractPlanSummary static method', () => {
    test('should extract plan summary correctly', () => {
      const mockPlansResponse = {
        data: {
          plans: [
            {
              id: 1,
              name: 'Premium Plan',
              used: 250,
              usage_limit: 1000,
              next_cycle_begins: '2024-02-01T00:00:00Z',
              entitlements: [
                { name: 'text_downloads', limit: 1000 },
                { name: 'image_downloads', limit: 500 }
              ]
            },
            {
              id: 2,
              name: 'Basic Plan',
              used: 50,
              usage_limit: 100,
              next_cycle_begins: '2024-02-01T00:00:00Z',
              entitlements: [
                { name: 'text_downloads', limit: 100 }
              ]
            }
          ]
        }
      };

      const result = AccountService.extractPlanSummary(mockPlansResponse);

      expect(result).toEqual({
        totalPlans: 2,
        activePlans: [
          {
            id: 1,
            name: 'Premium Plan',
            used: 250,
            limit: 1000,
            usagePercent: 25,
            nextCycle: '2024-02-01T00:00:00Z'
          },
          {
            id: 2,
            name: 'Basic Plan',
            used: 50,
            limit: 100,
            usagePercent: 50,
            nextCycle: '2024-02-01T00:00:00Z'
          }
        ],
        totalEntitlements: 3
      });
    });

    test('should handle zero usage limit', () => {
      const mockPlansResponse = {
        data: {
          plans: [
            {
              id: 1,
              name: 'Unlimited Plan',
              used: 500,
              usage_limit: 0, // Unlimited
              next_cycle_begins: '2024-02-01T00:00:00Z',
              entitlements: []
            }
          ]
        }
      };

      const result = AccountService.extractPlanSummary(mockPlansResponse);

      expect(result.activePlans[0].usagePercent).toBe(0);
    });

    test('should handle missing plans array', () => {
      const mockPlansResponse = {
        data: {}
      };

      const result = AccountService.extractPlanSummary(mockPlansResponse);

      expect(result).toEqual({
        totalPlans: 0,
        activePlans: [],
        totalEntitlements: 0
      });
    });

    test('should handle missing entitlements', () => {
      const mockPlansResponse = {
        data: {
          plans: [
            {
              id: 1,
              name: 'Basic Plan',
              used: 10,
              usage_limit: 100,
              next_cycle_begins: '2024-02-01T00:00:00Z'
              // entitlements missing
            }
          ]
        }
      };

      const result = AccountService.extractPlanSummary(mockPlansResponse);

      expect(result.totalEntitlements).toBe(0);
    });
  });

  describe('extractDownloadSummary static method', () => {
    test('should extract download summary correctly', () => {
      const mockDownloadsResponse = {
        data: {
          total_items: 100,
          current_item_count: 25,
          min_date: '2024-01-01T00:00:00Z',
          max_date: '2024-01-31T23:59:59Z',
          downloads: [
            {
              item: { type: 'text' },
              charge: 0.50,
              currency: 'USD'
            },
            {
              item: { type: 'picture' },
              charge: 1.00,
              currency: 'USD'
            },
            {
              item: { type: 'text' },
              charge: 0.75,
              currency: 'USD'
            }
          ]
        }
      };

      const result = AccountService.extractDownloadSummary(mockDownloadsResponse);

      expect(result).toEqual({
        totalDownloads: 100,
        currentItems: 25,
        dateRange: {
          min: '2024-01-01T00:00:00Z',
          max: '2024-01-31T23:59:59Z'
        },
        mediaTypes: {
          text: 2,
          picture: 1
        },
        totalCost: 2.25,
        currency: 'USD'
      });
    });

    test('should handle missing charge information', () => {
      const mockDownloadsResponse = {
        data: {
          total_items: 10,
          current_item_count: 10,
          min_date: '2024-01-01T00:00:00Z',
          max_date: '2024-01-31T23:59:59Z',
          downloads: [
            {
              item: { type: 'text' },
              // charge missing
              currency: 'USD'
            },
            {
              item: { type: 'picture' }
              // charge and currency missing
            }
          ]
        }
      };

      const result = AccountService.extractDownloadSummary(mockDownloadsResponse);

      expect(result.totalCost).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.mediaTypes).toEqual({
        text: 1,
        picture: 1
      });
    });

    test('should handle empty downloads array', () => {
      const mockDownloadsResponse = {
        data: {
          total_items: 0,
          current_item_count: 0,
          min_date: '2024-01-01T00:00:00Z',
          max_date: '2024-01-31T23:59:59Z',
          downloads: []
        }
      };

      const result = AccountService.extractDownloadSummary(mockDownloadsResponse);

      expect(result.totalCost).toBe(0);
      expect(result.currency).toBeUndefined();
      expect(result.mediaTypes).toEqual({});
    });
  });

  describe('extractQuotaSummary static method', () => {
    test('should extract quota summary correctly', () => {
      const mockQuotasResponse = {
        data: {
          account: 'test_account_123',
          updated: '2024-01-15T10:30:00Z',
          quotas: [
            { method: 'GET', limit: 1000, period: 'hour' },
            { method: 'POST', limit: 100, period: 'hour' },
            { method: 'PUT', limit: 50, period: 'day' }
          ]
        }
      };

      const result = AccountService.extractQuotaSummary(mockQuotasResponse);

      expect(result).toEqual({
        account: 'test_account_123',
        updated: '2024-01-15T10:30:00Z',
        quotas: [
          { method: 'GET', limit: 1000, period: 'hour' },
          { method: 'POST', limit: 100, period: 'hour' },
          { method: 'PUT', limit: 50, period: 'day' }
        ]
      });
    });

    test('should handle missing quotas array', () => {
      const mockQuotasResponse = {
        data: {
          account: 'test_account_123',
          updated: '2024-01-15T10:30:00Z'
          // quotas missing
        }
      };

      const result = AccountService.extractQuotaSummary(mockQuotasResponse);

      expect(result.quotas).toEqual([]);
    });
  });

  describe('Error handling', () => {
    test('should preserve AP error details when wrapping', async () => {
      const originalError = new APAPIError('Original error', 404, 'ORIGINAL_CODE', { 
        field: 'test', 
        originalContext: 'value' 
      });
      
      mockHttpClient.get.mockRejectedValueOnce(originalError);

      const thrownError = await accountService.getAccountPlans({ format: 'json' }).catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.message).toBe('Original error');
      expect(thrownError.code).toBe('ORIGINAL_CODE');
      expect(thrownError.statusCode).toBe(404);
      expect(thrownError.details.operation).toBe('getAccountPlans');
      expect(thrownError.details.context).toEqual({ format: 'json' });
      expect(thrownError.details.field).toBe('test');
      expect(thrownError.details.originalContext).toBe('value');
    });

    test('should create new error for non-AP errors', async () => {
      const genericError = new Error('Network timeout');
      mockHttpClient.get.mockRejectedValueOnce(genericError);

      const thrownError = await accountService.getAccountInfo().catch(e => e);

      expect(thrownError).toBeInstanceOf(APError);
      expect(thrownError.code).toBe('ACCOUNT_SERVICE_ERROR');
      expect(thrownError.message).toContain('AccountService.getAccountInfo failed');
      expect(thrownError.details.operation).toBe('getAccountInfo');
      expect(thrownError.details.originalError).toBe(genericError);
    });

    test('should handle various error types', async () => {
      // String error
      mockHttpClient.get.mockRejectedValueOnce('String error');
      let thrownError = await accountService.getAccountQuotas().catch(e => e);
      expect(thrownError.message).toContain('AccountService.getAccountQuotas failed: String error');

      // Null error
      mockHttpClient.get.mockRejectedValueOnce(null);
      thrownError = await accountService.getFollowedTopics().catch(e => e);
      expect(thrownError.message).toContain('AccountService.getFollowedTopics failed');

      // Object error
      mockHttpClient.get.mockRejectedValueOnce({ error: 'object error' });
      thrownError = await accountService.getAccountDownloads().catch(e => e);
      expect(thrownError.message).toContain('AccountService.getAccountDownloads failed');
    });
  });

  describe('Date validation edge cases', () => {
    test('should handle various date formats correctly', () => {
      const service = accountService as any; // Access private method for testing
      
      // Valid formats
      expect(service.isValidDateString('2024-01-01')).toBe(true);
      expect(service.isValidDateString('2024-12-31T23:59:59')).toBe(true);
      expect(service.isValidDateString('P7D')).toBe(true); // ISO-8601 duration
      expect(service.isValidDateString('PT24H')).toBe(true); // ISO-8601 duration
      expect(service.isValidDateString('P1M')).toBe(true); // ISO-8601 duration
      
      // Invalid formats
      expect(service.isValidDateString('2024/01/01')).toBe(false);
      expect(service.isValidDateString('01-01-2024')).toBe(false);
      expect(service.isValidDateString('2024-13-01')).toBe(false); // Invalid month
      expect(service.isValidDateString('2024-01-32')).toBe(false); // Invalid day
      expect(service.isValidDateString('not-a-date')).toBe(false);
      expect(service.isValidDateString('')).toBe(false);
    });

    test('should validate leap year dates correctly', () => {
      const service = accountService as any;
      
      expect(service.isValidDateString('2024-02-29')).toBe(true); // 2024 is a leap year
      expect(service.isValidDateString('2023-02-29')).toBe(false); // 2023 is not a leap year
    });
  });
});