import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS, requireCardDefinition, type CardDefinition } from './card-catalog';
import { createCardInstanceFromDefinition } from './deck-instancing';
import { createInitialSaveState } from './create-initial-save';
import {
  createGameSession,
  createSaveSlotStateFromGameSession,
  type GameSession,
  type RuntimeCardInstance,
} from './session';
import { moveCollectionCardToDeck, moveDeckCardToCollection } from './deck-building';

describe('deck building card movement', () => {
  it('moves a collection card into the deck without removing another deck card', async () => {
    const session = await createSessionWithCollection('unit_elf_assassin_001');
    const collectionCard = session.collection.cards[0]!;

    const nextSession = moveCollectionCardToDeck(session, {
      collectionCardInstanceId: collectionCard.instance.instanceId,
    });

    expect(nextSession.deck.cards).toHaveLength(session.deck.cards.length + 1);
    expect(nextSession.collection.cards).toHaveLength(session.collection.cards.length - 1);
    const addedDeckCard = nextSession.deck.cards[nextSession.deck.cards.length - 1]!;

    expect(addedDeckCard.instance.instanceId).toBe(collectionCard.instance.instanceId);
    expect(addedDeckCard.definition.id).toBe(collectionCard.definition.id);
    expect(addedDeckCard.instance.zone).toBe('DECK');
    expect(nextSession.collection.cards).toEqual([]);
    expect(session.collection.cards[0]!.instance.instanceId).toBe(
      collectionCard.instance.instanceId,
    );
  });

  it('moves a deck card into the collection and allows an empty non-leader deck', async () => {
    const session = await createSingleCardDeckSession();
    const deckCard = session.deck.cards[0]!;

    const nextSession = moveDeckCardToCollection(session, {
      deckCardInstanceId: deckCard.instance.instanceId,
    });

    expect(nextSession.deck.cards).toHaveLength(0);
    expect(nextSession.collection.cards).toHaveLength(1);
    expect(nextSession.collection.cards[0]!.instance.instanceId).toBe(deckCard.instance.instanceId);
    expect(nextSession.collection.cards[0]!.definition.id).toBe(deckCard.definition.id);
    expect(nextSession.collection.cards[0]!.instance.zone).toBe('COLLECTION');
    expect(session.deck.cards).toHaveLength(1);
  });

  it('rejects missing instance IDs, leaders, and cards in the wrong zone', async () => {
    const session = await createSessionWithCollection('unit_elf_assassin_001');

    expect(() =>
      moveCollectionCardToDeck(session, {
        collectionCardInstanceId: 'missing-collection-card',
      }),
    ).toThrow('Collection card not found: missing-collection-card');
    expect(() =>
      moveDeckCardToCollection(session, {
        deckCardInstanceId: 'missing-deck-card',
      }),
    ).toThrow('Deck card not found: missing-deck-card');
    expect(() =>
      moveDeckCardToCollection(session, {
        deckCardInstanceId: session.deck.leader.instance.instanceId,
      }),
    ).toThrow('Leader card cannot be moved');

    const collectionWithLeader = {
      ...session,
      collection: {
        cards: [
          createRuntimeCard(
            requireCardDefinition('leader_minerva'),
            'collection-leader',
            'COLLECTION',
          ),
        ],
      },
    };
    expect(() =>
      moveCollectionCardToDeck(collectionWithLeader, {
        collectionCardInstanceId: 'collection-leader',
      }),
    ).toThrow('Leader card cannot be moved: collection-leader');

    const deckWithWrongZone = {
      ...session,
      deck: {
        ...session.deck,
        cards: [
          {
            ...session.deck.cards[0]!,
            instance: {
              ...session.deck.cards[0]!.instance,
              zone: 'COLLECTION' as const,
            },
          },
        ],
      },
    };
    expect(() =>
      moveDeckCardToCollection(deckWithWrongZone, {
        deckCardInstanceId: session.deck.cards[0]!.instance.instanceId,
      }),
    ).toThrow('Deck card must be in DECK zone');

    const collectionWithWrongZone = {
      ...session,
      collection: {
        cards: [
          {
            ...session.collection.cards[0]!,
            instance: {
              ...session.collection.cards[0]!.instance,
              zone: 'DECK' as const,
            },
          },
        ],
      },
    };
    expect(() =>
      moveCollectionCardToDeck(collectionWithWrongZone, {
        collectionCardInstanceId: session.collection.cards[0]!.instance.instanceId,
      }),
    ).toThrow('Collection card must be in COLLECTION zone');
  });

  it('allows non-leader card types to move between collection and deck', async () => {
    const itemDefinition: CardDefinition = {
      id: 'item-test',
      name: '테스트 아이템',
      rarity: 'C',
      type: 'ITEM',
      traits: [],
      hp: 0,
      attack: 0,
      abilities: [],
      description: '',
      note: '',
    };
    const session = await createSessionWithCollection('unit_elf_assassin_001');
    const sessionWithItem = {
      ...session,
      collection: {
        cards: [createRuntimeCard(itemDefinition, 'collection-item', 'COLLECTION')],
      },
    };

    const nextSession = moveCollectionCardToDeck(sessionWithItem, {
      collectionCardInstanceId: 'collection-item',
    });

    const addedDeckCard = nextSession.deck.cards[nextSession.deck.cards.length - 1]!;
    expect(addedDeckCard.definition.type).toBe('ITEM');
    expect(addedDeckCard.instance.zone).toBe('DECK');
  });

  it('persists free deck counts through save serialization and session reload', async () => {
    const session = await createSingleCardDeckSession();
    const deckCard = session.deck.cards[0]!;

    const nextSession = moveDeckCardToCollection(session, {
      deckCardInstanceId: deckCard.instance.instanceId,
    });
    const savedState = createSaveSlotStateFromGameSession(nextSession, {
      now: new Date('2024-01-02T00:00:00.000Z'),
    });
    const reloadedSession = createGameSession(savedState);

    expect(savedState.deck.cards).toHaveLength(0);
    expect(savedState.collection.cards).toHaveLength(1);
    expect(savedState.collection.cards[0]!.instanceId).toBe(deckCard.instance.instanceId);
    expect(reloadedSession.deck.cards).toHaveLength(0);
    expect(reloadedSession.collection.cards[0]!.instance.instanceId).toBe(
      deckCard.instance.instanceId,
    );
  });
});

