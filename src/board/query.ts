import type { CardDefinition } from '../cards';
import type { InstanceId, PlayerId } from '../core';
import type { BoardSlot, BoardState, Column, Row, SlotId } from './types';

export function getBoardSlot(board: BoardState, slotId: string): BoardSlot | undefined {
  return board.slots[slotId as SlotId];
}

export function requireBoardSlot(board: BoardState, slotId: string): BoardSlot {
  const slot = getBoardSlot(board, slotId);

  if (!slot) {
    throw new Error(`Board slot not found: ${slotId}`);
  }

  return slot;
}

export function findUnitSlot(board: BoardState, unitId: InstanceId): BoardSlot | null {
  return Object.values(board.slots).find((slot) => slot.unit === unitId) ?? null;
}

export function isSlotEmpty(board: BoardState, slotId: string): boolean {
  return getBoardSlot(board, slotId)?.unit === null;
}

export function isOwnSideSlot(slot: BoardSlot, playerId: PlayerId): boolean {
  return slot.ownerSide === playerId;
}

export function isRowAllowed(definition: CardDefinition, row: Row): boolean {
  if (!definition.rowRestriction || definition.rowRestriction === 'ANY') {
    return true;
  }

  return definition.rowRestriction.includes(row);
}

export function getSameColumnSlots(
  board: BoardState,
  playerId: PlayerId,
  column: Column,
): BoardSlot[] {
  return Object.values(board.slots).filter(
    (slot) => slot.ownerSide === playerId && slot.column === column,
  );
}

export function getAdjacentColumnSlots(
  board: BoardState,
  playerId: PlayerId,
  column: Column,
): BoardSlot[] {
  return Object.values(board.slots).filter(
    (slot) => slot.ownerSide === playerId && Math.abs(slot.column - column) === 1,
  );
}
