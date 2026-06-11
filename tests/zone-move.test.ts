import { describe, expect, it } from 'vitest';
import basicUnit from '../card-data/examples/basic-unit.example.json';
import { createCardInstance, parseCardDefinition } from '../src/cards';
import { moveCard } from '../src/zones';
import { createTestGameState } from './helpers/game-state';

describe('zone move', () => {
  it('updates player zones and CardInstance.currentZone together', () => {
    const definition = parseCardDefinition(basicUnit);
    const instance = createCardInstance(definition, 'P1', 'card-1');
    const baseState = createTestGameState();
    const state = createTestGameState({
      players: {
        ...baseState.players,
        P1: {
          ...baseState.players.P1!,
          deck: ['card-1'],
        },
      },
      zones: {
        ...baseState.zones,
        cardInstances: {
          'card-1': instance,
        },
      },
    });

    const result = moveCard(state, 'card-1', { type: 'HAND', ownerId: 'P1' }, 'DRAW');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.state.players.P1?.deck).toEqual([]);
    expect(result.state.players.P1?.hand).toEqual(['card-1']);
    expect(result.state.zones.cardInstances['card-1']?.currentZone).toEqual({
      type: 'HAND',
      ownerId: 'P1',
    });
    expect(result.state.eventLog.at(-1)?.type).toBe('CARD_MOVED');
    expect(result.record.from).toEqual({ type: 'DECK', ownerId: 'P1' });
  });

  it('does not mutate state when the card instance is missing', () => {
    const state = createTestGameState();
    const result = moveCard(state, 'missing-card', { type: 'HAND', ownerId: 'P1' }, 'DRAW');

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(state.eventLog).toEqual([]);
  });
});
