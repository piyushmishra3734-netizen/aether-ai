import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 20_000,
    env: {
      EXA_API_KEY: '',
      AETHER_AUTONOMOUS: '0',
    },
  },
});
