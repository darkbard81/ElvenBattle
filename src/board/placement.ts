import type { GameState, InstanceId } from '../core';
import type { SlotId } from './types';

export function placeUnitOnBoard(state: GameState, unitId: InstanceId, slotId: SlotId): GameState {
  const slot = state.board.slots[slotId];

  if (!slot) {
    return state;
  }

  return {
    ...state,
    board: {
      ...state.board,
      slots: {
        ...state.board.slots,
        [slotId]: {
          ...slot,
          unit: unitId,
        },
      },
    },
  };
}

export function removeUnitFromBoard(state: GameState, slotId: SlotId): GameState {
  const slot = state.board.slots[slotId];

  if (!slot) {
    return state;
  }

  return {
    ...state,
    board: {
      ...state.board,
      slots: {
        ...state.board.slots,
        [slotId]: {
          ...slot,
          unit: null,
        },
      },
    },
  };
}

export function moveUnitOnBoard(
  state: GameState,
  unitId: InstanceId,
  fromSlotId: SlotId,
  toSlotId: SlotId,
): GameState {
  return placeUnitOnBoard(removeUnitFromBoard(state, fromSlotId), unitId, toSlotId);
}
