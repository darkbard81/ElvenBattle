import type { Plugin, ViteDevServer } from 'vite';
import { createAssetsMiddleware } from '../../../server/assets-middleware';
import { createCardTextApiHandler } from './api';

/**
 * 카드 텍스트 툴 전용 Vite 플러그인이다.
 * `/tcg` 정적 자산과 `/api/card-text-tool/...` API를 같은 개발 서버에 붙인다.
 */
export function cardTextToolPlugin(): Plugin {
  return {
    name: 'card-text-tool',
    configureServer(server: ViteDevServer) {
      registerMiddlewares(server.middlewares);
    },
    configurePreviewServer(server) {
      registerMiddlewares(server.middlewares);
    },
  };
}

function registerMiddlewares(middlewares: ViteDevServer['middlewares']): void {
  const handleAssets = createAssetsMiddleware();
  const handleApi = createCardTextApiHandler();

  middlewares.use((request, response, next) => {
    void (async () => {
      const handled = await handleAssets(request, response, next);
      if (handled) {
        return;
      }

      await handleApi(request, response, next);
    })().catch((error) => {
      next(error as Error);
    });
  });
}
