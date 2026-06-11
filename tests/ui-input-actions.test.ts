import { describe, expect, it } from 'vitest';

import { createSlotId } from '../src/board';
import {
  createLegalTargetsForSelection,
  createPhaseButtonAction,
  findUiActionForAttackTarget,
  findUiActionForSlot,
  submitUiAction,
} from '../src/ui';
import { addBoardUnit, addHandCard, createPhase6State } from './phase6-helpers';

describe('Phase13 UI input action mapping', () => {
  it('maps a selected hand unit to legal summon slot actions', () => {
    const state = addHandCard(createPhase6State(), 'hand-unit', 'unit_basic_vanguard');
    const selection = { type: 'HAND_CARD' as const, instanceId: 'hand-unit' };
    const targets = createLegalTargetsForSelection(state, 'P1', selection);
    const search = findUiActionForSlot(state, 'P1', selection, createSlotId('P1', 'FRONT', 0));

    expect(targets.some((target) => target.type === 'SLOT')).toBe(true);
    expect(search.action?.type).toBe('SUMMON_UNIT');
  });

  it('maps a selected board unit to legal move slot actions', () => {
    const state = addBoardUnit(createPhase6State(), 'board-unit', 'unit_basic_vanguard');
    const selection = { type: 'BOARD_UNIT' as const, unitId: 'board-unit' };
    const search = findUiActionForSlot(state, 'P1', selection, createSlotId('P1', 'BACK', 0));

    expect(search.action?.type).toBe('MOVE_UNIT');
  });

  it('maps a selected attacker to legal attack targets only', () => {
    const attackerState = addBoardUnit(
      createPhase6State({ phase: 'COMBAT' }),
      'attacker',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 0),
    );
    const withFrontDefender = addBoardUnit(
      attackerState,
      'front-defender',
      'unit_basic_vanguard',
      createSlotId('P2', 'FRONT', 0),
      'P2',
    );
    const state = addBoardUnit(
      withFrontDefender,
      'back-defender',
      'unit_back_support',
      createSlotId('P2', 'BACK', 0),
      'P2',
    );
    const selection = { type: 'BOARD_UNIT' as const, unitId: 'attacker' };
    const frontSearch = findUiActionForAttackTarget(state, 'P1', selection, {
      type: 'UNIT',
      unitId: 'front-defender',
    });
    const backSearch = findUiActionForAttackTarget(state, 'P1', selection, {
      type: 'UNIT',
      unitId: 'back-defender',
    });
    const playerSearch = findUiActionForAttackTarget(state, 'P1', selection, {
      type: 'PLAYER',
      playerId: 'P2',
    });

    expect(frontSearch.action?.type).toBe('ATTACK');
    expect(backSearch.action).toBeNull();
    expect(playerSearch.action).toBeNull();
  });

  it('creates phase button actions only for matching phases and preserves state on failure', () => {
    const mainState = createPhase6State();
    const endPhase = createPhaseButtonAction(mainState, 'P1', 'END_PHASE');
    const endTurn = createPhaseButtonAction(mainState, 'P1', 'END_TURN');
    const submitted = submitUiAction(mainState, null);

    expect(endPhase?.type).toBe('END_PHASE');
    expect(endTurn).toBeNull();
    expect(submitted.state).toBe(mainState);
    expect(submitted.result.stateChanged).toBe(false);
  });
});
