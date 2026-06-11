import type { CardDefinition } from '../cards';
import type { GameState } from '../core';
import {
  validationError,
  validationOk,
  type AttackPayload,
  type GameAction,
  type ValidationResult,
} from '../rules';
import { getUnitAttack } from './damage';
import {
  canAttackPlayerDirectly,
  getDefendingFrontSlot,
  isBackRowProtected,
  resolveAttackTarget,
} from './target';

export function validateAttack(
  state: GameState,
  action: GameAction<AttackPayload>,
): ValidationResult {
  const attackerValidation = validateAttacker(state, action);

  if (!attackerValidation.ok) {
    return attackerValidation;
  }

  return validateTarget(state, action);
}

export function validateAttacker(
  state: GameState,
  action: GameAction<AttackPayload>,
): ValidationResult {
  const attacker = state.zones.cardInstances[action.payload.attackerId];

  if (!attacker) {
    return validationError('ERR_ATTACKER_NOT_FOUND', 'error.attacker_not_found', {
      attackerId: action.payload.attackerId,
    });
  }

  const resolution = resolveAttackTarget(state, action.payload.attackerId, action.payload.target);

  if (!resolution || attacker.currentZone.type !== 'BATTLEFIELD') {
    return validationError('ERR_UNIT_NOT_ON_BOARD', 'error.unit_not_on_board', {
      unitId: action.payload.attackerId,
    });
  }

  if (attacker.controllerId !== action.playerId) {
    return validationError('ERR_ATTACKER_NOT_CONTROLLED', 'error.attacker_not_controlled', {
      attackerId: action.payload.attackerId,
      controllerId: attacker.controllerId,
      playerId: action.playerId,
    });
  }

  if (state.turnState.attackedUnitIds.includes(action.payload.attackerId)) {
    return validationError('ERR_ATTACKER_ALREADY_ATTACKED', 'error.attacker_already_attacked', {
      attackerId: action.payload.attackerId,
    });
  }

  if (attacker.exhausted) {
    return validationError('ERR_ATTACKER_EXHAUSTED', 'error.attacker_exhausted', {
      attackerId: action.payload.attackerId,
    });
  }

  if (attacker.summonedThisTurn) {
    return validationError('ERR_SUMMONING_SICKNESS', 'error.summoning_sickness', {
      attackerId: action.payload.attackerId,
    });
  }

  if (
    attacker.statusEffects.some(
      (status) => status.type === 'CANNOT_ATTACK' || status.type === 'STUNNED',
    )
  ) {
    return validationError('ERR_ATTACKER_CANNOT_ATTACK', 'error.attacker_cannot_attack', {
      attackerId: action.payload.attackerId,
    });
  }

  if (getUnitAttack(state, action.payload.attackerId) <= 0) {
    return validationError('ERR_ATTACKER_POWER_ZERO', 'error.attacker_power_zero', {
      attackerId: action.payload.attackerId,
    });
  }

  return validationOk();
}

export function validateTarget(
  state: GameState,
  action: GameAction<AttackPayload>,
): ValidationResult {
  const resolution = resolveAttackTarget(state, action.payload.attackerId, action.payload.target);

  if (!resolution) {
    return validationError('ERR_INVALID_TARGET', 'error.invalid_target', {
      payload: action.payload,
    });
  }

  if (resolution.defenderId === action.playerId) {
    return validationError('ERR_TARGET_NOT_ATTACKABLE', 'error.target_not_attackable', {
      target: action.payload.target,
    });
  }

  if (resolution.type === 'PLAYER') {
    if (!state.players[resolution.defenderId]) {
      return validationError('ERR_INVALID_TARGET', 'error.invalid_target', {
        playerId: resolution.defenderId,
      });
    }

    if (
      !canAttackPlayerDirectly(state.board, resolution.defenderId, resolution.attackerSlot.column)
    ) {
      return validationError('ERR_DIRECT_ATTACK_BLOCKED', 'error.direct_attack_blocked', {
        defenderId: resolution.defenderId,
        column: resolution.attackerSlot.column,
      });
    }

    return validationOk();
  }

  if (resolution.targetSlot.column !== resolution.attackerSlot.column) {
    return validationError('ERR_TARGET_NOT_ATTACKABLE', 'error.target_not_attackable', {
      attackerColumn: resolution.attackerSlot.column,
      targetColumn: resolution.targetSlot.column,
    });
  }

  if (resolution.targetSlot.ownerSide === action.playerId) {
    return validationError('ERR_TARGET_NOT_ATTACKABLE', 'error.target_not_attackable', {
      target: action.payload.target,
    });
  }

  if (
    resolution.targetSlot.row === 'BACK' &&
    isBackRowProtected(state.board, resolution.defenderId, resolution.targetSlot.column) &&
    !hasPierceBackRow(state, action.payload.attackerId)
  ) {
    return validationError('ERR_TARGET_PROTECTED', 'error.target_protected', {
      target: action.payload.target,
      frontSlotId: getDefendingFrontSlot(
        state.board,
        resolution.defenderId,
        resolution.targetSlot.column,
      )?.slotId,
    });
  }

  return validationOk();
}

function hasPierceBackRow(state: GameState, attackerId: string): boolean {
  const attacker = state.zones.cardInstances[attackerId];
  const definition: CardDefinition | undefined = attacker
    ? state.cardDefinitions?.[attacker.definitionId]
    : undefined;

  return definition?.tags.includes('PIERCE_BACK_ROW') ?? false;
}
