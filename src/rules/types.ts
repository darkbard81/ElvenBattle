import type { ActionId, InstanceId, PlayerId } from '../core';
import type { SlotId } from '../board';

export type ActionType =
  | 'PLAY_CARD'
  | 'SUMMON_UNIT'
  | 'ACTIVATE_EFFECT'
  | 'ATTACK'
  | 'MOVE_UNIT'
  | 'END_PHASE'
  | 'END_TURN'
  | 'SURRENDER'
  | 'MULLIGAN'
  | 'SELECT_TARGET';

export interface GameAction<TPayload = unknown> {
  actionId: ActionId;
  playerId: PlayerId;
  type: ActionType;
  payload: TPayload;
  clientTimestamp?: number;
}

export type ActionTarget =
  | { type: 'UNIT'; unitId: InstanceId }
  | { type: 'PLAYER'; playerId: PlayerId };

export interface AttackPayload {
  attackerId: InstanceId;
  target: ActionTarget;
}

export interface SummonUnitPayload {
  instanceId: InstanceId;
  slotId: SlotId;
}

export interface MoveUnitPayload {
  unitId: InstanceId;
  toSlotId: SlotId;
}

export interface ValidationResult {
  ok: boolean;
  errors: RuleError[];
}

export interface RuleError {
  code: RuleErrorCode;
  messageKey: string;
  detail?: Record<string, unknown>;
}

export type RuleErrorCode =
  | 'ERR_WRONG_PHASE'
  | 'ERR_NOT_PRIORITY_PLAYER'
  | 'ERR_CARD_NOT_IN_ZONE'
  | 'ERR_INSUFFICIENT_RESOURCE'
  | 'ERR_INSUFFICIENT_DOMINANCE'
  | 'ERR_DOMINANCE_REQUIREMENT_NOT_MET'
  | 'ERR_INVALID_TARGET'
  | 'ERR_SLOT_NOT_FOUND'
  | 'ERR_NOT_OWN_SLOT'
  | 'ERR_SLOT_OCCUPIED'
  | 'ERR_ROW_RESTRICTED'
  | 'ERR_CARD_NOT_UNIT'
  | 'ERR_UNIT_NOT_ON_BOARD'
  | 'ERR_UNIT_ALREADY_MOVED'
  | 'ERR_ATTACKER_NOT_FOUND'
  | 'ERR_ATTACKER_NOT_CONTROLLED'
  | 'ERR_ATTACKER_ALREADY_ATTACKED'
  | 'ERR_ATTACKER_CANNOT_ATTACK'
  | 'ERR_ATTACKER_POWER_ZERO'
  | 'ERR_TARGET_PROTECTED'
  | 'ERR_TARGET_NOT_ATTACKABLE'
  | 'ERR_DIRECT_ATTACK_BLOCKED'
  | 'ERR_ATTACKER_EXHAUSTED'
  | 'ERR_SUMMONING_SICKNESS'
  | 'ERR_ONCE_PER_TURN_USED'
  | 'ERR_EFFECT_CONDITION_NOT_MET'
  | 'ERR_EFFECT_LOOP_LIMIT'
  | 'ERR_EFFECT_TARGET_INVALID'
  | 'ERR_EFFECT_DSL_INVALID'
  | 'ERR_ACTION_NOT_IMPLEMENTED'
  | 'ERR_CARD_DEFINITION_INVALID'
  | 'ERR_CARD_DEFINITION_DUPLICATED'
  | 'ERR_CARD_DEFINITION_NOT_FOUND'
  | 'ERR_DECK_INVALID'
  | 'ERR_EMPTY_DECK'
  | 'ERR_ZONE_MOVE_INVALID'
  | 'ERR_CARD_INSTANCE_NOT_FOUND'
  | 'ERR_GAME_ALREADY_FINISHED';
