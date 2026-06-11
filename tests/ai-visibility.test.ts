import { describe, expect, it } from 'vitest';

import { createAiView, canAiSeeCard } from '../src/ai';
import { createCardInstance } from '../src/cards';
import { addHandCard, createPhase6State, phase6Registry } from './phase6-helpers';

describe('AI visibility', () => {
  it('masks opponent hand and deck by default', () => {
    const definition = phase6Registry.definitions.unit_basic_vanguard!;
    const deckInstance = {
      ...createCardInstance(definition, 'P2', 'p2-deck-1'),
      currentZone: {
        type: 'DECK' as const,
        ownerId: 'P2',
      },
    };
    const withOpponentHand = addHandCard(createPhase6State(), 'p2-hand-1', definition.cardId, 'P2');
    const state = {
      ...withOpponentHand,
      players: {
        ...withOpponentHand.players,
        P2: {
          ...withOpponentHand.players.P2!,
          deck: ['p2-deck-1'],
        },
      },
      zones: {
        ...withOpponentHand.zones,
        cardInstances: {
          ...withOpponentHand.zones.cardInstances,
          'p2-deck-1': deckInstance,
        },
      },
    };

    const view = createAiView(state, 'P1');

    expect(view.state.players.P2!.hand).toEqual(['hidden:P2:hand:0']);
    expect(view.state.players.P2!.deck).toEqual(['hidden:P2:deck:0']);
    expect(view.state.zones.cardInstances['p2-hand-1']).toBeUndefined();
    expect(view.state.zones.cardInstances['p2-deck-1']).toBeUndefined();
    expect(canAiSeeCard(state, 'P1', 'p2-hand-1')).toBe(false);
  });

  it('keeps the full state with omniscient option', () => {
    const state = addHandCard(createPhase6State(), 'p2-hand-1', 'unit_basic_vanguard', 'P2');
    const view = createAiView(state, 'P1', { omniscient: true });

    expect(view.state.players.P2!.hand).toEqual(['p2-hand-1']);
    expect(view.state.zones.cardInstances['p2-hand-1']?.definitionId).toBe('unit_basic_vanguard');
  });
});
