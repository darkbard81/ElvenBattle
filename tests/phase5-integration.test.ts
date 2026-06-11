import { describe, expect, it } from 'vitest';
import basicUnit from '../card-data/examples/basic-unit.example.json';
import { createCardInstance, parseCardDefinition } from '../src/cards';
import { advanceToFirstPlayablePhase } from '../src/game';
import { createTestGameState } from './helpers/game-state';

describe('phase5 integration', () => {
  it('draws one card during the automatic DRAW phase before MAIN', () => {
    const definition = parseCardDefinition(basicUnit);
    const instance = createCardInstance(definition, 'P1', 'auto-draw-1');
    const baseState = createTestGameState();
    const state = createTestGameState({
      phase: 'TURN_START',
      players: {
        ...baseState.players,
        P1: {
          ...baseState.players.P1!,
          deck: ['auto-draw-1'],
        },
      },
      zones: {
        ...baseState.zones,
        cardInstances: {
          'auto-draw-1': instance,
        },
      },
    });

    const nextState = advanceToFirstPlayablePhase(state);

    expect(nextState.phase).toBe('MAIN');
    expect(nextState.players.P1?.deck).toEqual([]);
    expect(nextState.players.P1?.hand).toEqual(['auto-draw-1']);
    expect(nextState.eventLog.map((event) => event.type)).toEqual([
      'PHASE_CHANGED',
      'CARD_MOVED',
      'CARD_DRAWN',
      'PHASE_CHANGED',
      'PHASE_CHANGED',
    ]);
    expect(nextState.eventLog[1]?.phase).toBe('DRAW');
    expect(nextState.eventLog[2]?.phase).toBe('DRAW');
  });
});
