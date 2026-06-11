import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applySummonUnit } from '../src/game';
import type { GameAction, SummonUnitPayload } from '../src/rules';
import { addBoardUnit, addHandCard, createPhase6State } from './phase6-helpers';

function summonAction(instanceId: string, slotId = createSlotId('P1', 'FRONT', 0)) {
  return {
    actionId: `summon-${instanceId}`,
    playerId: 'P1',
    type: 'SUMMON_UNIT',
    payload: {
      instanceId,
      slotId,
    },
  } satisfies GameAction<SummonUnitPayload>;
}

describe('summon system', () => {
  it('summons a hand unit to an own front slot', () => {
    const state = addHandCard(createPhase6State(), 'hand-unit-1', 'unit_basic_vanguard');
    const result = applySummonUnit(state, summonAction('hand-unit-1'));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.state.players.P1?.hand).toEqual([]);
    expect(result.state.players.P1?.resource.current).toBe(8);
    expect(result.state.board.slots[createSlotId('P1', 'FRONT', 0)]?.unit).toBe('hand-unit-1');
    expect(result.state.zones.cardInstances['hand-unit-1']?.currentZone).toEqual({
      type: 'BATTLEFIELD',
      ownerId: 'P1',
      slotId: createSlotId('P1', 'FRONT', 0),
    });
    expect(result.state.zones.cardInstances['hand-unit-1']?.summonedThisTurn).toBe(true);
    expect(result.state.players.P1?.dominance).toMatchObject({ used: 1, boardValue: 1 });
    expect(result.events.map((event) => event.type)).toEqual([
      'CARD_MOVED',
      'UNIT_SUMMONED',
      'DOMINANCE_CHANGED',
    ]);
    expect(result.actionLogEntry.accepted).toBe(true);
  });

  it('summons a back-row unit to an own back slot', () => {
    const state = addHandCard(createPhase6State(), 'back-unit-1', 'unit_back_support');
    const result = applySummonUnit(
      state,
      summonAction('back-unit-1', createSlotId('P1', 'BACK', 0)),
    );

    expect(result.ok).toBe(true);
  });

  it('rejects row restriction mismatch', () => {
    const state = addHandCard(createPhase6State(), 'back-unit-1', 'unit_back_support');
    const result = applySummonUnit(state, summonAction('back-unit-1'));

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.validation.errors.some((error) => error.code === 'ERR_ROW_RESTRICTED')).toBe(
      true,
    );
    expect(result.state).toBe(state);
  });

  it('rejects non-unit cards, missing hand cards, opponent slots, occupied slots, resource, and dominance failures', () => {
    const tacticState = addHandCard(createPhase6State(), 'tactic-1', 'tactic_basic_focus');
    const tacticResult = applySummonUnit(tacticState, summonAction('tactic-1'));
    expect(tacticResult.ok).toBe(false);

    const missingResult = applySummonUnit(createPhase6State(), summonAction('missing-card'));
    expect(missingResult.ok).toBe(false);

    const opponentSlotState = addHandCard(createPhase6State(), 'unit-1', 'unit_basic_vanguard');
    const opponentSlotResult = applySummonUnit(
      opponentSlotState,
      summonAction('unit-1', createSlotId('P2', 'FRONT', 0)),
    );
    expect(opponentSlotResult.ok).toBe(false);

    const occupiedState = addHandCard(
      addBoardUnit(createPhase6State(), 'board-unit-1', 'unit_basic_vanguard'),
      'unit-2',
      'unit_basic_vanguard',
    );
    const occupiedResult = applySummonUnit(occupiedState, summonAction('unit-2'));
    expect(occupiedResult.ok).toBe(false);

    const noResourceState = addHandCard(
      createPhase6State({
        players: {
          ...createPhase6State().players,
          P1: {
            ...createPhase6State().players.P1!,
            resource: {
              ...createPhase6State().players.P1!.resource,
              current: 0,
            },
          },
        },
      }),
      'unit-3',
      'unit_basic_vanguard',
    );
    const noResourceResult = applySummonUnit(noResourceState, summonAction('unit-3'));
    expect(noResourceResult.ok).toBe(false);

    const noDominanceState = addHandCard(
      createPhase6State({
        players: {
          ...createPhase6State().players,
          P1: {
            ...createPhase6State().players.P1!,
            dominance: {
              ...createPhase6State().players.P1!.dominance,
              limit: 0,
            },
          },
        },
      }),
      'unit-4',
      'unit_basic_vanguard',
    );
    const noDominanceResult = applySummonUnit(noDominanceState, summonAction('unit-4'));
    expect(noDominanceResult.ok).toBe(false);
  });
});
