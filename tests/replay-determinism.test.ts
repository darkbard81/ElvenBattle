import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyAction } from '../src/game';
import {
  assertEventLogDeterministic,
  compareEventLogs,
  hashEventLog,
  hashGameState,
} from '../src/replay';
import { addHandCard, createPhase6State } from './phase6-helpers';

describe('replay determinism', () => {
  it('produces the same event log and state hash for the same seed and action', () => {
    const initialState = addHandCard(
      createPhase6State({ phase: 'MAIN', rngSeed: 'deterministic-seed' }),
      'summon-deterministic-1',
      'unit_basic_vanguard',
    );
    const action = {
      actionId: 'summon-deterministic',
      playerId: 'P1' as const,
      type: 'SUMMON_UNIT' as const,
      payload: {
        instanceId: 'summon-deterministic-1',
        slotId: createSlotId('P1', 'FRONT', 0),
      },
      clientTimestamp: 1,
    };
    const first = applyAction(initialState, action);
    const second = applyAction(initialState, {
      ...action,
      clientTimestamp: 999,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    if (!first.ok || !second.ok) {
      return;
    }

    expect(hashGameState(first.state)).toBe(hashGameState(second.state));
    expect(hashEventLog(first.state.eventLog)).toBe(hashEventLog(second.state.eventLog));
    expect(assertEventLogDeterministic(first.state.eventLog, second.state).ok).toBe(true);
    expect(compareEventLogs(first.state.eventLog, [])).toHaveLength(1);
  });
});
