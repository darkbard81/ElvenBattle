import type { GameState } from '../core';
import type { GameEvent } from '../events';
import { stableStringify } from './hash';
import { normalizeEventForReplay } from './normalize';
import type { ReplayValidationError, ReplayValidationResult } from './types';

export function compareEventLogs(
  expected: readonly GameEvent[],
  actual: readonly GameEvent[],
): ReplayValidationError[] {
  const errors: ReplayValidationError[] = [];
  const maxLength = Math.max(expected.length, actual.length);

  for (let index = 0; index < maxLength; index += 1) {
    const expectedEvent = expected[index];
    const actualEvent = actual[index];

    if (!expectedEvent || !actualEvent) {
      errors.push({
        code: 'ERR_REPLAY_EVENT_LOG_MISMATCH',
        reason: 'event_log_length_mismatch',
        actionIndex: index,
      });
      break;
    }

    const expectedValue = stableStringify(normalizeEventForReplay(expectedEvent));
    const actualValue = stableStringify(normalizeEventForReplay(actualEvent));

    if (expectedValue !== actualValue) {
      errors.push({
        code: 'ERR_REPLAY_EVENT_LOG_MISMATCH',
        reason: 'event_log_entry_mismatch',
        actionIndex: index,
        expectedHash: expectedEvent.eventId,
        actualHash: actualEvent.eventId,
      });
      break;
    }
  }

  return errors;
}

export function assertEventLogDeterministic(
  expectedEvents: readonly GameEvent[],
  actualState: GameState,
): ReplayValidationResult {
  const errors = compareEventLogs(expectedEvents, actualState.eventLog);

  return {
    ok: errors.length === 0,
    errors,
  };
}
