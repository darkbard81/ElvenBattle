import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyAction } from '../src/game';
import { addBoardUnit } from './phase6-helpers';
import { addFrontCombatants, createPhase7State } from './phase7-helpers';

describe('phase7 applyAction integration', () => {
  it('dispatches ATTACK actions in COMBAT', () => {
    const state = addFrontCombatants();
    const result = applyAction(state, {
      actionId: 'attack-action',
      playerId: 'P1',
      type: 'ATTACK',
      payload: {
        attackerId: 'attacker-1',
        target: { type: 'UNIT', unitId: 'defender-1' },
      },
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.state.zones.cardInstances['attacker-1']?.exhausted).toBe(true);
    expect(result.state.turnState.attackedUnitIds).toContain('attacker-1');
    expect(result.actionLogEntry.accepted).toBe(true);
  });

  it('rejects ATTACK outside COMBAT through common phase validation', () => {
    const state = addBoardUnit(
      createPhase7State({ phase: 'MAIN' }),
      'attacker-1',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 0),
      'P1',
    );
    const result = applyAction(state, {
      actionId: 'attack-wrong-phase',
      playerId: 'P1',
      type: 'ATTACK',
      payload: {
        attackerId: 'attacker-1',
        target: { type: 'PLAYER', playerId: 'P2' },
      },
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.validation.errors[0]?.code).toBe('ERR_WRONG_PHASE');
    expect(result.state).toBe(state);
  });
});
