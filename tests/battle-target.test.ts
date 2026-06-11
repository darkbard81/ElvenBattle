import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import {
  canAttackPlayerDirectly,
  getDefendingBackSlot,
  getDefendingFrontSlot,
  isBackRowProtected,
  resolveAttackTarget,
} from '../src/battle';
import { addBoardUnit } from './phase6-helpers';
import { createPhase7State } from './phase7-helpers';

describe('battle target', () => {
  it('resolves same-column front and back row slots', () => {
    const state = addBoardUnit(
      createPhase7State(),
      'attacker-1',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 1),
      'P1',
    );

    expect(getDefendingFrontSlot(state.board, 'P2', 1)?.slotId).toBe(
      createSlotId('P2', 'FRONT', 1),
    );
    expect(getDefendingBackSlot(state.board, 'P2', 1)?.slotId).toBe(createSlotId('P2', 'BACK', 1));
    expect(
      resolveAttackTarget(state, 'attacker-1', {
        type: 'PLAYER',
        playerId: 'P2',
      })?.type,
    ).toBe('PLAYER');
  });

  it('detects back-row protection and direct attack blocking by lane', () => {
    const state = addBoardUnit(
      addBoardUnit(
        createPhase7State(),
        'front-guard',
        'unit_basic_vanguard',
        createSlotId('P2', 'FRONT', 0),
        'P2',
      ),
      'back-unit',
      'unit_back_support',
      createSlotId('P2', 'BACK', 0),
      'P2',
    );

    expect(isBackRowProtected(state.board, 'P2', 0)).toBe(true);
    expect(canAttackPlayerDirectly(state.board, 'P2', 0)).toBe(false);
    expect(canAttackPlayerDirectly(state.board, 'P2', 1)).toBe(true);
  });
});
