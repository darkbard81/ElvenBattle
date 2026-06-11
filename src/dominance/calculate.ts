import type { CardDefinition } from '../cards';
import type { GameState, PlayerId } from '../core';
import type { BoardSlot, SlotId } from '../board';
import { createDominanceChangedEvent, type DominanceChangeReason } from '../events';
import type { GameEvent } from '../events';
import type { DominanceState } from './types';

export interface RecalculateDominanceResult {
  state: GameState;
  event: GameEvent | null;
}

export function calculateDominanceForPlayer(
  state: GameState,
  definitions: Record<string, CardDefinition>,
  playerId: PlayerId,
): DominanceState {
  const player = state.players[playerId];

  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  let used = 0;
  let boardValue = 0;
  let overloaded = false;

  for (const slot of Object.values(state.board.slots)) {
    if (slot.ownerSide !== playerId || !slot.unit) {
      continue;
    }

    const instance = state.zones.cardInstances[slot.unit];

    if (!instance || instance.controllerId !== playerId) {
      continue;
    }

    const definition = definitions[instance.definitionId];

    if (!definition) {
      continue;
    }

    used += definition.cost;
    boardValue += definition.dominanceValue ?? 0;

    if (definition.cost > calculateSlotDominance(state, definitions, playerId, slot.slotId)) {
      overloaded = true;
    }
  }

  return {
    ...player.dominance,
    used,
    boardValue,
    overloaded,
  };
}

export function calculateSlotDominance(
  state: GameState,
  definitions: Record<string, CardDefinition>,
  playerId: PlayerId,
  slotId: SlotId,
): number {
  const targetSlot = state.board.slots[slotId];

  if (!targetSlot || targetSlot.ownerSide !== playerId) {
    return 0;
  }

  let value = state.dominanceConfig.baseSlotValue;

  for (const sourceSlot of Object.values(state.board.slots)) {
    if (
      sourceSlot.ownerSide !== playerId ||
      sourceSlot.slotId === slotId ||
      !sourceSlot.unit ||
      !isSurroundingSlot(sourceSlot, targetSlot)
    ) {
      continue;
    }

    const instance = state.zones.cardInstances[sourceSlot.unit];

    if (!instance || instance.controllerId !== playerId) {
      continue;
    }

    value += definitions[instance.definitionId]?.dominanceValue ?? 0;
  }

  return value;
}

function isSurroundingSlot(source: BoardSlot, target: BoardSlot): boolean {
  const sourceRowIndex = getRowIndex(source);
  const targetRowIndex = getRowIndex(target);
  const rowDistance = Math.abs(sourceRowIndex - targetRowIndex);
  const columnDistance = Math.abs(source.column - target.column);

  return rowDistance <= 1 && columnDistance <= 1 && rowDistance + columnDistance > 0;
}

function getRowIndex(slot: BoardSlot): number {
  return slot.row === 'FRONT' ? 0 : 1;
}

export function recalculateDominance(
  state: GameState,
  definitions: Record<string, CardDefinition>,
  playerId: PlayerId,
  reason: DominanceChangeReason,
): RecalculateDominanceResult {
  const player = state.players[playerId];

  if (!player) {
    return {
      state,
      event: null,
    };
  }

  const before = player.dominance;
  const after = calculateDominanceForPlayer(state, definitions, playerId);
  const nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        dominance: after,
      },
    },
  };

  if (isSameDominance(before, after)) {
    return {
      state: nextState,
      event: null,
    };
  }

  const event = createDominanceChangedEvent(nextState, playerId, before, after, reason);

  return {
    state: {
      ...nextState,
      eventLog: [...nextState.eventLog, event],
    },
    event,
  };
}

function isSameDominance(before: DominanceState, after: DominanceState): boolean {
  return (
    before.limit === after.limit &&
    before.temporaryLimit === after.temporaryLimit &&
    before.used === after.used &&
    before.boardValue === after.boardValue &&
    before.overloaded === after.overloaded
  );
}
