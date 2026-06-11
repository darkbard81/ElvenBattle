import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyAttack, applyDamageToPlayer, applyDamageToUnit } from '../src/battle';
import type { AttackPayload, GameAction } from '../src/rules';
import { addBoardUnit } from './phase6-helpers';
import { addFrontCombatants, createPhase7State } from './phase7-helpers';

function attackAction(target: AttackPayload['target'] = { type: 'UNIT', unitId: 'defender-1' }) {
  return {
    actionId: 'attack-damage',
    playerId: 'P1',
    type: 'ATTACK',
    payload: {
      attackerId: 'attacker-1',
      target,
    },
  } satisfies GameAction<AttackPayload>;
}

describe('damage system', () => {
  it('applies direct unit and player damage helpers', () => {
    const state = addFrontCombatants();
    const unitDamage = applyDamageToUnit(state, 'defender-1', 2, {
      type: 'UNIT',
      unitId: 'attacker-1',
    });
    const playerDamage = applyDamageToPlayer(state, 'P2', 2, {
      type: 'UNIT',
      unitId: 'attacker-1',
    });

    expect(unitDamage.state.zones.cardInstances['defender-1']?.damage).toBe(2);
    expect(playerDamage.state.players.P2?.hp).toBe(28);
  });

  it('applies attack damage and front-row counter damage', () => {
    const state = addFrontCombatants();
    const result = applyAttack(state, attackAction());

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.state.zones.cardInstances['defender-1']?.damage).toBe(2);
    expect(result.state.zones.cardInstances['attacker-1']?.damage).toBe(2);
    expect(result.events.map((event) => event.type)).toEqual([
      'ATTACK_DECLARED',
      'DAMAGE_DEALT',
      'DAMAGE_DEALT',
    ]);
  });

  it('does not apply counter damage from a back-row target and damages players directly', () => {
    const backTargetState = addBoardUnit(
      addBoardUnit(
        createPhase7State(),
        'attacker-1',
        'unit_basic_vanguard',
        createSlotId('P1', 'FRONT', 0),
        'P1',
      ),
      'back-target',
      'unit_back_support',
      createSlotId('P2', 'BACK', 0),
      'P2',
    );
    const backResult = applyAttack(
      backTargetState,
      attackAction({ type: 'UNIT', unitId: 'back-target' }),
    );

    expect(backResult.ok).toBe(true);

    if (!backResult.ok) {
      return;
    }

    expect(backResult.state.zones.cardInstances['attacker-1']?.damage).toBe(0);

    const directState = addBoardUnit(
      createPhase7State(),
      'attacker-1',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 0),
      'P1',
    );
    const directResult = applyAttack(directState, attackAction({ type: 'PLAYER', playerId: 'P2' }));

    expect(directResult.ok).toBe(true);

    if (!directResult.ok) {
      return;
    }

    expect(directResult.state.players.P2?.hp).toBe(28);
  });
});
