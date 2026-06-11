import type { CardId, InstanceId, PlayerId } from '../core';
import { validationError, validationOk } from '../rules';
import type { ValidationResult } from '../rules';
import { createCardInstance } from './instance';
import { getCardDefinition, type CardRegistry } from './registry';
import type { CardInstance } from './types';

export interface DeckEntry {
  cardId: CardId;
  count: number;
}

export interface DeckValidationRule {
  minSize: number;
  maxSize: number;
  maxCopiesPerCard: number;
  allowTokenCards: boolean;
}

export interface DeterministicRng {
  seed: string;
  cursor: number;
}

export interface ShuffleResult {
  instanceIds: InstanceId[];
  rng: DeterministicRng;
}

export interface InitialDeckSetup {
  cardInstances: Record<InstanceId, CardInstance>;
  deck: InstanceId[];
  hand: InstanceId[];
  rng: DeterministicRng;
}

export function validateDeckList(
  registry: CardRegistry,
  deckList: readonly DeckEntry[],
  rule: DeckValidationRule,
): ValidationResult {
  const errors: ValidationResult[] = [];
  const copiesByCard: Record<CardId, number> = {};
  let totalCount = 0;

  for (const entry of deckList) {
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      errors.push(
        validationError('ERR_DECK_INVALID', 'error.deck_invalid', {
          cardId: entry.cardId,
          count: entry.count,
        }),
      );
      continue;
    }

    const definition = registry.definitions[entry.cardId];

    if (!definition) {
      errors.push(
        validationError('ERR_CARD_DEFINITION_NOT_FOUND', 'error.card_definition_not_found', {
          cardId: entry.cardId,
        }),
      );
      continue;
    }

    if (definition.type === 'TOKEN' && !rule.allowTokenCards) {
      errors.push(
        validationError('ERR_DECK_INVALID', 'error.deck_invalid', {
          cardId: entry.cardId,
          reason: 'token_card_not_allowed',
        }),
      );
    }

    copiesByCard[entry.cardId] = (copiesByCard[entry.cardId] ?? 0) + entry.count;
    totalCount += entry.count;
  }

  for (const [cardId, count] of Object.entries(copiesByCard)) {
    if (count > rule.maxCopiesPerCard) {
      errors.push(
        validationError('ERR_DECK_INVALID', 'error.deck_invalid', {
          cardId,
          count,
          maxCopiesPerCard: rule.maxCopiesPerCard,
        }),
      );
    }
  }

  if (totalCount < rule.minSize || totalCount > rule.maxSize) {
    errors.push(
      validationError('ERR_DECK_INVALID', 'error.deck_invalid', {
        totalCount,
        minSize: rule.minSize,
        maxSize: rule.maxSize,
      }),
    );
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors: errors.flatMap((result) => result.errors),
    };
  }

  return validationOk();
}

export function expandDeckList(deckList: readonly DeckEntry[]): CardId[] {
  return deckList.flatMap((entry) => Array.from({ length: entry.count }, () => entry.cardId));
}

export function createDeckInstances(
  registry: CardRegistry,
  ownerId: PlayerId,
  deckList: readonly DeckEntry[],
  instanceIdPrefix: string,
): CardInstance[] {
  return expandDeckList(deckList).map((cardId, index) =>
    createCardInstance(
      getCardDefinition(registry, cardId),
      ownerId,
      `${instanceIdPrefix}-${index + 1}`,
    ),
  );
}

export function createInitialDeckSetup(
  registry: CardRegistry,
  ownerId: PlayerId,
  deckList: readonly DeckEntry[],
  instanceIdPrefix: string,
  rng: DeterministicRng,
  startingHandSize: number,
): InitialDeckSetup {
  const instances = createDeckInstances(registry, ownerId, deckList, instanceIdPrefix);
  const shuffled = shuffleInstanceIds(
    instances.map((instance) => instance.instanceId),
    rng,
  );
  const hand = shuffled.instanceIds.slice(0, startingHandSize);
  const deck = shuffled.instanceIds.slice(startingHandSize);
  const cardInstances = Object.fromEntries(
    instances.map((instance) => {
      if (!hand.includes(instance.instanceId)) {
        return [instance.instanceId, instance];
      }

      return [
        instance.instanceId,
        {
          ...instance,
          currentZone: {
            type: 'HAND',
            ownerId,
          },
        },
      ];
    }),
  ) as Record<InstanceId, CardInstance>;

  return {
    cardInstances,
    deck,
    hand,
    rng: shuffled.rng,
  };
}

export function shuffleInstanceIds(
  instanceIds: readonly InstanceId[],
  rng: DeterministicRng,
): ShuffleResult {
  const shuffled = [...instanceIds];
  let cursor = rng.cursor;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = randomUnit(rng.seed, cursor);
    cursor += 1;
    const swapIndex = Math.floor(randomValue * (index + 1));
    const current = shuffled[index];
    const replacement = shuffled[swapIndex];

    if (current === undefined || replacement === undefined) {
      throw new Error('Shuffle index is out of range.');
    }

    shuffled[index] = replacement;
    shuffled[swapIndex] = current;
  }

  return {
    instanceIds: shuffled,
    rng: {
      seed: rng.seed,
      cursor,
    },
  };
}

function randomUnit(seed: string, cursor: number): number {
  let hash = 2166136261;
  const input = `${seed}:${cursor}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0x100000000;
}
