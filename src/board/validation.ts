import type { CardDefinition } from '../cards';
import type { PlayerId } from '../core';
import { mergeValidationResults, validationError, validationOk } from '../rules';
import type { ValidationResult } from '../rules';
import { getBoardSlot, isOwnSideSlot, isRowAllowed } from './query';
import type { BoardState, SlotId } from './types';

export function validateSlotExists(board: BoardState, slotId: string): ValidationResult {
  if (!getBoardSlot(board, slotId)) {
    return validationError('ERR_SLOT_NOT_FOUND', 'error.slot_not_found', { slotId });
  }

  return validationOk();
}

export function validateOwnSideSlot(
  board: BoardState,
  slotId: string,
  playerId: PlayerId,
): ValidationResult {
  const slot = getBoardSlot(board, slotId);

  if (!slot) {
    return validateSlotExists(board, slotId);
  }

  if (!isOwnSideSlot(slot, playerId)) {
    return validationError('ERR_NOT_OWN_SLOT', 'error.not_own_slot', {
      slotId,
      playerId,
      ownerSide: slot.ownerSide,
    });
  }

  return validationOk();
}

export function validateEmptySlot(board: BoardState, slotId: string): ValidationResult {
  const slot = getBoardSlot(board, slotId);

  if (!slot) {
    return validateSlotExists(board, slotId);
  }

  if (slot.unit !== null) {
    return validationError('ERR_SLOT_OCCUPIED', 'error.slot_occupied', {
      slotId,
      unitId: slot.unit,
    });
  }

  return validationOk();
}

export function validateRowRestriction(
  board: BoardState,
  slotId: string,
  definition: CardDefinition,
): ValidationResult {
  const slot = getBoardSlot(board, slotId);

  if (!slot) {
    return validateSlotExists(board, slotId);
  }

  if (!isRowAllowed(definition, slot.row)) {
    return validationError('ERR_ROW_RESTRICTED', 'error.row_restricted', {
      slotId,
      row: slot.row,
      cardId: definition.cardId,
      rowRestriction: definition.rowRestriction,
    });
  }

  return validationOk();
}

export function validatePlacementSlot(
  board: BoardState,
  slotId: SlotId,
  playerId: PlayerId,
  definition: CardDefinition,
): ValidationResult {
  return mergeValidationResults(
    validateSlotExists(board, slotId),
    validateOwnSideSlot(board, slotId, playerId),
    validateEmptySlot(board, slotId),
    validateRowRestriction(board, slotId, definition),
  );
}
