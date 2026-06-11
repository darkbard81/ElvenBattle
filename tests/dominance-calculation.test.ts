import { describe, expect, it } from 'vitest';
import { recalculateDominance } from '../src/dominance';
import { addBoardUnit, createPhase6State, phase6Registry } from './phase6-helpers';

describe('dominance calculation', () => {
  it('recalculates used, boardValue, and overloaded from board units', () => {
    const state = addBoardUnit(createPhase6State(), 'unit-1', 'unit_basic_vanguard');
    const result = recalculateDominance(state, phase6Registry.definitions, 'P1', 'RECALCULATE');

    expect(result.state.players.P1?.dominance).toMatchObject({
      used: 1,
      boardValue: 1,
      overloaded: false,
    });
    expect(result.event?.type).toBe('DOMINANCE_CHANGED');
  });

  it('marks overloaded when board units exceed the dominance limit', () => {
    const baseState = createPhase6State({
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
    });
    const state = addBoardUnit(baseState, 'unit-1', 'unit_basic_vanguard');
    const result = recalculateDominance(state, phase6Registry.definitions, 'P1', 'RECALCULATE');

    expect(result.state.players.P1?.dominance.overloaded).toBe(true);
  });
});
