import type { GameState, InstanceId, PlayerId } from '../core';
import { getModifiedAttack, getModifiedHealth } from '../effects/modifiers';
import type { ActionTarget } from '../rules';

export interface DamageResult {
  state: GameState;
  amount: number;
  source: ActionTarget;
  target: ActionTarget;
}

export function getUnitAttack(state: GameState, unitId: InstanceId): number {
  const instance = state.zones.cardInstances[unitId];

  return instance ? getModifiedAttack(state, unitId) : 0;
}

export function getUnitRemainingHealth(state: GameState, unitId: InstanceId): number {
  const instance = state.zones.cardInstances[unitId];

  if (!instance) {
    return 0;
  }

  return Math.max(0, getModifiedHealth(state, unitId) - instance.damage);
}

export function applyDamageToUnit(
  state: GameState,
  unitId: InstanceId,
  amount: number,
  source: ActionTarget,
): DamageResult {
  const instance = state.zones.cardInstances[unitId];
  const safeAmount = Math.max(0, amount);

  if (!instance || safeAmount === 0) {
    return {
      state,
      amount: safeAmount,
      source,
      target: {
        type: 'UNIT',
        unitId,
      },
    };
  }

  return {
    state: {
      ...state,
      zones: {
        ...state.zones,
        cardInstances: {
          ...state.zones.cardInstances,
          [unitId]: {
            ...instance,
            damage: instance.damage + safeAmount,
          },
        },
      },
    },
    amount: safeAmount,
    source,
    target: {
      type: 'UNIT',
      unitId,
    },
  };
}

export function applyDamageToPlayer(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  source: ActionTarget,
): DamageResult {
  const player = state.players[playerId];
  const safeAmount = Math.max(0, amount);

  if (!player || safeAmount === 0) {
    return {
      state,
      amount: safeAmount,
      source,
      target: {
        type: 'PLAYER',
        playerId,
      },
    };
  }

  return {
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          hp: player.hp - safeAmount,
        },
      },
    },
    amount: safeAmount,
    source,
    target: {
      type: 'PLAYER',
      playerId,
    },
  };
}
