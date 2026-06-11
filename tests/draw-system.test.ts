import { describe, expect, it } from 'vitest';
import basicUnit from '../card-data/examples/basic-unit.example.json';
import { createCardInstance, parseCardDefinition } from '../src/cards';
import { drawCard } from '../src/zones';
import { createTestGameState } from './helpers/game-state';

function createStateWithOneDeckCard() {
  const definition = parseCardDefinition(basicUnit);
  const instance = createCardInstance(definition, 'P1', 'draw-card-1');
  const baseState = createTestGameState();

  return createTestGameState({
    players: {
      ...baseState.players,
      P1: {
        ...baseState.players.P1!,
        deck: ['draw-card-1'],
      },
    },
    zones: {
      ...baseState.zones,
      cardInstances: {
        'draw-card-1': instance,
      },
    },
  });
}

describe('draw system', () => {
  it('draws the top deck card into hand and records events', () => {
    const state = createStateWithOneDeckCard();
    const result = drawCard(state, 'P1');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.instanceId).toBe('draw-card-1');
    expect(result.state.players.P1?.deck).toEqual([]);
    expect(result.state.players.P1?.hand).toEqual(['draw-card-1']);
    expect(result.events.map((event) => event.type)).toEqual(['CARD_MOVED', 'CARD_DRAWN']);
    expect(result.state.eventLog.map((event) => event.type)).toEqual(['CARD_MOVED', 'CARD_DRAWN']);
  });

  it('fails without changing state when the deck is empty', () => {
    const state = createTestGameState();
    const result = drawCard(state, 'P1');

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);

    if (result.ok) {
      return;
    }

    expect(result.validation.errors[0]?.code).toBe('ERR_EMPTY_DECK');
  });
});
