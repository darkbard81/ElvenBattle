import type { GameState } from '../core';
import type { GameEvent } from '../events';
import { createDamageDealtEvent } from '../events';
import { applyDamageToPlayer, applyDamageToUnit } from '../battle/damage';
import { collectDestroyedUnits, destroyUnits } from '../battle/destroy';
import { handleDrawFromEmptyDeck } from '../game/win';
import type { ActionTarget } from '../rules';
import { drawCards } from '../zones';
import { applyModifier } from './modifiers';
import { applyStatusEffect } from './status';
import type { EffectScript, Expiration, StatusEffectType } from './types';
import { resolveEffectTarget, type TargetSelector } from './targets';

export type EffectExecutionStatus = 'RESOLVED' | 'SKIPPED' | 'FAILED';

export interface ExecuteEffectContext {
  sourceId?: string;
  controllerId: string;
  event?: GameEvent;
}

export interface ExecuteEffectResult {
  state: GameState;
  status: EffectExecutionStatus;
  result: Record<string, unknown>;
}

export function executeEffectScript(
  state: GameState,
  script: EffectScript,
  context: ExecuteEffectContext,
): ExecuteEffectResult {
  const effect = script.effect;
  const type = readString(effect, 'type');
  const selector = readSelector(effect.target ?? script.target?.selector);
  const target = selector
    ? resolveEffectTarget(state, selector, context.sourceId, context.controllerId, context.event)
    : null;

  if (!type || !selector) {
    return skipped(state, 'invalid_effect_shape', script.id);
  }

  if (!target) {
    return skipped(state, 'target_not_found', script.id);
  }

  if (type === 'DAMAGE') {
    return executeDamage(state, effect, target, context);
  }

  if (type === 'HEAL') {
    return executeHeal(state, effect, target);
  }

  if (type === 'APPLY_STATUS') {
    return executeApplyStatus(state, effect, target, context, script.id);
  }

  if (type === 'MODIFY_STAT') {
    return executeModifyStat(state, effect, target, context, script.id);
  }

  if (type === 'DRAW_CARD') {
    return executeDrawCard(state, effect, target);
  }

  return skipped(state, 'unsupported_effect_type', type);
}

function executeDamage(
  state: GameState,
  effect: Record<string, unknown>,
  target: ActionTarget,
  context: ExecuteEffectContext,
): ExecuteEffectResult {
  const amount = readNonNegativeInteger(effect, 'amount');

  if (amount === null) {
    return skipped(state, 'invalid_amount', 'DAMAGE');
  }

  const source: ActionTarget = context.sourceId
    ? { type: 'UNIT', unitId: context.sourceId }
    : { type: 'PLAYER', playerId: context.controllerId };
  const damageResult =
    target.type === 'UNIT'
      ? applyDamageToUnit(state, target.unitId, amount, source)
      : applyDamageToPlayer(state, target.playerId, amount, source);
  let nextState = damageResult.state;

  if (damageResult.amount > 0) {
    const event = createDamageDealtEvent(
      nextState,
      damageResult.source,
      damageResult.target,
      damageResult.amount,
    );
    nextState = {
      ...nextState,
      eventLog: [...nextState.eventLog, event],
      eventQueue: [...nextState.eventQueue, event],
    };
  }

  const destroyedUnits = collectDestroyedUnits(nextState);
  const destroyResult = destroyUnits(nextState, destroyedUnits, 'EFFECT');

  return {
    state: destroyResult.state,
    status: 'RESOLVED',
    result: {
      type: 'DAMAGE',
      amount,
      target,
      destroyedUnitIds: destroyResult.destroyedUnitIds,
    },
  };
}

function executeHeal(
  state: GameState,
  effect: Record<string, unknown>,
  target: ActionTarget,
): ExecuteEffectResult {
  const amount = readNonNegativeInteger(effect, 'amount');

  if (amount === null) {
    return skipped(state, 'invalid_amount', 'HEAL');
  }

  if (target.type === 'PLAYER') {
    const player = state.players[target.playerId];

    if (!player) {
      return skipped(state, 'target_not_found', 'HEAL');
    }

    return {
      state: {
        ...state,
        players: {
          ...state.players,
          [target.playerId]: {
            ...player,
            hp: Math.min(player.maxHp, player.hp + amount),
          },
        },
      },
      status: 'RESOLVED',
      result: { type: 'HEAL', amount, target },
    };
  }

  const instance = state.zones.cardInstances[target.unitId];

  if (!instance) {
    return skipped(state, 'target_not_found', 'HEAL');
  }

  return {
    state: {
      ...state,
      zones: {
        ...state.zones,
        cardInstances: {
          ...state.zones.cardInstances,
          [target.unitId]: {
            ...instance,
            damage: Math.max(0, instance.damage - amount),
          },
        },
      },
    },
    status: 'RESOLVED',
    result: { type: 'HEAL', amount, target },
  };
}

