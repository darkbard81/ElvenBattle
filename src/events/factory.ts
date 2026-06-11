import type { SlotId } from '../board';
import type { GameState, InstanceId, Phase, PlayerId } from '../core';
import type { DominanceState } from '../dominance';
import type { PendingEffect, PendingTrigger } from '../effects';
import type { GameEndResult } from '../game/types';
import type { ActionTarget } from '../rules';
import type { CardMoveRecord } from '../zones';
import type { GameEndedPayload, GameEvent } from './types';

function createEventId(state: GameState): string {
  return `event-${state.eventLog.length + state.eventQueue.length + 1}`;
}

export function createPhaseChangedEvent(
  state: GameState,
  from: Phase,
  to: Phase,
): GameEvent<{ from: Phase; to: Phase }> {
  return {
    eventId: createEventId(state),
    type: 'PHASE_CHANGED',
    turnNumber: state.turnNumber,
    phase: to,
    payload: { from, to },
    visibility: 'PUBLIC',
  };
}

export function createTurnStartedEvent(
  state: GameState,
  activePlayerId: PlayerId,
): GameEvent<{ activePlayerId: PlayerId }> {
  return {
    eventId: createEventId(state),
    type: 'TURN_STARTED',
    turnNumber: state.turnNumber + 1,
    phase: 'TURN_START',
    payload: { activePlayerId },
    visibility: 'PUBLIC',
  };
}

export function createTurnEndedEvent(
  state: GameState,
  endedPlayerId: PlayerId,
): GameEvent<{ endedPlayerId: PlayerId }> {
  return {
    eventId: createEventId(state),
    type: 'TURN_ENDED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    payload: { endedPlayerId },
    visibility: 'PUBLIC',
  };
}

export function createGameEndedEvent(
  state: GameState,
  result: GameEndResult,
): GameEvent<GameEndedPayload> {
  const payload: GameEndedPayload =
    result.detail === undefined
      ? {
          winner: result.winner,
          loser: result.loser,
          reason: result.reason,
          condition: result.condition,
        }
      : {
          winner: result.winner,
          loser: result.loser,
          reason: result.reason,
          condition: result.condition,
          detail: result.detail,
        };

  return {
    eventId: createEventId(state),
    type: 'GAME_ENDED',
    turnNumber: state.turnNumber,
    phase: 'GAME_OVER',
    source: {
      type: 'GAME',
      id: state.gameId,
    },
    payload,
    visibility: 'PUBLIC',
  };
}

export function createCardMovedEvent(
  state: GameState,
  record: CardMoveRecord,
): GameEvent<CardMoveRecord> {
  return {
    eventId: createEventId(state),
    type: 'CARD_MOVED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'CARD',
      id: record.instanceId,
    },
    payload: record,
    visibility: 'PUBLIC',
  };
}

export function createCardDrawnEvent(
  state: GameState,
  playerId: PlayerId,
  instanceId: InstanceId,
): GameEvent<{ playerId: PlayerId; instanceId: InstanceId }> {
  return {
    eventId: createEventId(state),
    type: 'CARD_DRAWN',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'PLAYER',
      id: playerId,
    },
    payload: {
      playerId,
      instanceId,
    },
    visibility: 'OWNER_ONLY',
  };
}

export function createUnitSummonedEvent(
  state: GameState,
  playerId: PlayerId,
  unitId: InstanceId,
  slotId: SlotId,
): GameEvent<{ playerId: PlayerId; unitId: InstanceId; slotId: SlotId }> {
  return {
    eventId: createEventId(state),
    type: 'UNIT_SUMMONED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'CARD',
      id: unitId,
    },
    payload: {
      playerId,
      unitId,
      slotId,
    },
    visibility: 'PUBLIC',
  };
}

export function createUnitMovedEvent(
  state: GameState,
  playerId: PlayerId,
  unitId: InstanceId,
  fromSlotId: SlotId,
  toSlotId: SlotId,
): GameEvent<{
  playerId: PlayerId;
  unitId: InstanceId;
  fromSlotId: SlotId;
  toSlotId: SlotId;
}> {
  return {
    eventId: createEventId(state),
    type: 'UNIT_MOVED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'CARD',
      id: unitId,
    },
    payload: {
      playerId,
      unitId,
      fromSlotId,
      toSlotId,
    },
    visibility: 'PUBLIC',
  };
}

