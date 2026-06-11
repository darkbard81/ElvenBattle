import { findUnitSlot, removeUnitFromBoard } from '../board';
import type { GameState, InstanceId } from '../core';
import { recalculateDominance } from '../dominance';
import { createUnitDestroyedEvent } from '../events';
import type { GameEvent } from '../events';
import { moveCard } from '../zones';
import { getUnitRemainingHealth } from './damage';

export type DestroyReason = 'COMBAT_DAMAGE' | 'EFFECT' | 'RULE_CHECK';

export interface DestroyUnitResult {
  state: GameState;
  events: GameEvent[];
  destroyedUnitId: InstanceId;
}

export interface DestroyUnitsResult {
  state: GameState;
  events: GameEvent[];
  destroyedUnitIds: InstanceId[];
}

export function isUnitDestroyed(state: GameState, unitId: InstanceId): boolean {
  const instance = state.zones.cardInstances[unitId];

  return (
    !!instance &&
    instance.currentZone.type === 'BATTLEFIELD' &&
    getUnitRemainingHealth(state, unitId) <= 0
  );
}

export function collectDestroyedUnits(state: GameState): InstanceId[] {
  return Object.values(state.board.slots)
    .map((slot) => slot.unit)
    .filter((unitId): unitId is InstanceId => !!unitId && isUnitDestroyed(state, unitId));
}

export function destroyUnit(
  state: GameState,
  unitId: InstanceId,
  reason: DestroyReason,
): DestroyUnitResult {
  const slot = findUnitSlot(state.board, unitId);
  const instance = state.zones.cardInstances[unitId];

  if (!slot || !instance) {
    return {
      state,
      events: [],
      destroyedUnitId: unitId,
    };
  }

  const destroyedEvent = createUnitDestroyedEvent(state, unitId, reason);
  const stateWithDestroyedEvent: GameState = {
    ...removeUnitFromBoard(state, slot.slotId),
    eventLog: [...state.eventLog, destroyedEvent],
  };
  const moveResult = moveCard(
    stateWithDestroyedEvent,
    unitId,
    {
      type: 'GRAVEYARD',
      ownerId: instance.ownerId,
    },
    'DESTROY',
  );

  if (!moveResult.ok) {
    return {
      state: stateWithDestroyedEvent,
      events: [destroyedEvent],
      destroyedUnitId: unitId,
    };
  }

  const dominanceResult = recalculateDominance(
    moveResult.state,
    moveResult.state.cardDefinitions ?? {},
    instance.controllerId,
    'DESTROY',
  );

  return {
    state: dominanceResult.state,
    events: dominanceResult.state.eventLog.slice(state.eventLog.length),
    destroyedUnitId: unitId,
  };
}

export function destroyUnits(
  state: GameState,
  unitIds: readonly InstanceId[],
  reason: DestroyReason,
): DestroyUnitsResult {
  let nextState = state;
  const destroyedUnitIds: InstanceId[] = [];

  for (const unitId of unitIds) {
    if (!nextState.zones.cardInstances[unitId]) {
      continue;
    }

    const result = destroyUnit(nextState, unitId, reason);
    nextState = result.state;
    destroyedUnitIds.push(unitId);
  }

  return {
    state: nextState,
    events: nextState.eventLog.slice(state.eventLog.length),
    destroyedUnitIds,
  };
}
