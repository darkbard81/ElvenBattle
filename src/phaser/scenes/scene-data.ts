import type { GameSession } from '../../game/save/session';

export type LoaderSceneData = {
  assetBaseUrl: string;
};

export type MainMenuSceneData = {
  loadedCount: number;
  failedCount: number;
};

export type BattlefieldSceneData = {
  session: GameSession;
};
