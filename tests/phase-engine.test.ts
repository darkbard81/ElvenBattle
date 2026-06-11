import { describe, expect, it } from 'vitest';
import {
  TURN_PHASES,
  advanceToFirstPlayablePhase,
  getNextPhase,
  isAutomaticPhase,
  isTurnPhase,
} from '../src/game';
import { createTestGameState } from './helpers/game-state';

describe('phase engine', () => {
  it('defines the core turn phase order', () => {
    expect(TURN_PHASES).toEqual(['TURN_START', 'DRAW', 'RESOURCE', 'MAIN', 'COMBAT', 'END']);
  });

  it('resolves next phases for playable phases', () => {
    expect(getNextPhase('MAIN')).toBe('COMBAT');
    expect(getNextPhase('COMBAT')).toBe('END');
    expect(getNextPhase('END')).toBeNull();
  });

  it('detects turn phases and automatic phases', () => {
    expect(isTurnPhase('DRAW')).toBe(true);
    expect(isTurnPhase('SETUP')).toBe(false);
    expect(isAutomaticPhase('TURN_START')).toBe(true);
    expect(isAutomaticPhase('RESOURCE')).toBe(true);
    expect(isAutomaticPhase('MAIN')).toBe(false);
  });

  it('can advance non-draw automatic phases to MAIN', () => {
    const state = createTestGameState({ phase: 'RESOURCE' });
    const nextState = advanceToFirstPlayablePhase(state);

    expect(nextState.phase).toBe('MAIN');
    expect(nextState.eventLog.map((event) => event.type)).toEqual(['PHASE_CHANGED']);
    expect(state.phase).toBe('RESOURCE');
    expect(state.eventLog).toHaveLength(0);
  });
});
