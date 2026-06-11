import { describe, expect, it } from 'vitest';

import { createSlotId } from '../src/board';
import { evaluateState } from '../src/ai';
import { addBoardUnit, createPhase6State } from './phase6-helpers';

describe('AI evaluation', () => {
  it('scores win and loss states with large values', () => {
    const won = createPhase6State({
      gameStatus: 'FINISHED',
      phase: 'GAME_OVER',
      winner: 'P1',
    });
    const lost = createPhase6State({
      gameStatus: 'FINISHED',
      phase: 'GAME_OVER',
      winner: 'P2',
    });

    expect(evaluateState(won, 'P1').score).toBeGreaterThan(90000);
    expect(evaluateState(lost, 'P1').score).toBeLessThan(-90000);
  });

  it('reflects HP, unit, and dominance advantages', () => {
    const disadvantaged = createPhase6State({
      players: {
        ...createPhase6State().players,
        P1: {
          ...createPhase6State().players.P1!,
          hp: 10,
        },
        P2: {
          ...createPhase6State().players.P2!,
          hp: 20,
        },
      },
    });
    const advantaged = addBoardUnit(
      createPhase6State({
        players: {
          ...createPhase6State().players,
          P1: {
            ...createPhase6State().players.P1!,
            hp: 25,
            dominance: {
              ...createPhase6State().players.P1!.dominance,
              boardValue: 2,
            },
          },
          P2: {
            ...createPhase6State().players.P2!,
            hp: 10,
          },
        },
      }),
      'unit',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 0),
    );

    expect(evaluateState(advantaged, 'P1').score).toBeGreaterThan(
      evaluateState(disadvantaged, 'P1').score,
    );
    expect(evaluateState(advantaged, 'P1').breakdown.dominanceBoardValueDelta).toBeGreaterThan(0);
  });
});
