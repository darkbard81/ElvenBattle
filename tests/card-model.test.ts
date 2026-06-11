import { describe, expect, it } from 'vitest';
import type { CardDefinition, CardInstance } from '../src/cards';

describe('card model', () => {
  it('separates immutable card definition from runtime card instance', () => {
    const definition: CardDefinition = {
      cardId: 'unit_model_vanguard',
      nameKey: 'card.unit_model_vanguard.name',
      type: 'UNIT',
      cost: 2,
      dominanceCost: 1,
      dominanceValue: 1,
      baseAttack: 2,
      baseHealth: 3,
      rowRestriction: 'ANY',
      tags: ['BASIC_UNIT'],
      abilities: [],
      rarity: 'COMMON',
      aiHints: {
        role: 'FRONTLINE',
        preferredRow: 'FRONT',
      },
    };

    const instance: CardInstance = {
      instanceId: 'instance-001',
      definitionId: definition.cardId,
      ownerId: 'P1',
      controllerId: 'P1',
      currentZone: {
        type: 'HAND',
        ownerId: 'P1',
      },
      damage: 0,
      statusEffects: [],
      exhausted: false,
      summonedThisTurn: false,
      temporaryModifiers: [],
      attachedEffects: [],
    };

    expect(instance.definitionId).toBe(definition.cardId);
    expect(instance).not.toHaveProperty('nameKey');
    expect(instance).not.toHaveProperty('cost');
  });
});
