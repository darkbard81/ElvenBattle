import type { GameState } from '../core';
import { createAttackDeclaredEvent, createDamageDealtEvent } from '../events';
import { createActionLogEntry } from '../replay';
import type { AttackPayload, GameAction } from '../rules';
import { validationError } from '../rules';
import type { ApplyActionResult } from '../game';
import { applyDamageToPlayer, applyDamageToUnit, getUnitAttack } from './damage';
import { collectDestroyedUnits, destroyUnits } from './destroy';
import { resolveAttackTarget } from './target';
import { validateAttack } from './validation';

export function applyAttack(
  state: GameState,
  action: GameAction<AttackPayload>,
): ApplyActionResult {
  const validation = validateAttack(state, action);

  if (!validation.ok) {
    return {
      ok: false,
      state,
      validation,
    };
  }

  const resolution = resolveAttackTarget(state, action.payload.attackerId, action.payload.target);
  const attacker = state.zones.cardInstances[action.payload.attackerId];

  if (!resolution || !attacker) {
    return {
      ok: false,
      state,
      validation: validationError('ERR_INVALID_TARGET', 'error.invalid_target', {
        payload: action.payload,
      }),
    };
  }

  const canCounter =
    resolution.type === 'UNIT' &&
    resolution.attackerSlot.row === 'FRONT' &&
    resolution.targetSlot.row === 'FRONT' &&
    !hasStatus(state, resolution.target.unitId, 'STUNNED') &&
    getUnitAttack(state, resolution.target.unitId) > 0;
  const attackDeclaredEvent = createAttackDeclaredEvent(
    state,
    action.payload.attackerId,
    action.payload.target,
  );
  let nextState: GameState = {
    ...state,
    eventLog: [...state.eventLog, attackDeclaredEvent],
  };

  const attackDamage = getUnitAttack(nextState, action.payload.attackerId);

  if (resolution.type === 'UNIT') {
    const damageResult = applyDamageToUnit(nextState, resolution.target.unitId, attackDamage, {
      type: 'UNIT',
      unitId: action.payload.attackerId,
    });
    nextState = appendDamageEvent(damageResult.state, damageResult);
  } else {
    const damageResult = applyDamageToPlayer(nextState, resolution.target.playerId, attackDamage, {
      type: 'UNIT',
      unitId: action.payload.attackerId,
    });
    nextState = appendDamageEvent(damageResult.state, damageResult);
  }

  if (canCounter && resolution.type === 'UNIT') {
    const counterDamage = getUnitAttack(state, resolution.target.unitId);
    const damageResult = applyDamageToUnit(nextState, action.payload.attackerId, counterDamage, {
      type: 'UNIT',
      unitId: resolution.target.unitId,
    });
    nextState = appendDamageEvent(damageResult.state, damageResult);
  }

  const exhaustedAttacker = nextState.zones.cardInstances[action.payload.attackerId];

  if (exhaustedAttacker) {
    nextState = {
      ...nextState,
      zones: {
        ...nextState.zones,
        cardInstances: {
          ...nextState.zones.cardInstances,
          [action.payload.attackerId]: {
            ...exhaustedAttacker,
            exhausted: true,
          },
        },
      },
      turnState: {
        ...nextState.turnState,
        attackedUnitIds: [...nextState.turnState.attackedUnitIds, action.payload.attackerId],
      },
    };
  }

  const destroyedUnits = collectDestroyedUnits(nextState);
  const destroyedResult = destroyUnits(nextState, destroyedUnits, 'COMBAT_DAMAGE');
  const stateAfterDestroyed = destroyedResult.state;
  const actionLogEntry = createActionLogEntry(stateAfterDestroyed, action, true);
  const finalState: GameState = {
    ...stateAfterDestroyed,
    actionLog: [...stateAfterDestroyed.actionLog, actionLogEntry],
  };

  return {
    ok: true,
    state: finalState,
    events: finalState.eventLog.slice(state.eventLog.length),
    actionLogEntry,
  };
}

function appendDamageEvent(
  state: GameState,
  damageResult: {
    amount: number;
    source: { type: 'UNIT'; unitId: string } | { type: 'PLAYER'; playerId: string };
    target: { type: 'UNIT'; unitId: string } | { type: 'PLAYER'; playerId: string };
  },
): GameState {
  if (damageResult.amount <= 0) {
    return state;
  }

  const event = createDamageDealtEvent(
    state,
    damageResult.source,
    damageResult.target,
    damageResult.amount,
  );

  return {
    ...state,
    eventLog: [...state.eventLog, event],
  };
}

function hasStatus(state: GameState, unitId: string, statusType: 'STUNNED'): boolean {
  return (
    state.zones.cardInstances[unitId]?.statusEffects.some((status) => status.type === statusType) ??
    false
  );
}
