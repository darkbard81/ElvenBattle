import type { CardId } from '../core';
import type { CardDefinition } from './types';

export class CardRegistryError extends Error {
  readonly code: 'ERR_CARD_DEFINITION_DUPLICATED' | 'ERR_CARD_DEFINITION_NOT_FOUND';
  readonly detail: Record<string, unknown>;

  constructor(
    code: 'ERR_CARD_DEFINITION_DUPLICATED' | 'ERR_CARD_DEFINITION_NOT_FOUND',
    message: string,
    detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'CardRegistryError';
    this.code = code;
    this.detail = detail;
  }
}

export interface CardRegistry {
  definitions: Record<CardId, CardDefinition>;
  allIds: CardId[];
}

export function createCardRegistry(definitions: readonly CardDefinition[]): CardRegistry {
  const registry: CardRegistry = {
    definitions: {},
    allIds: [],
  };

  for (const definition of definitions) {
    if (registry.definitions[definition.cardId]) {
      throw new CardRegistryError(
        'ERR_CARD_DEFINITION_DUPLICATED',
        `Duplicated cardId: ${definition.cardId}`,
        { cardId: definition.cardId },
      );
    }

    registry.definitions[definition.cardId] = definition;
    registry.allIds.push(definition.cardId);
  }

  return registry;
}

export function getCardDefinition(registry: CardRegistry, cardId: CardId): CardDefinition {
  const definition = registry.definitions[cardId];

  if (!definition) {
    throw new CardRegistryError('ERR_CARD_DEFINITION_NOT_FOUND', `Card not found: ${cardId}`, {
      cardId,
    });
  }

  return definition;
}
