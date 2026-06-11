import type { GameState, InstanceId } from '../core';
import type { Expiration, Modifier } from './types';
import { expiresAtTiming, type ExpirationTiming } from './status';

export function applyModifier(state: GameState, unitId: InstanceId, modifier: Modifier): GameState {
  const instance = state.zones.cardInstances[unitId];

  if (!instance) {
    return state;
  }

  return {
    ...state,
    zones: {
      ...state.zones,
      cardInstances: {
        ...state.zones.cardInstances,
        [unitId]: {
          ...instance,
          temporaryModifiers: [...instance.temporaryModifiers, modifier],
        },
      },
    },
  };
}

export function removeExpiredModifiers(state: GameState, timing: ExpirationTiming): GameState {
  let nextInstances = state.zones.cardInstances;
  let changed = false;

  for (const [unitId, instance] of Object.entries(state.zones.cardInstances)) {
    const temporaryModifiers = instance.temporaryModifiers.filter(
      (modifier) => !expiresAtTiming(modifier.expiresAt as Expiration | undefined, timing),
    );

    if (temporaryModifiers.length !== instance.temporaryModifiers.length) {
      changed = true;
      nextInstances = {
        ...nextInstances,
        [unitId]: {
          ...instance,
          temporaryModifiers,
        },
      };
    }
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    zones: {
      ...state.zones,
      cardInstances: nextInstances,
    },
  };
}

export function getModifiedAttack(state: GameState, unitId: InstanceId): number {
  const instance = state.zones.cardInstances[unitId];

  if (!instance) {
    return 0;
  }

  const modifierAmount = instance.temporaryModifiers
    .filter((modifier) => modifier.stat === 'ATTACK')
    .reduce((sum, modifier) => sum + modifier.amount, 0);

  return Math.max(0, (instance.currentAttack ?? 0) + modifierAmount);
}

export function getModifiedHealth(state: GameState, unitId: InstanceId): number {
  const instance = state.zones.cardInstances[unitId];

  if (!instance) {
    return 0;
  }

  const modifierAmount = instance.temporaryModifiers
    .filter((modifier) => modifier.stat === 'HEALTH')
    .reduce((sum, modifier) => sum + modifier.amount, 0);

  return Math.max(0, (instance.currentHealth ?? 0) + modifierAmount);
}
