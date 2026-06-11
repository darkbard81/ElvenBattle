import type { CardDefinition } from '../cards';
import type { GameState, PlayerId } from '../core';
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

    used += definition.dominanceCost ?? 0;
    boardValue += definition.dominanceValue ?? 0;
  }

  return {
    ...player.dominance,
    used,
    boardValue,
    overloaded: used > player.dominance.limit + player.dominance.temporaryLimit,
  };
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
