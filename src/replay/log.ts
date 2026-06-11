import type { GameState } from '../core';
import type { GameAction } from '../rules';
import { hashGameState } from './hash';
import type { ActionLogEntry } from './types';

export function createActionLogEntry(
  state: GameState,
  action: GameAction,
  accepted: boolean,
): ActionLogEntry {
  return {
    index: state.actionLog.length,
    action,
    accepted,
    stateHashBefore: hashGameState(state),
  };
}

export function completeActionLogEntryHash(
  state: GameState,
  actionIndex: number,
  beforeState?: GameState,
): { state: GameState; actionLogEntry: ActionLogEntry } {
  const actionLogEntry = state.actionLog[actionIndex];

  if (!actionLogEntry) {
    throw new Error(`Missing action log entry: ${actionIndex}`);
  }

  const completedEntry: ActionLogEntry = {
    ...actionLogEntry,
    stateHashBefore: beforeState ? hashGameState(beforeState) : actionLogEntry.stateHashBefore,
    stateHashAfter: hashGameState(state),
  };
  const actionLog = state.actionLog.map((entry) =>
    entry.index === actionIndex ? completedEntry : entry,
  );

  return {
    state: {
      ...state,
      actionLog,
    },
    actionLogEntry: completedEntry,
  };
}