export type DominanceChangeReason = 'SUMMON' | 'MOVE' | 'DESTROY' | 'EFFECT' | 'RECALCULATE';

export function createDominanceChangedEvent(
  state: GameState,
  playerId: PlayerId,
  before: DominanceState,
  after: DominanceState,
  reason: DominanceChangeReason,
): GameEvent<{
  playerId: PlayerId;
  before: DominanceState;
  after: DominanceState;
  reason: DominanceChangeReason;
}> {
  return {
    eventId: createEventId(state),
    type: 'DOMINANCE_CHANGED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'PLAYER',
      id: playerId,
    },
    payload: {
      playerId,
      before,
      after,
      reason,
    },
    visibility: 'PUBLIC',
  };
}

export function createAttackDeclaredEvent(
  state: GameState,
  attackerId: InstanceId,
  target: ActionTarget,
): GameEvent<{ attackerId: InstanceId; target: ActionTarget }> {
  return {
    eventId: createEventId(state),
    type: 'ATTACK_DECLARED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'CARD',
      id: attackerId,
    },
    payload: {
      attackerId,
      target,
    },
    visibility: 'PUBLIC',
  };
}

export function createDamageDealtEvent(
  state: GameState,
  source: ActionTarget,
  target: ActionTarget,
  amount: number,
): GameEvent<{ source: ActionTarget; target: ActionTarget; amount: number }> {
  return {
    eventId: createEventId(state),
    type: 'DAMAGE_DEALT',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source:
      source.type === 'UNIT'
        ? {
            type: 'CARD',
            id: source.unitId,
          }
        : {
            type: 'PLAYER',
            id: source.playerId,
          },
    payload: {
      source,
      target,
      amount,
    },
    visibility: 'PUBLIC',
  };
}

export function createUnitDestroyedEvent(
  state: GameState,
  unitId: InstanceId,
  reason: 'COMBAT_DAMAGE' | 'EFFECT' | 'RULE_CHECK',
): GameEvent<{ unitId: InstanceId; reason: 'COMBAT_DAMAGE' | 'EFFECT' | 'RULE_CHECK' }> {
  return {
    eventId: createEventId(state),
    type: 'UNIT_DESTROYED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'CARD',
      id: unitId,
    },
    payload: {
      unitId,
      reason,
    },
    visibility: 'PUBLIC',
  };
}

export function createEffectTriggeredEvent(
  state: GameState,
  trigger: PendingTrigger,
): GameEvent<{ trigger: PendingTrigger }> {
  return {
    eventId: createEventId(state),
    type: 'EFFECT_TRIGGERED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'EFFECT',
      id: trigger.effectId,
    },
    payload: {
      trigger,
    },
    visibility: 'PUBLIC',
  };
}

export function createEffectResolvedEvent(
  state: GameState,
  effect: PendingEffect,
  result: Record<string, unknown>,
): GameEvent<{ effectId: string; sourceId?: string; result: Record<string, unknown> }> {
  return {
    eventId: createEventId(state),
    type: 'EFFECT_RESOLVED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'EFFECT',
      id: effect.effectId,
    },
    payload: {
      effectId: effect.effectId,
      ...(effect.sourceId ? { sourceId: effect.sourceId } : {}),
      result,
    },
    visibility: 'PUBLIC',
  };
}

export function createEffectExpiredEvent(
  state: GameState,
  effectId: string,
  reason: 'START_OF_TURN' | 'END_OF_TURN' | 'LEAVES_BATTLEFIELD',
): GameEvent<{ effectId: string; reason: 'START_OF_TURN' | 'END_OF_TURN' | 'LEAVES_BATTLEFIELD' }> {
  return {
    eventId: createEventId(state),
    type: 'EFFECT_EXPIRED',
    turnNumber: state.turnNumber,
    phase: state.phase,
    source: {
      type: 'EFFECT',
      id: effectId,
    },
    payload: {
      effectId,
      reason,
    },
    visibility: 'PUBLIC',
  };
}
