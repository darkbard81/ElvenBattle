import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyAction } from '../src/game';
import { addBoardUnit, addHandCard, createPhase6State } from './phase6-helpers';

describe('phase6 applyAction integration', () => {
  it('dispatches SUMMON_UNIT and MOVE_UNIT actions', () => {
    const summonState = addHandCard(createPhase6State(), 'unit-1', 'unit_basic_vanguard');
    const summonResult = applyAction(summonState, {
      actionId: 'summon-action',
      playerId: 'P1',
      type: 'SUMMON_UNIT',
      payload: {
        instanceId: 'unit-1',
        slotId: createSlotId('P1', 'FRONT', 0),
      },
    });

    expect(summonResult.ok).toBe(true);

    if (!summonResult.ok) {
      return;
    }

    const moveResult = applyAction(summonResult.state, {
      actionId: 'move-action',
      playerId: 'P1',
      type: 'MOVE_UNIT',
      payload: {
        unitId: 'unit-1',
        toSlotId: createSlotId('P1', 'BACK', 0),
      },
    });

    expect(moveResult.ok).toBe(true);
  });

  it('keeps non-Phase6 unsupported actions unsupported', () => {
    const state = createPhase6State();
    const result = applyAction(state, {
      actionId: 'effect-action',
      playerId: 'P1',
      type: 'ACTIVATE_EFFECT',
      payload: {
        sourceId: 'unit-1',
      },
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.validation.errors[0]?.code).toBe('ERR_ACTION_NOT_IMPLEMENTED');
  });

  it('rejects MOVE_UNIT outside MAIN through common phase validation', () => {
    const state = addBoardUnit(
      createPhase6State({ phase: 'COMBAT' }),
      'unit-1',
      'unit_basic_vanguard',
    );
    const result = applyAction(state, {
      actionId: 'move-wrong-phase',
      playerId: 'P1',
      type: 'MOVE_UNIT',
      payload: {
        unitId: 'unit-1',
        toSlotId: createSlotId('P1', 'BACK', 0),
      },
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.validation.errors[0]?.code).toBe('ERR_WRONG_PHASE');
  });
});
