import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyMoveUnit } from '../src/game';
import type { GameAction, MoveUnitPayload } from '../src/rules';
import { addBoardUnit, createPhase6State } from './phase6-helpers';

function moveAction(unitId: string, toSlotId = createSlotId('P1', 'BACK', 0)) {
  return {
    actionId: `move-${unitId}`,
    playerId: 'P1',
    type: 'MOVE_UNIT',
    payload: {
      unitId,
      toSlotId,
    },
  } satisfies GameAction<MoveUnitPayload>;
}

describe('move unit system', () => {
  it('moves a board unit to an own empty slot', () => {
    const state = addBoardUnit(createPhase6State(), 'unit-1', 'unit_basic_vanguard');
    const result = applyMoveUnit(state, moveAction('unit-1'));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.state.board.slots[createSlotId('P1', 'FRONT', 0)]?.unit).toBeNull();
    expect(result.state.board.slots[createSlotId('P1', 'BACK', 0)]?.unit).toBe('unit-1');
    expect(result.state.zones.cardInstances['unit-1']?.currentZone.slotId).toBe(
      createSlotId('P1', 'BACK', 0),
    );
    expect(result.state.turnState.movedUnitIds).toContain('unit-1');
    expect(result.events.map((event) => event.type)).toEqual(['UNIT_MOVED', 'DOMINANCE_CHANGED']);
    expect(result.actionLogEntry.accepted).toBe(true);
  });

  it('rejects moving the same unit twice in one turn', () => {
    const state = addBoardUnit(
      createPhase6State({
        turnState: {
          ...createPhase6State().turnState,
          movedUnitIds: ['unit-1'],
        },
      }),
      'unit-1',
      'unit_basic_vanguard',
    );
    const result = applyMoveUnit(state, moveAction('unit-1'));

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.validation.errors.some((error) => error.code === 'ERR_UNIT_ALREADY_MOVED')).toBe(
      true,
    );
    expect(result.state).toBe(state);
  });

  it('rejects missing units, occupied slots, and opponent slots', () => {
    const missingResult = applyMoveUnit(createPhase6State(), moveAction('missing-unit'));
    expect(missingResult.ok).toBe(false);

    const occupiedState = addBoardUnit(
      addBoardUnit(createPhase6State(), 'unit-1', 'unit_basic_vanguard'),
      'unit-2',
      'unit_basic_vanguard',
      createSlotId('P1', 'BACK', 0),
    );
    const occupiedResult = applyMoveUnit(occupiedState, moveAction('unit-1'));
    expect(occupiedResult.ok).toBe(false);

    const opponentSlotState = addBoardUnit(createPhase6State(), 'unit-1', 'unit_basic_vanguard');
    const opponentSlotResult = applyMoveUnit(
      opponentSlotState,
      moveAction('unit-1', createSlotId('P2', 'BACK', 0)),
    );
    expect(opponentSlotResult.ok).toBe(false);
  });
});
