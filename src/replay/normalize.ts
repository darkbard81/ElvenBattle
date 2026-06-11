import type { GameState } from '../core';
import type { GameEvent } from '../events';
import type { GameAction } from '../rules';
import type { ActionLogEntry } from './types';

export function normalizeActionForReplay(action: GameAction): unknown {
  const actionForReplay: Partial<GameAction> = { ...action };
  delete actionForReplay.clientTimestamp;

  return normalizeJsonValue(actionForReplay);
}

export function normalizeEventForReplay(event: GameEvent): unknown {
  return normalizeJsonValue(event);
}

export function normalizeActionLogEntryForHash(entry: ActionLogEntry): unknown {
  return normalizeJsonValue({
    index: entry.index,
    action: normalizeActionForReplay(entry.action),
    accepted: entry.accepted,
  });
}

export function normalizeGameStateForHash(state: GameState): unknown {
  return normalizeJsonValue({
    ...state,
    actionLog: state.actionLog.map(normalizeActionLogEntryForHash),
    eventLog: state.eventLog.map(normalizeEventForReplay),
    eventQueue: state.eventQueue.map(normalizeEventForReplay),
  });
}

export function normalizeJsonValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      const normalized = normalizeJsonValue(item);

      return normalized === undefined ? null : normalized;
    });
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const key of Object.keys(input).sort()) {
    const normalized = normalizeJsonValue(input[key]);

    if (normalized !== undefined) {
      output[key] = normalized;
    }
  }

  return output;
}
