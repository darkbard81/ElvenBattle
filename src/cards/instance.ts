import type { InstanceId, PlayerId } from '../core';
import type { CardDefinition, CardInstance } from './types';

export function createCardInstance(
  definition: CardDefinition,
  ownerId: PlayerId,
  instanceId: InstanceId,
): CardInstance {
  const instance: CardInstance = {
    instanceId,
    definitionId: definition.cardId,
    ownerId,
    controllerId: ownerId,
    currentZone: {
      type: 'DECK',
      ownerId,
    },
    damage: 0,
    statusEffects: [],
    exhausted: false,
    summonedThisTurn: false,
    temporaryModifiers: [],
    attachedEffects: [],
  };

  if (definition.type === 'UNIT') {
    instance.currentAttack = definition.baseAttack ?? 0;
    instance.currentHealth = definition.baseHealth ?? 0;
  }

  return instance;
}
