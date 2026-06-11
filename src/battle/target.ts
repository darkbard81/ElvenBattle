import { createSlotId, findUnitSlot } from '../board';
import type { BoardSlot, BoardState, Column } from '../board';
import type { GameState, InstanceId, PlayerId } from '../core';
import type { ActionTarget } from '../rules';

export type AttackTargetResolution =
  | {
      type: 'UNIT';
      attackerSlot: BoardSlot;
      defenderId: PlayerId;
      targetSlot: BoardSlot;
      target: Extract<ActionTarget, { type: 'UNIT' }>;
    }
  | {
      type: 'PLAYER';
      attackerSlot: BoardSlot;
      defenderId: PlayerId;
      target: Extract<ActionTarget, { type: 'PLAYER' }>;
    };

export function getAttackLane(board: BoardState, attackerId: InstanceId): BoardSlot | null {
  return findUnitSlot(board, attackerId);
}

export function getDefendingFrontSlot(
  board: BoardState,
  defenderId: PlayerId,
  column: Column,
): BoardSlot | undefined {
  return board.slots[createSlotId(defenderId, 'FRONT', column)];
}

export function getDefendingBackSlot(
  board: BoardState,
  defenderId: PlayerId,
  column: Column,
): BoardSlot | undefined {
  return board.slots[createSlotId(defenderId, 'BACK', column)];
}

export function findAttackTargetSlot(board: BoardState, target: ActionTarget): BoardSlot | null {
  if (target.type !== 'UNIT') {
    return null;
  }

  return findUnitSlot(board, target.unitId);
}

export function isBackRowProtected(
  board: BoardState,
  defenderId: PlayerId,
  column: Column,
): boolean {
  return getDefendingFrontSlot(board, defenderId, column)?.unit !== null;
}

export function canAttackPlayerDirectly(
  board: BoardState,
  defenderId: PlayerId,
  column: Column,
): boolean {
  return (
    getDefendingFrontSlot(board, defenderId, column)?.unit === null &&
    getDefendingBackSlot(board, defenderId, column)?.unit === null
  );
}

export function resolveAttackTarget(
  state: GameState,
  attackerId: InstanceId,
  target: ActionTarget,
): AttackTargetResolution | null {
  const attackerSlot = getAttackLane(state.board, attackerId);

  if (!attackerSlot) {
    return null;
  }

  if (target.type === 'UNIT') {
    const targetSlot = findAttackTargetSlot(state.board, target);
    const targetInstance = state.zones.cardInstances[target.unitId];

    if (!targetSlot || !targetInstance) {
      return null;
    }

    return {
      type: 'UNIT',
      attackerSlot,
      defenderId: targetInstance.controllerId,
      targetSlot,
      target,
    };
  }

  return {
    type: 'PLAYER',
    attackerSlot,
    defenderId: target.playerId,
    target,
  };
}
