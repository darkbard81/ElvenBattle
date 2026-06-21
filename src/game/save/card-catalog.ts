import deckDefinitionData from '../../../cards/deck_test.json';

export type CardDefinitionFile = {
  version: string;
  cards: CardDefinition[];
};

export type CardDefinition = {
  id: string;
  name: string;
  type: string;
  cost?: number;
  dominance?: number;
  hp?: number;
  attack?: number;
  level?: number;
  exp?: number;
};

const deckDefinition = deckDefinitionData as CardDefinitionFile;

export const CARD_DEFINITIONS: CardDefinition[] = deckDefinition.cards;

export function createCardDefinitionMap(
  cardDefinitions: CardDefinition[] = CARD_DEFINITIONS,
): Map<string, CardDefinition> {
  return new Map(cardDefinitions.map((definition) => [definition.id, definition]));
}

export function findCardDefinition(
  definitionId: string,
  cardDefinitions: CardDefinition[] = CARD_DEFINITIONS,
): CardDefinition | null {
  return createCardDefinitionMap(cardDefinitions).get(definitionId) ?? null;
}

export function requireCardDefinition(
  definitionId: string,
  cardDefinitions: CardDefinition[] = CARD_DEFINITIONS,
): CardDefinition {
  const definition = findCardDefinition(definitionId, cardDefinitions);
  if (!definition) {
    throw new Error(`Unknown card definitionId: ${definitionId}`);
  }

  return definition;
}
