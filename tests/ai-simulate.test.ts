import { describe, expect, it } from 'vitest';

import { createSlotId } from '../src/board';
import { simulateAction } from '../src/ai';
import { hashGameState } from '../src/replay';
import { addHandCard, createPhase6State } from './phase6-helpers';

describe('AI action simulation', () => {
  it('does not mutate the input state for successful actions', () => {
    const state = addHandCard(createPhase6State(), 'hand-unit', 'unit_basic_vanguard');
    const beforeHash = hashGameState(state);
    const result = simulateAction(state, {
      actionId: 'manual-summon',
      playerId: 'P1',
      type: 'SUMMON_UNIT',
      payload: {
        instanceId: 'hand-unit',
        slotId: createSlotId('P1', 'FRONT', 0),
      },
    });

    expect(result.ok).toBe(true);
    expect(hashGameState(state)).toBe(beforeHash);
    expect(result.state).not.toBe(state);
  });

  it('returns validation errors for failed actions', () => {
    const state = createPhase6State();
    const result = simulateAction(state, {
      actionId: 'bad-summon',
      playerId: 'P1',
      type: 'SUMMON_UNIT',
      payload: {
        instanceId: 'missing',
        slotId: createSlotId('P1', 'FRONT', 0),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('ERR_CARD_INSTANCE_NOT_FOUND');
  });
});
