import type { InstanceId, PlayerId } from '../core';

export type Row = 'FRONT' | 'BACK';
export type Column = 0 | 1 | 2;
export type SlotId = `${PlayerId}:${Row}:${Column}`;

export interface BoardSlot {
  slotId: SlotId;
  ownerSide: PlayerId;
  row: Row;
  column: Column;
  unit: InstanceId | null;
}

export interface BoardState {
  columns: 3;
  rows: Row[];
  slots: Record<SlotId, BoardSlot>;
}

export const BOARD_ROWS: readonly Row[] = ['FRONT', 'BACK'];
export const BOARD_COLUMNS: readonly Column[] = [0, 1, 2];

export function createSlotId(playerId: PlayerId, row: Row, column: Column): SlotId {
  return `${playerId}:${row}:${column}`;
}

export function createEmptyBoard(playerIds: readonly PlayerId[]): BoardState {
  const slots = {} as Record<SlotId, BoardSlot>;

  for (const playerId of playerIds) {
    for (const row of BOARD_ROWS) {
      for (const column of BOARD_COLUMNS) {
        const slotId = createSlotId(playerId, row, column);
        slots[slotId] = {
          slotId,
          ownerSide: playerId,
          row,
          column,
          unit: null,
        };
      }
    }
  }

  return {
    columns: 3,
    rows: [...BOARD_ROWS],
    slots,
  };
}
