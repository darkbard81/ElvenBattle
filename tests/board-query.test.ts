import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  createSlotId,
  findUnitSlot,
  getAdjacentColumnSlots,
  getBoardSlot,
  getSameColumnSlots,
  isSlotEmpty,
  validateSlotExists,
} from '../src/board';

describe('board query', () => {
  it('finds slots by id and distinguishes empty slots', () => {
    const board = createEmptyBoard(['P1', 'P2']);
    const slotId = createSlotId('P1', 'FRONT', 1);

    expect(getBoardSlot(board, slotId)?.slotId).toBe(slotId);
    expect(isSlotEmpty(board, slotId)).toBe(true);
    expect(validateSlotExists(board, slotId).ok).toBe(true);
  });

  it('returns validation failure for a missing slot', () => {
    const board = createEmptyBoard(['P1']);
    const result = validateSlotExists(board, 'P1:FRONT:9');

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('ERR_SLOT_NOT_FOUND');
  });

  it('finds unit position and column-related slots', () => {
    const board = createEmptyBoard(['P1']);
    const slotId = createSlotId('P1', 'FRONT', 1);
    const occupiedBoard = {
      ...board,
      slots: {
        ...board.slots,
        [slotId]: {
          ...board.slots[slotId]!,
          unit: 'unit-1',
        },
      },
    };

    expect(findUnitSlot(occupiedBoard, 'unit-1')?.slotId).toBe(slotId);
    expect(getSameColumnSlots(occupiedBoard, 'P1', 1)).toHaveLength(2);
    expect(getAdjacentColumnSlots(occupiedBoard, 'P1', 1)).toHaveLength(4);
  });
});
