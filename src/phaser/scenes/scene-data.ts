import type { GameSession } from '../../game/save/session';
import type { StageBattleResult } from '../../game/stage/types';

export type LoaderSceneData = {
  assetBaseUrl: string;
};

export type MainMenuSceneData = {
  loadedCount: number;
  failedCount: number;
};

export type StageSceneData = {
  session: GameSession;
  lastBattleResult?: StageBattleResult;
};

export type BattlefieldSceneData = {
  session: GameSession;
  stageId: string;
};
