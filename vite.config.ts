import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) {
            return 'phaser';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
