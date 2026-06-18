import { defineConfig } from 'vitest/config';
import { appConfig } from './src/config';
import { cardTextToolPlugin } from './src/server/card-text-tool-plugin';

export default defineConfig({
  plugins: [cardTextToolPlugin()],
  server: {
    allowedHosts: appConfig.server.allowedHosts,
    host: appConfig.server.host,
    port: appConfig.server.port,
    strictPort: appConfig.server.strictPort,
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
