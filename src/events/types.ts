import type { EventId, InstanceId, PlayerId } from '../core';
import type { Phase } from '../core';
import type { GameEndReason, WinCondition } from '../game/types';

export type GameEventType =
  | 'GAME_STARTED'
  | 'TURN_STARTED'
  | 'TURN_ENDED'
  | 'PHASE_CHANGED'
  | 'CARD_DRAWN'
  | 'CARD_PLAYED'
  | 'UNIT_SUMMONED'
  | 'UNIT_MOVED'
  | 'ATTACK_DECLARED'
  | 'DAMAGE_DEALT'
  | 'UNIT_DESTROYED'
  | 'CARD_MOVED'
  | 'EFFECT_TRIGGERED'
  | 'EFFECT_RESOLVED'
  | 'EFFECT_EXPIRED'
  | 'RESOURCE_CHANGED'
  | 'DOMINANCE_CHANGED'
  | 'DOMINANCE_OVERLOADED'
  | 'GAME_ENDED';

export interface EventSourceRef {
  type: 'GAME' | 'PLAYER' | 'CARD' | 'EFFECT' | 'SCENARIO';
  id?: string | InstanceId;
}

export interface GameEvent<TPayload = unknown> {
  eventId: EventId;
  type: GameEventType;
  turnNumber: number;
  phase: Phase;
  source?: EventSourceRef;
  payload: TPayload;
  visibility: 'PUBLIC' | 'OWNER_ONLY' | 'HIDDEN';
  rngCursor?: number;
}

export interface GameEndedPayload {
  winner: PlayerId | null;
  loser: PlayerId | null;
  reason: GameEndReason;
  condition: WinCondition['type'];
  detail?: Record<string, string | number | boolean | null>;
}
