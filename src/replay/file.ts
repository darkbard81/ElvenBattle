import type { CardId, GameState, PlayerId } from '../core';
import type { GameConfig } from '../game';
import { hashEventLog, hashGameState } from './hash';
import { createStateSnapshot } from './snapshot';
import type { ReplayFile, ReplayValidationError, ReplayValidationResult } from './types';
import { REPLAY_VERSION } from './types';

export interface CreateReplayFileOptions {
  initialConfig?: GameConfig;
  initialDecks?: Record<PlayerId, CardId[]>;
  checkpoints?: ReplayFile['checkpoints'];
}

export function createReplayFile(
  initialState: GameState,
  finalState: GameState,
  options: CreateReplayFileOptions = {},
): ReplayFile {
  const initialDecks = options.initialDecks ?? inferInitialDecks(initialState);
  const initialConfig = options.initialConfig ?? inferInitialConfig(initialState, initialDecks);
  const scenarioVersion = finalState.scenarioState?.version ?? initialState.scenarioState?.version;
  const replayBase = {
    replayVersion: REPLAY_VERSION,
    gameId: finalState.gameId,
    ruleVersion: finalState.ruleVersion,
    cardDataVersion: finalState.cardDataVersion,
    rngSeed: finalState.rngSeed,
    initialDecks,
    initialConfig,
    initialState,
    initialStateHash: hashGameState(initialState),
    actions: finalState.actionLog.filter((entry) => entry.accepted),
    checkpoints: options.checkpoints ?? [
      createStateSnapshot(initialState, -1),
      createStateSnapshot(finalState, Math.max(-1, finalState.actionLog.length - 1)),
    ],
    finalStateHash: hashGameState(finalState),
    finalEventLogHash: hashEventLog(finalState.eventLog),
    result: {
      winner: finalState.winner,
      gameStatus: finalState.gameStatus,
      turnNumber: finalState.turnNumber,
      phase: finalState.phase,
    },
  };

  return {
    ...replayBase,
    ...(finalState.scenarioId ? { scenarioId: finalState.scenarioId } : {}),
    ...(scenarioVersion ? { scenarioVersion } : {}),
  };
}

export function createReplayFileFromState(
  finalState: GameState,
  options: CreateReplayFileOptions & { initialState?: GameState } = {},
): ReplayFile {
  return createReplayFile(
    options.initialState ?? stripReplayProgress(finalState),
    finalState,
    options,
  );
}

export function validateReplayFile(input: unknown): ReplayValidationResult {
  const errors: ReplayValidationError[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ code: 'ERR_REPLAY_FILE_INVALID', reason: 'replay_file_not_object' }],
    };
  }

  if (input.replayVersion !== REPLAY_VERSION) {
    errors.push({
      code: 'ERR_REPLAY_VERSION_UNSUPPORTED',
      reason: 'unsupported_replay_version',
    });
  }

  if (!Array.isArray(input.actions)) {
    errors.push({ code: 'ERR_REPLAY_FILE_INVALID', reason: 'actions_not_array' });
  } else {
    input.actions.forEach((entry, index) => {
      if (!isRecord(entry) || entry.index !== index) {
        errors.push({
          code: 'ERR_REPLAY_FILE_INVALID',
          reason: 'action_index_mismatch',
          actionIndex: index,
        });
        return;
      }

      if (typeof entry.stateHashBefore !== 'string' || typeof entry.stateHashAfter !== 'string') {
        errors.push({
          code: 'ERR_REPLAY_FILE_INVALID',
          reason: 'action_hash_missing',
          actionIndex: index,
        });
      }
    });
  }

  if (
    typeof input.initialStateHash !== 'string' ||
    typeof input.finalStateHash !== 'string' ||
    typeof input.finalEventLogHash !== 'string'
  ) {
    errors.push({ code: 'ERR_REPLAY_FILE_INVALID', reason: 'missing_state_hash' });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function isReplayFile(input: unknown): input is ReplayFile {
  return validateReplayFile(input).ok;
}

function inferInitialDecks(state: GameState): Record<PlayerId, CardId[]> {
  return Object.fromEntries(
    Object.entries(state.players).map(([playerId, player]) => [
      playerId,
      player.deck
        .map((instanceId) => state.zones.cardInstances[instanceId]?.definitionId)
        .filter((cardId): cardId is CardId => typeof cardId === 'string'),
    ]),
  );
}

function inferInitialConfig(
  state: GameState,
  initialDecks: Record<PlayerId, CardId[]>,
): GameConfig {
  const playerIds = Object.keys(state.players).sort();

  return {
    playerIds,
    startingPlayerId: state.activePlayerId,
    startingHp: state.players[state.activePlayerId]?.maxHp ?? 30,
    startingHandSize: 0,
    maxHandSize: 10,
    deckSize: Object.values(initialDecks).reduce((sum, deck) => sum + deck.length, 0),
    rngSeed: state.rngSeed,
    initialDecks,
  };
}

function stripReplayProgress(state: GameState): GameState {
  return {
    ...state,
    actionLog: [],
    eventLog: [],
    eventQueue: [],
    effectStack: [],
    pendingTriggers: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
