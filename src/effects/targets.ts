import { createSlotId, findUnitSlot } from '../board';
import type { GameState, InstanceId, PlayerId } from '../core';
import type { ActionTarget } from '../rules';
import type { GameEvent } from '../events';

export type TargetSelector =
  | 'SELF'
  | 'EVENT_SOURCE'
  | 'EVENT_TARGET'
  | 'CONTROLLER'
  | 'ENEMY_PLAYER'
  | 'SAME_COLUMN_ENEMY_FRONT'
  | 'SAME_COLUMN_ENEMY_BACK'
  | 'DAMAGED_UNIT'
  | 'DESTROYED_UNIT';

export function resolveEffectTarget(
  state: GameState,
  selector: TargetSelector,
  sourceId: InstanceId | undefined,
  controllerId: PlayerId,
  event: GameEvent | undefined,
): ActionTarget | null {
  if (selector === 'SELF' && sourceId) {
    return { type: 'UNIT', unitId: sourceId };
  }

  if (selector === 'CONTROLLER') {
    return { type: 'PLAYER', playerId: controllerId };
  }

  if (selector === 'ENEMY_PLAYER') {
    const enemyId = Object.keys(state.players).find((playerId) => playerId !== controllerId);
    return enemyId ? { type: 'PLAYER', playerId: enemyId } : null;
  }

  if (selector === 'EVENT_SOURCE') {
    return eventSourceToTarget(event);
  }

  if (selector === 'EVENT_TARGET') {
    return eventPayloadTarget(event);
  }

  if (selector === 'DAMAGED_UNIT') {
    const target = eventPayloadTarget(event);
    return target?.type === 'UNIT' ? target : null;
  }

  if (selector === 'DESTROYED_UNIT') {
    const unitId = readPayloadString(event, 'unitId');
    return unitId ? { type: 'UNIT', unitId } : null;
  }

  if (selector === 'SAME_COLUMN_ENEMY_FRONT' || selector === 'SAME_COLUMN_ENEMY_BACK') {
    return sameColumnEnemyTarget(state, selector, sourceId, controllerId);
  }

  return null;
}

function eventSourceToTarget(event: GameEvent | undefined): ActionTarget | null {
  if (!event?.source?.id) {
    return null;
  }

  if (event.source.type === 'CARD') {
    return { type: 'UNIT', unitId: event.source.id };
  }

  if (event.source.type === 'PLAYER') {
    return { type: 'PLAYER', playerId: event.source.id };
  }

  return null;
}

function eventPayloadTarget(event: GameEvent | undefined): ActionTarget | null {
  const payload = event?.payload;

  if (!isRecord(payload)) {
    return null;
  }

  const target = payload.target;

  if (isActionTarget(target)) {
    return target;
  }

  return null;
}

function sameColumnEnemyTarget(
  state: GameState,
  selector: 'SAME_COLUMN_ENEMY_FRONT' | 'SAME_COLUMN_ENEMY_BACK',
  sourceId: InstanceId | undefined,
  controllerId: PlayerId,
): ActionTarget | null {
  if (!sourceId) {
    return null;
  }

  const sourceSlot = findUnitSlot(state.board, sourceId);
  const enemyId = Object.keys(state.players).find((playerId) => playerId !== controllerId);

  if (!sourceSlot || !enemyId) {
    return null;
  }

  const row = selector === 'SAME_COLUMN_ENEMY_FRONT' ? 'FRONT' : 'BACK';
  const slot = state.board.slots[createSlotId(enemyId, row, sourceSlot.column)];

  return slot?.unit ? { type: 'UNIT', unitId: slot.unit } : null;
}

function readPayloadString(event: GameEvent | undefined, key: string): string | null {
  const payload = event?.payload;

  if (!isRecord(payload)) {
    return null;
  }

  const value = payload[key];

  return typeof value === 'string' ? value : null;
}

function isActionTarget(input: unknown): input is ActionTarget {
  if (!isRecord(input) || typeof input.type !== 'string') {
    return false;
  }

  if (input.type === 'UNIT') {
    return typeof input.unitId === 'string';
  }

  if (input.type === 'PLAYER') {
    return typeof input.playerId === 'string';
  }

  return false;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
