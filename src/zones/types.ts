import type { SlotId } from '../board';
import type { CardInstance } from '../cards';
import type { InstanceId, PlayerId } from '../core';

export type ZoneType =
  | 'DECK'
  | 'HAND'
  | 'BATTLEFIELD'
  | 'GRAVEYARD'
  | 'BANISHED'
  | 'STACK'
  | 'REVEALED'
  | 'TEMPORARY';

export interface ZoneRef {
  type: ZoneType;
  ownerId?: PlayerId;
  slotId?: SlotId;
}

export interface ZoneRegistry {
  cardInstances: Record<InstanceId, CardInstance>;
  stack: InstanceId[];
  revealed: Record<PlayerId, InstanceId[]>;
  temporary: InstanceId[];
}

export type ZoneMoveReason =
  | 'DRAW'
  | 'PLAY'
  | 'SUMMON'
  | 'DESTROY'
  | 'BANISH'
  | 'REVEAL'
  | 'RETURN'
  | 'EFFECT'
  | 'SETUP';

export interface CardMoveRecord {
  instanceId: InstanceId;
  from: ZoneRef;
  to: ZoneRef;
  reason: ZoneMoveReason;
}
