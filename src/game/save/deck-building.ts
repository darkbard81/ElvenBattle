import type { GameSession, RuntimeCardInstance } from './session';
import type { CardInstance, CardInstanceZone } from './types';

export type MoveDeckCardToCollectionOptions = {
  deckCardInstanceId: string;
};

export type MoveCollectionCardToDeckOptions = {
  collectionCardInstanceId: string;
};

/**
 * 보유 컬렉션 카드 1장을 전투 덱의 마지막 위치로 이동한다.
 * 리더는 고정 카드이므로 이동할 수 없으며, 반환값은 원본 세션을 변경하지 않는 새 세션이다.
 */
export function moveCollectionCardToDeck(
  session: GameSession,
  options: MoveCollectionCardToDeckOptions,
): GameSession {
  const collectionCardIndex = session.collection.cards.findIndex(
    (card) => card.instance.instanceId === options.collectionCardInstanceId,
  );
  if (collectionCardIndex < 0) {
    throw new Error(`Collection card not found: ${options.collectionCardInstanceId}`);
  }

  const collectionCard = session.collection.cards[collectionCardIndex]!;
  assertCollectionCard(collectionCard);
  assertMovableCard(collectionCard);

  return {
    ...session,
    deck: {
      id: session.deck.id,
      leader: cloneRuntimeCard(session.deck.leader, 'LEADER'),
      cards: [
        ...session.deck.cards.map((card) => cloneRuntimeCard(card, 'DECK')),
        cloneRuntimeCard(collectionCard, 'DECK'),
      ],
    },
    collection: {
      cards: session.collection.cards
        .filter((_, index) => index !== collectionCardIndex)
        .map((card) => cloneRuntimeCard(card, 'COLLECTION')),
    },
    stageProgress: structuredClone(session.stageProgress),
  };
}

/**
 * 전투 덱 카드 1장을 보유 컬렉션의 마지막 위치로 이동한다.
 * 최소 덱 장수 제한은 없으므로 마지막 덱 카드도 제거할 수 있다.
 */
export function moveDeckCardToCollection(
  session: GameSession,
  options: MoveDeckCardToCollectionOptions,
): GameSession {
  if (session.deck.leader.instance.instanceId === options.deckCardInstanceId) {
    throw new Error(`Leader card cannot be moved: ${options.deckCardInstanceId}`);
  }

  const deckCardIndex = session.deck.cards.findIndex(
    (card) => card.instance.instanceId === options.deckCardInstanceId,
  );
  if (deckCardIndex < 0) {
    throw new Error(`Deck card not found: ${options.deckCardInstanceId}`);
  }

  const deckCard = session.deck.cards[deckCardIndex]!;
  assertDeckCard(deckCard);
  assertMovableCard(deckCard);

  return {
    ...session,
    deck: {
      id: session.deck.id,
      leader: cloneRuntimeCard(session.deck.leader, 'LEADER'),
      cards: session.deck.cards
        .filter((_, index) => index !== deckCardIndex)
        .map((card) => cloneRuntimeCard(card, 'DECK')),
    },
    collection: {
      cards: [
        ...session.collection.cards.map((card) => cloneRuntimeCard(card, 'COLLECTION')),
        cloneRuntimeCard(deckCard, 'COLLECTION'),
      ],
    },
    stageProgress: structuredClone(session.stageProgress),
  };
}

function assertDeckCard(card: RuntimeCardInstance): void {
  if (card.instance.zone !== 'DECK') {
    throw new Error(`Deck card must be in DECK zone: ${card.instance.instanceId}`);
  }
}

function assertCollectionCard(card: RuntimeCardInstance): void {
  if (card.instance.zone !== 'COLLECTION') {
    throw new Error(`Collection card must be in COLLECTION zone: ${card.instance.instanceId}`);
  }
}

function assertMovableCard(card: RuntimeCardInstance): void {
  if (card.definition.type === 'LEADER' || card.instance.type === 'LEADER') {
    throw new Error(`Leader card cannot be moved: ${card.instance.instanceId}`);
  }
}

function cloneRuntimeCard(card: RuntimeCardInstance, zone: CardInstanceZone): RuntimeCardInstance {
  const instance: CardInstance = {
    ...structuredClone(card.instance),
    zone,
  };

  return {
    instance,
    definition: card.definition,
  };
}
