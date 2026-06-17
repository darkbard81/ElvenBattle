import { defineConfig } from 'vitest/config';
import { cardTextToolPlugin } from './server/card-text-tool-plugin';

export default defineConfig({
  plugins: [cardTextToolPlugin()],
  server: {
    allowedHosts: ['mcp.krdp.ddns.net'],
    host: '0.0.0.0',
    port: 3010,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: 'index.html',
        cardTextTool: 'tools/card-text/index.html',
      },
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
