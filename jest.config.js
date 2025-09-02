export default {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest/presets/default-esm',

  // Enable ES modules
  extensionsToTreatAsEsm: ['.ts'],

  // Node environment for testing
  testEnvironment: 'node',

  // Module name mapping for TypeScript ES module imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Transform configuration for TypeScript with ES modules
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'esnext',
          target: 'es2022',
          moduleResolution: 'node'
        }
      }
    ]
  },

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts'
  ],

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
		'!src/prompts/templates/**',
    '!src/index.ts' // Skip entry point for now
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 65,
      lines: 65,
      statements: 65
    }
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],

  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>/src'],

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Automatically restore mock state between every test
  restoreMocks: true,

  // Display test results with more detail
  verbose: true,

  // Global test timeout
  testTimeout: 10000,

  // Transform ignore patterns - don't transform node_modules except MCP SDK if needed
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol/sdk)/)'
  ]
};