function executeApplyStatus(
  state: GameState,
  effect: Record<string, unknown>,
  target: ActionTarget,
  context: ExecuteEffectContext,
  effectId: string,
): ExecuteEffectResult {
  if (target.type !== 'UNIT') {
    return skipped(state, 'target_not_unit', 'APPLY_STATUS');
  }

  const status = readString(effect, 'status') as StatusEffectType | null;
  const expiresAt = readExpiration(effect.expiresAt);

  if (!status || !expiresAt) {
    return skipped(state, 'invalid_status', 'APPLY_STATUS');
  }

  return {
    state: applyStatusEffect(state, target.unitId, {
      statusId: `${effectId}:${target.unitId}:${state.eventLog.length}`,
      type: status,
      ...(context.sourceId ? { sourceId: context.sourceId } : {}),
      stacks: readNonNegativeInteger(effect, 'stacks') ?? 1,
      expiresAt,
      visible: true,
    }),
    status: 'RESOLVED',
    result: { type: 'APPLY_STATUS', status, target },
  };
}

function executeModifyStat(
  state: GameState,
  effect: Record<string, unknown>,
  target: ActionTarget,
  context: ExecuteEffectContext,
  effectId: string,
): ExecuteEffectResult {
  if (target.type !== 'UNIT') {
    return skipped(state, 'target_not_unit', 'MODIFY_STAT');
  }

  const stat = readString(effect, 'stat');
  const amount = readInteger(effect, 'amount');
  const expiresAt = readExpiration(effect.expiresAt);

  if ((stat !== 'ATTACK' && stat !== 'HEALTH') || amount === null || !expiresAt) {
    return skipped(state, 'invalid_modifier', 'MODIFY_STAT');
  }

  return {
    state: applyModifier(state, target.unitId, {
      modifierId: `${effectId}:${target.unitId}:${state.eventLog.length}`,
      ...(context.sourceId ? { sourceId: context.sourceId } : {}),
      layer: 'TEMPORARY',
      stat,
      amount,
      expiresAt,
    }),
    status: 'RESOLVED',
    result: { type: 'MODIFY_STAT', stat, amount, target },
  };
}

function executeDrawCard(
  state: GameState,
  effect: Record<string, unknown>,
  target: ActionTarget,
): ExecuteEffectResult {
  if (target.type !== 'PLAYER') {
    return skipped(state, 'target_not_player', 'DRAW_CARD');
  }

  const count = readNonNegativeInteger(effect, 'count');

  if (count === null) {
    return skipped(state, 'invalid_count', 'DRAW_CARD');
  }

  const drawResult = drawCards(state, target.playerId, count);

  if (!drawResult.ok) {
    if (drawResult.validation.errors.some((error) => error.code === 'ERR_EMPTY_DECK')) {
      return {
        state: handleDrawFromEmptyDeck(drawResult.state, target.playerId),
        status: 'RESOLVED',
        result: { type: 'DRAW_CARD', count, target, instanceIds: [], deckOut: true },
      };
    }

    return skipped(drawResult.state, 'draw_failed', 'DRAW_CARD');
  }

  return {
    state: {
      ...drawResult.state,
      eventQueue: [...drawResult.state.eventQueue, ...drawResult.events],
    },
    status: 'RESOLVED',
    result: { type: 'DRAW_CARD', count, target, instanceIds: drawResult.instanceIds },
  };
}

function skipped(state: GameState, reason: string, detail: string): ExecuteEffectResult {
  return {
    state,
    status: 'SKIPPED',
    result: { reason, detail },
  };
}

function readSelector(input: unknown): TargetSelector | null {
  return typeof input === 'string' ? (input as TargetSelector) : null;
}

function readString(value: Record<string, unknown>, key: string): string | null {
  const fieldValue = value[key];
  return typeof fieldValue === 'string' ? fieldValue : null;
}

function readNonNegativeInteger(value: Record<string, unknown>, key: string): number | null {
  const fieldValue = value[key];
  return Number.isInteger(fieldValue) && (fieldValue as number) >= 0
    ? (fieldValue as number)
    : null;
}

function readInteger(value: Record<string, unknown>, key: string): number | null {
  const fieldValue = value[key];
  return Number.isInteger(fieldValue) ? (fieldValue as number) : null;
}

function readExpiration(input: unknown): Expiration | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return null;
  }

  const value = input as Record<string, unknown>;
  return typeof value.type === 'string' ? (value as unknown as Expiration) : null;
}
