import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    // The Meilisearch client module throws on import without these values.
    // Tests never connect to it, so placeholder values are enough.
    env: {
      MEILISEARCH_HOST: 'http://127.0.0.1:7700',
      MEILISEARCH_API_KEY: 'test-only-placeholder-key',
    },
    coverage: {
      provider: 'v8',
      include: ['src/services/achievements/**/*.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
