import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'threads',
    environment: 'node',
    root: '.',
    include: ['**/?(*.)+(spec|test).ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/server.ts',
        'src/types/**',
        'src/database/migrations/**',
        'src/database/seeds/**',
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov', 'html'],
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    globals: true,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
});
