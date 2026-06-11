import { getUnitAttack, getUnitRemainingHealth } from '../../battle';
import type { CardDefinition, CardInstance } from '../../cards';
import type { GameState, InstanceId } from '../../core';
import type { CardRuntimeNumberField } from './types';

export interface CardRuntimeNumberValue {
  field: CardRuntimeNumberField;
  value: number | null;
}

export function getCardRuntimeNumberValues(
  state: GameState,
  instanceId: InstanceId,
): CardRuntimeNumberValue[] {
  const instance = state.zones.cardInstances[instanceId];

  if (!instance) {
    return [];
  }

  const definition = state.cardDefinitions?.[instance.definitionId];

  if (!definition) {
    return [];
  }

  return getCardRuntimeNumberValuesFromDefinition(state, definition, instance);
}

export function getCardRuntimeNumberValuesFromDefinition(
  state: GameState,
  definition: CardDefinition,
  instance?: CardInstance,
): CardRuntimeNumberValue[] {
  const instanceId = instance?.instanceId;

  return [
    { field: 'COST', value: definition.cost },
    { field: 'DOMINANCE_COST', value: definition.dominanceCost ?? 0 },
    { field: 'DOMINANCE_VALUE', value: definition.dominanceValue ?? 0 },
    { field: 'DOMINANCE_REQUIREMENT', value: definition.dominanceRequirement ?? null },
    {
      field: 'ATTACK',
      value:
        definition.type === 'UNIT'
          ? instanceId
            ? getUnitAttack(state, instanceId)
            : (definition.baseAttack ?? 0)
          : null,
    },
    {
      field: 'HEALTH',
      value:
        definition.type === 'UNIT'
          ? instanceId
            ? getUnitRemainingHealth(state, instanceId)
            : (definition.baseHealth ?? 0)
          : null,
    },
  ];
}
