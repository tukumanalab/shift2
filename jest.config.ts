import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
      testMatch: ['**/test/**/*.test.js'],
      collectCoverageFrom: [
        'app.js',
        'js/modules/**/*.js',
        '!**/node_modules/**',
      ],
    },
    {
      displayName: 'backend',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/server/src'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      collectCoverageFrom: [
        'server/src/**/*.ts',
        '!server/src/**/*.d.ts',
        '!server/src/__tests__/**',
      ],
    },
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};

export default config;
