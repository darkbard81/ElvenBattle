import type { GameState, InstanceId } from '../core';
import type { Expiration, StatusEffect, StatusEffectType } from './types';

export type ExpirationTiming = 'START_OF_TURN' | 'END_OF_TURN';

export function applyStatusEffect(
  state: GameState,
  unitId: InstanceId,
  status: StatusEffect,
): GameState {
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
          statusEffects: [...instance.statusEffects, status],
        },
      },
    },
  };
}

export function hasStatusEffect(
  state: GameState,
  unitId: InstanceId,
  statusType: StatusEffectType,
): boolean {
  return (
    state.zones.cardInstances[unitId]?.statusEffects.some((status) => status.type === statusType) ??
    false
  );
}

export function removeExpiredStatusEffects(state: GameState, timing: ExpirationTiming): GameState {
  let nextInstances = state.zones.cardInstances;
  let changed = false;

  for (const [unitId, instance] of Object.entries(state.zones.cardInstances)) {
    const statusEffects = instance.statusEffects.filter(
      (status) => !expiresAtTiming(status.expiresAt, timing),
    );

    if (statusEffects.length !== instance.statusEffects.length) {
      changed = true;
      nextInstances = {
        ...nextInstances,
        [unitId]: {
          ...instance,
          statusEffects,
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

export function expiresAtTiming(
  expiresAt: Expiration | undefined,
  timing: ExpirationTiming,
): boolean {
  if (!expiresAt) {
    return false;
  }

  return expiresAt.type === timing;
}
