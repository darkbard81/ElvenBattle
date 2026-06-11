import type { GameState, PlayerId } from '../core';
import { createGameEndedEvent } from '../events';
import type { GameEndResult } from './types';
import { checkWinConditions, getOpponentPlayerId } from './win';

export function hasGameEnded(state: GameState): boolean {
  return (
    state.gameStatus === 'FINISHED' || state.gameStatus === 'ABORTED' || state.phase === 'GAME_OVER'
  );
}

export function countGameEndedEvents(state: GameState): number {
  return state.eventLog.filter((event) => event.type === 'GAME_ENDED').length;
}

export function finalizeGame(state: GameState, result: GameEndResult): GameState {
  if (hasGameEnded(state) || countGameEndedEvents(state) > 0) {
    return state;
  }

  const event = createGameEndedEvent(state, result);
  const gameStatus = result.reason === 'INVALID_STATE_ABORT' ? 'ABORTED' : 'FINISHED';

  return {
    ...state,
    phase: 'GAME_OVER',
    priorityPlayerId: null,
    winner: result.winner,
    gameStatus,
    eventQueue: [],
    effectStack: [],
    pendingTriggers: [],
    eventLog: [...state.eventLog, event],
  };
}

export function finalizeIfWinConditionMet(state: GameState): GameState {
  const result = checkWinConditions(state);

  return result ? finalizeGame(state, result) : state;
}

export function surrenderGame(state: GameState, playerId: PlayerId): GameState {
  const winner = getOpponentPlayerId(state, playerId);

  return finalizeGame(state, {
    winner,
    loser: playerId,
    reason: 'SURRENDER',
    condition: 'SURRENDER',
    detail: {
      playerId,
    },
  });
}

export function abortGame(
  state: GameState,
  reason: string,
  detail: Record<string, string | number | boolean | null> = {},
): GameState {
  return finalizeGame(state, {
    winner: null,
    loser: null,
    reason: 'INVALID_STATE_ABORT',
    condition: 'INVALID_STATE_ABORT',
    detail: {
      reason,
      ...detail,
    },
  });
}
