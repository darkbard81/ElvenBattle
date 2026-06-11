import type { EffectId, InstanceId, PlayerId } from '../core';

export type StatusEffectType =
  | 'CANNOT_ATTACK'
  | 'CANNOT_DEFEND'
  | 'STUNNED'
  | 'SHIELD'
  | 'ATTACK_UP'
  | 'HEALTH_UP'
  | 'TAUNT'
  | 'BACK_ROW_GUARD'
  | 'DOMINANCE_LIMIT_UP'
  | 'DOMINANCE_VALUE_UP'
  | 'DOMINANCE_COST_DOWN';

export type Expiration =
  | { type: 'END_OF_TURN'; playerId?: PlayerId }
  | { type: 'START_OF_TURN'; playerId?: PlayerId }
  | { type: 'LEAVES_BATTLEFIELD'; sourceId: InstanceId }
  | { type: 'USES'; remaining: number }
  | { type: 'PERMANENT' };

export interface StatusEffect {
  statusId: string;
  type: StatusEffectType;
  sourceId?: InstanceId;
  stacks: number;
  expiresAt: Expiration;
  visible: boolean;
}

export type ModifierLayer =
  | 'BASE'
  | 'PERMANENT'
  | 'ATTACHED'
  | 'AURA'
  | 'TEMPORARY'
  | 'DAMAGE'
  | 'RESTRICTION';

export interface Modifier {
  modifierId: string;
  sourceId?: InstanceId;
  layer: ModifierLayer;
  stat?: 'ATTACK' | 'HEALTH' | 'DOMINANCE_COST' | 'DOMINANCE_VALUE';
  amount: number;
  expiresAt?: Expiration;
}

export interface EffectScript {
  id: string;
  trigger?: string;
  condition?: Record<string, unknown>;
  target?: Record<string, unknown>;
  effect: Record<string, unknown>;
  timing?: Record<string, unknown>;
}

export interface AbilityDefinition {
  abilityId: string;
  textKey?: string;
  trigger?: string;
  effectScript?: EffectScript;
}

export interface PendingEffect {
  effectId: EffectId;
  sourceId?: InstanceId;
  controllerId: PlayerId;
  payload: Record<string, unknown>;
}

export interface ContinuousEffect {
  effectId: EffectId;
  sourceId?: InstanceId;
  controllerId: PlayerId;
  layer: ModifierLayer;
  payload: Record<string, unknown>;
}

export interface PendingTrigger {
  triggerId: string;
  effectId: EffectId;
  sourceId?: InstanceId;
  controllerId: PlayerId;
  eventId: string;
  payload: Record<string, unknown>;
}
