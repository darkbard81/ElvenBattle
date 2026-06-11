import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyAttack, collectDestroyedUnits, destroyUnit } from '../src/battle';
import type { AttackPayload, GameAction } from '../src/rules';
import { addBoardUnit } from './phase6-helpers';
import { createPhase7State } from './phase7-helpers';

function attackAction(): GameAction<AttackPayload> {
  return {
    actionId: 'attack-destroy',
    playerId: 'P1',
    type: 'ATTACK',
    payload: {
      attackerId: 'attacker-1',
      target: { type: 'UNIT', unitId: 'defender-1' },
    },
  };
}

describe('destroy system', () => {
  it('collects and destroys units with no remaining health', () => {
    const state = addBoardUnit(
      createPhase7State(),
      'defender-1',
      'unit_basic_vanguard',
      createSlotId('P2', 'FRONT', 0),
      'P2',
      {
        damage: 3,
      },
    );

    expect(collectDestroyedUnits(state)).toEqual(['defender-1']);

    const result = destroyUnit(state, 'defender-1', 'COMBAT_DAMAGE');

    expect(result.state.board.slots[createSlotId('P2', 'FRONT', 0)]?.unit).toBeNull();
    expect(result.state.players.P2?.graveyard).toEqual(['defender-1']);
    expect(result.state.zones.cardInstances['defender-1']?.currentZone).toEqual({
      type: 'GRAVEYARD',
      ownerId: 'P2',
    });
    expect(result.events.map((event) => event.type)).toEqual(['UNIT_DESTROYED', 'CARD_MOVED']);
  });

  it('destroys units during attack and recalculates dominance when needed', () => {
    const state = addBoardUnit(
      addBoardUnit(
        createPhase7State(),
        'attacker-1',
        'unit_basic_vanguard',
        createSlotId('P1', 'FRONT', 0),
        'P1',
      ),
      'defender-1',
      'unit_back_support',
      createSlotId('P2', 'FRONT', 0),
      'P2',
      { currentHealth: 2 },
    );
    const stateWithDominance = {
      ...state,
      players: {
        ...state.players,
        P2: {
          ...state.players.P2!,
          dominance: {
            ...state.players.P2!.dominance,
            used: 1,
            boardValue: 1,
          },
        },
      },
    };
    const result = applyAttack(stateWithDominance, attackAction());

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.state.board.slots[createSlotId('P2', 'FRONT', 0)]?.unit).toBeNull();
    expect(result.state.players.P2?.graveyard).toEqual(['defender-1']);
    expect(result.state.players.P2?.dominance.used).toBe(0);
    expect(result.events.map((event) => event.type)).toContain('UNIT_DESTROYED');
    expect(result.events.map((event) => event.type)).toContain('CARD_MOVED');
    expect(result.events.map((event) => event.type)).toContain('DOMINANCE_CHANGED');
  });
});
