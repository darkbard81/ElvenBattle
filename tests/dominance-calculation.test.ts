import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { calculateSlotDominance, recalculateDominance } from '../src/dominance';
import { addBoardUnit, createPhase6State, phase6Registry } from './phase6-helpers';

describe('dominance calculation', () => {
  it('recalculates cost used, boardValue, and overloaded from board units', () => {
    const state = addBoardUnit(
      createPhase6State(),
      'unit-1',
      'unit_back_support',
      createSlotId('P1', 'BACK', 0),
    );
    const result = recalculateDominance(state, phase6Registry.definitions, 'P1', 'RECALCULATE');

    expect(result.state.players.P1?.dominance).toMatchObject({
      used: 1,
      boardValue: 1,
      overloaded: false,
    });
    expect(result.event?.type).toBe('DOMINANCE_CHANGED');
  });

  it('calculates slot dominance from base value and surrounding cards', () => {
    const state = addBoardUnit(
      createPhase6State(),
      'support-1',
      'unit_back_support',
      createSlotId('P1', 'BACK', 0),
    );

    expect(
      calculateSlotDominance(
        state,
        phase6Registry.definitions,
        'P1',
        createSlotId('P1', 'FRONT', 0),
      ),
    ).toBe(2);
    expect(
      calculateSlotDominance(
        state,
        phase6Registry.definitions,
        'P1',
        createSlotId('P1', 'FRONT', 2),
      ),
    ).toBe(1);
  });

  it('marks overloaded when a unit costs more than its slot dominance', () => {
    const state = addBoardUnit(
      {
        ...createPhase6State(),
        dominanceConfig: {
          ...createPhase6State().dominanceConfig,
          baseSlotValue: 0,
        },
      },
      'unit-1',
      'unit_basic_vanguard',
    );
    const result = recalculateDominance(state, phase6Registry.definitions, 'P1', 'RECALCULATE');

    expect(result.state.players.P1?.dominance.overloaded).toBe(true);
  });
});
