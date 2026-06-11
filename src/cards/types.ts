import type { Row } from '../board';
import type { CardId, EffectId, InstanceId, PlayerId } from '../core';
import type { AbilityDefinition, EffectScript, Modifier, StatusEffect } from '../effects';
import type { ZoneRef } from '../zones';

export type CardType = 'UNIT' | 'TACTIC' | 'ONGOING' | 'TOKEN';
export type CardRarity = 'COMMON' | 'RARE' | 'EPIC' | 'BOSS' | 'TOKEN';

export interface AiCardHints {
  role?: 'FRONTLINE' | 'BACKLINE' | 'REMOVAL' | 'SUPPORT' | 'RESOURCE' | 'OBJECTIVE';
  preferredRow?: Row;
  priority?: number;
}

export interface CardDefinition {
  cardId: CardId;
  nameKey: string;
  type: CardType;
  cost: number;
  dominanceCost?: number;
  dominanceValue?: number;
  dominanceRequirement?: number;
  faction?: string;
  attribute?: string;
  baseAttack?: number;
  baseHealth?: number;
  rowRestriction?: Row[] | 'ANY';
  tags: string[];
  abilities: AbilityDefinition[];
  effectScript?: EffectScript;
  rarity?: CardRarity;
  aiHints?: AiCardHints;
}

export interface CardInstance {
  instanceId: InstanceId;
  definitionId: CardId;
  ownerId: PlayerId;
  controllerId: PlayerId;
  currentZone: ZoneRef;
  currentAttack?: number;
  currentHealth?: number;
  damage: number;
  statusEffects: StatusEffect[];
  exhausted: boolean;
  summonedThisTurn: boolean;
  temporaryModifiers: Modifier[];
  attachedEffects: EffectId[];
}
