import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { appConfig } from '../../../config';
import { createAssetsMiddleware } from '../../../server/assets-middleware';
import { createAuthApiHandler } from '../../../server/auth-api';
import { AuthService } from '../../../server/auth-service';
import { createSaveSlotsApiHandler, migrateLegacySaveSlots } from '../../../server/save-slots-api';
import { createCardTextApiHandler } from './api';

/**
 * 게임과 카드 텍스트 툴에 필요한 Vite 서버 middleware를 등록한다.
 * 정적 자산, 인증, 계정별 저장 슬롯, 카드 텍스트 API를 같은 서버에 붙인다.
 */
export function cardTextToolPlugin(): Plugin {
  return {
    name: 'card-text-tool',
    configureServer(server: ViteDevServer) {
      registerMiddlewares(server.middlewares, server.httpServer);
    },
    configurePreviewServer(server) {
      registerMiddlewares(server.middlewares, server.httpServer);
    },
  };
}

function registerMiddlewares(
  middlewares: ViteDevServer['middlewares'],
  httpServer: { once(event: 'close', listener: () => void): unknown } | null,
): void {
  const handleAssets = createAssetsMiddleware();
  const authService = new AuthService({
    dataRoot: appConfig.storage.dataRoot,
    migrateFirstAccount: async (targetSaveSlotsRoot) =>
      migrateLegacySaveSlots({
        legacySaveSlotsRoot: path.join(appConfig.storage.dataRoot, 'save-slots'),
        targetSaveSlotsRoot,
      }),
  });
  httpServer?.once('close', () => authService.dispose());
  const handleAuthApi = createAuthApiHandler(authService);
  const handleSaveSlotsApi = createSaveSlotsApiHandler({
    authService,
    dataRoot: appConfig.storage.dataRoot,
  });
  const handleApi = createCardTextApiHandler();

  middlewares.use((request, response, next) => {
    void (async () => {
      const handled = await handleAssets(request, response, next);
      if (handled) {
        return;
      }

      const authHandled = await handleAuthApi(request, response);
      if (authHandled) {
        return;
      }

      const saveSlotsHandled = await handleSaveSlotsApi(request, response, next);
      if (saveSlotsHandled) {
        return;
      }

      await handleApi(request, response, next);
    })().catch((error) => {
      next(error as Error);
    });
  });
}
