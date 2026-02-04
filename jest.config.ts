import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
      testMatch: ['**/test/**/*.test.js'],
      // Disable coverage collection for frontend until proper tests are added
      collectCoverageFrom: [],
    },
    {
      displayName: 'backend',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/server/src'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)'
      ],
      collectCoverageFrom: [
        'server/src/**/*.ts',
        '!server/src/**/*.d.ts',
        '!server/src/__tests__/**',
      ],
    },
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',           // Console output
    'text-summary',   // Summary
    'html',           // Detailed HTML report
    'lcov',           // For CI/CD integration
    'json-summary'    // For badge generation
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    'app.js',
    '/js/modules/'
  ],
  coverageThreshold: {
    // Global thresholds (very low since frontend tests don't have coverage yet)
    global: {
      statements: 3,
      branches: 1,
      functions: 0,
      lines: 3
    },
    // API routes should maintain high coverage
    './server/src/routes/users.ts': {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95
    },
    './server/src/routes/capacitySettings.ts': {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95
    },
    './server/src/routes/shifts.ts': {
      statements: 80,
      branches: 80,
      functions: 90,
      lines: 80
    }
  },
  verbose: true,
};

export default config;
