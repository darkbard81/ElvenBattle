import { createSlotId } from '../src/board';
import type { GameState } from '../src/core';
import { addBoardUnit, createPhase6State } from './phase6-helpers';

export function createPhase7State(overrides: Partial<GameState> = {}): GameState {
  return createPhase6State({
    phase: 'COMBAT',
    ...overrides,
  });
}

export function addFrontCombatants(state: GameState = createPhase7State()): GameState {
  return addBoardUnit(
    addBoardUnit(state, 'attacker-1', 'unit_basic_vanguard', createSlotId('P1', 'FRONT', 0), 'P1'),
    'defender-1',
    'unit_basic_vanguard',
    createSlotId('P2', 'FRONT', 0),
    'P2',
  );
}
