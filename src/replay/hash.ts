import type { GameState } from '../core';
import type { GameEvent } from '../events';
import type { ActionLogEntry } from './types';
import {
  normalizeActionLogEntryForHash,
  normalizeGameStateForHash,
  normalizeJsonValue,
} from './normalize';

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeJsonValue(value));
}

export function hashString(input: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function hashGameState(state: GameState): string {
  return hashString(stableStringify(normalizeGameStateForHash(state)));
}

export function hashActionLog(entries: readonly ActionLogEntry[]): string {
  return hashString(stableStringify(entries.map(normalizeActionLogEntryForHash)));
}

export function hashEventLog(events: readonly GameEvent[]): string {
  return hashString(stableStringify(events));
}