async function createSessionWithCollection(collectionDefinitionId: string): Promise<GameSession> {
  const state = await createInitialSaveState({ slotId: 1 });
  state.collection.cards.push(
    createCardInstanceFromDefinition({
      definition: requireUnitDefinition(collectionDefinitionId),
      owner: 'PLAYER',
      zone: 'COLLECTION',
      createId: () => 'collection-card-1',
    }),
  );

  return createGameSession(state);
}

async function createSingleCardDeckSession(): Promise<GameSession> {
  const state = await createInitialSaveState({ slotId: 1 });
  state.deck.cards = [state.deck.cards[0]!];

  return createGameSession(state);
}

function requireUnitDefinition(definitionId: string): CardDefinition {
  const definition = CARD_DEFINITIONS.find(
    (candidate) => candidate.id === definitionId && candidate.type === 'UNIT',
  );
  if (!definition) {
    throw new Error(`Missing UNIT card definition: ${definitionId}`);
  }

  return definition;
}

function createRuntimeCard(
  definition: CardDefinition,
  instanceId: string,
  zone: RuntimeCardInstance['instance']['zone'],
): RuntimeCardInstance {
  const instance = createCardInstanceFromDefinition({
    definition,
    owner: 'PLAYER',
    zone,
    createId: () => instanceId,
  });

  return {
    instance,
    definition,
  };
}
