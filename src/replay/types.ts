import type { CardId, GameId, GameState, GameStatus, Phase, PlayerId } from '../core';
import type { GameConfig } from '../game';
import type { GameAction } from '../rules';

export const REPLAY_VERSION = 'replay-v0.1' as const;
export const SAVE_VERSION = 'save-v0.1' as const;
export const HASH_VERSION = 'fnv1a32-stable-json-v1' as const;

export interface ActionLogEntry {
  index: number;
  action: GameAction;
  accepted: boolean;
  stateHashBefore: string;
  stateHashAfter?: string;
}

export interface StateSnapshot {
  afterActionIndex: number;
  turnNumber: number;
  phase: Phase;
  stateHash: string;
  compressedState?: string;
}

export interface ReplayFile {
  replayVersion: typeof REPLAY_VERSION;
  gameId: GameId;
  ruleVersion: string;
  cardDataVersion: string;
  scenarioId?: string;
  scenarioVersion?: string;
  rngSeed: string;
  initialDecks: Record<PlayerId, CardId[]>;
  initialConfig: GameConfig;
  initialState?: GameState;
  initialStateHash: string;
  actions: ActionLogEntry[];
  checkpoints: StateSnapshot[];
  finalStateHash: string;
  finalEventLogHash: string;
  result: ReplayGameResult;
}

export interface ReplayGameResult {
  winner: PlayerId | null;
  gameStatus: GameStatus;
  turnNumber: number;
  phase: Phase;
}

export interface SaveFile {
  saveVersion: typeof SAVE_VERSION;
  savedAtPolicy: 'OMITTED_FOR_DETERMINISM' | 'EXTERNAL_METADATA_ONLY';
  gameId: GameId;
  ruleVersion: string;
  cardDataVersion: string;
  scenarioId?: string;
  stateHash: string;
  state: GameState;
  actionLogHash: string;
  eventLogHash: string;
}

export interface ReplayValidationError {
  code:
    | 'ERR_REPLAY_VERSION_UNSUPPORTED'
    | 'ERR_SAVE_VERSION_UNSUPPORTED'
    | 'ERR_REPLAY_FILE_INVALID'
    | 'ERR_SAVE_FILE_INVALID'
    | 'ERR_REPLAY_HASH_MISMATCH'
    | 'ERR_REPLAY_ACTION_FAILED'
    | 'ERR_REPLAY_CHECKPOINT_MISMATCH'
    | 'ERR_REPLAY_EVENT_LOG_MISMATCH'
    | 'ERR_SAVE_HASH_MISMATCH';
  reason: string;
  actionIndex?: number;
  expectedHash?: string;
  actualHash?: string;
}

export interface ReplayValidationResult {
  ok: boolean;
  errors: ReplayValidationError[];
}

export interface ReplayStepResult {
  actionIndex: number;
  actionId: string;
  ok: boolean;
  stateHashBefore: string;
  stateHashAfter: string;
  eventLogHashAfter: string;
}

export interface ReplayRunResult {
  ok: boolean;
  initialStateHash: string;
  finalState: GameState;
  finalStateHash: string;
  finalEventLogHash: string;
  steps: ReplayStepResult[];
  errors: ReplayValidationError[];
}
