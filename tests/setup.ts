/**
 * Global test setup file for Jest
 * Configures global mocks, environment variables, and test utilities
 */

// Mock fetch globally for all tests
global.fetch = jest.fn();

// Global beforeEach to reset all mocks
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset environment variables to a clean state for each test
  delete process.env.AP_API_KEY;
  delete process.env.AP_BASE_URL;
  delete process.env.AP_TIMEOUT;
  delete process.env.AP_RETRIES;
  delete process.env.AP_DEBUG;
  delete process.env.AP_LOG_LEVEL;
  delete process.env.AP_VERBOSE_LOGGING;
});

// Global afterEach cleanup
afterEach(() => {
  jest.restoreAllMocks();
});

// Suppress console logs during tests unless explicitly testing logging
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.debug = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchApiResponse(): R;
      toBeValidAPError(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  // Matcher for validating API response structure
  toMatchApiResponse(received) {
    const pass = 
      received !== null &&
      typeof received === 'object' &&
      (received.hasOwnProperty('data') || received.hasOwnProperty('error'));
    
    if (pass) {
      return {
        message: () => `expected ${received} not to match API response structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to match API response structure with 'data' or 'error' property`,
        pass: false,
      };
    }
  },
  
  // Matcher for validating AP Error structure
  toBeValidAPError(received) {
    const pass = 
      received instanceof Error &&
      received.hasOwnProperty('name') &&
      received.hasOwnProperty('message') &&
      ['APAPIError', 'APConfigurationError', 'APNetworkError'].includes(received.name);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid AP Error`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid AP Error with correct name and message properties`,
        pass: false,
      };
    }
  },
});

// Mock implementation helpers
export const createMockFetchResponse = (data: any, status = 200, ok = true) => {
  return Promise.resolve({
    ok,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  } as Response);
};

export const createMockFetchError = (message = 'Network error') => {
  return Promise.reject(new Error(message));
};

// Environment variable helpers for tests
export const setTestEnvVar = (key: string, value: string) => {
  process.env[key] = value;
};

export const clearTestEnvVar = (key: string) => {
  delete process.env[key];
};

export const setDefaultTestEnv = () => {
  process.env.AP_API_KEY = 'test_api_key';
  process.env.AP_BASE_URL = 'https://api.ap.org/media/v';
  process.env.AP_TIMEOUT = '30000';
  process.env.AP_RETRIES = '3';
  process.env.AP_DEBUG = 'false';
  process.env.AP_LOG_LEVEL = 'info';
  process.env.AP_VERBOSE_LOGGING = 'false';
};