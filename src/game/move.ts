import { findUnitSlot, moveUnitOnBoard, validatePlacementSlot } from '../board';
import type { CardDefinition } from '../cards';
import type { GameState } from '../core';
import { recalculateDominance } from '../dominance';
import { createUnitMovedEvent } from '../events';
import { createActionLogEntry } from '../replay';
import {
  mergeValidationResults,
  validationError,
  validationOk,
  type GameAction,
  type MoveUnitPayload,
  type ValidationResult,
} from '../rules';
import type { ApplyActionResult } from './result';

export function applyMoveUnit(
  state: GameState,
  action: GameAction<MoveUnitPayload>,
): ApplyActionResult {
  const validation = validateMoveUnit(state, action);

  if (!validation.ok) {
    return {
      ok: false,
      state,
      validation,
    };
  }

  const fromSlot = findUnitSlot(state.board, action.payload.unitId);
  const instance = state.zones.cardInstances[action.payload.unitId];

  if (!fromSlot || !instance) {
    return {
      ok: false,
      state,
      validation: validationError('ERR_UNIT_NOT_ON_BOARD', 'error.unit_not_on_board', {
        unitId: action.payload.unitId,
      }),
    };
  }

  const movedBoardState = moveUnitOnBoard(
    state,
    action.payload.unitId,
    fromSlot.slotId,
    action.payload.toSlotId,
  );
  const instanceMovedState: GameState = {
    ...movedBoardState,
    zones: {
      ...movedBoardState.zones,
      cardInstances: {
        ...movedBoardState.zones.cardInstances,
        [action.payload.unitId]: {
          ...instance,
          currentZone: {
            ...instance.currentZone,
            type: 'BATTLEFIELD',
            ownerId: action.playerId,
            slotId: action.payload.toSlotId,
          },
        },
      },
    },
    turnState: {
      ...movedBoardState.turnState,
      movedUnitIds: [...movedBoardState.turnState.movedUnitIds, action.payload.unitId],
    },
  };
  const movedEvent = createUnitMovedEvent(
    instanceMovedState,
    action.playerId,
    action.payload.unitId,
    fromSlot.slotId,
    action.payload.toSlotId,
  );
  const stateWithEvent: GameState = {
    ...instanceMovedState,
    eventLog: [...instanceMovedState.eventLog, movedEvent],
  };
  const dominanceResult = recalculateDominance(
    stateWithEvent,
    stateWithEvent.cardDefinitions ?? {},
    action.playerId,
    'MOVE',
  );
  const actionLogEntry = createActionLogEntry(dominanceResult.state, action, true);
  const nextState: GameState = {
    ...dominanceResult.state,
    actionLog: [...dominanceResult.state.actionLog, actionLogEntry],
  };
  const events = nextState.eventLog.slice(state.eventLog.length);

  return {
    ok: true,
    state: nextState,
    events,
    actionLogEntry,
  };
}

function validateMoveUnit(state: GameState, action: GameAction<MoveUnitPayload>): ValidationResult {
  const fromSlot = findUnitSlot(state.board, action.payload.unitId);
  const instance = state.zones.cardInstances[action.payload.unitId];

  if (!fromSlot || !instance || instance.currentZone.type !== 'BATTLEFIELD') {
    return validationError('ERR_UNIT_NOT_ON_BOARD', 'error.unit_not_on_board', {
      unitId: action.payload.unitId,
    });
  }

  const definition = state.cardDefinitions?.[instance.definitionId];

  if (!definition) {
    return validationError('ERR_CARD_DEFINITION_NOT_FOUND', 'error.card_definition_not_found', {
      cardId: instance.definitionId,
    });
  }

  const controllerValidation =
    instance.controllerId === action.playerId && fromSlot.ownerSide === action.playerId
      ? validationOk()
      : validationError('ERR_NOT_OWN_SLOT', 'error.not_own_slot', {
          unitId: action.payload.unitId,
          playerId: action.playerId,
          controllerId: instance.controllerId,
          ownerSide: fromSlot.ownerSide,
        });
  const movedValidation = state.turnState.movedUnitIds.includes(action.payload.unitId)
    ? validationError('ERR_UNIT_ALREADY_MOVED', 'error.unit_already_moved', {
        unitId: action.payload.unitId,
      })
    : validationOk();

  return mergeValidationResults(
    controllerValidation,
    validatePlacementSlot(state.board, action.payload.toSlotId, action.playerId, definition),
    movedValidation,
  );
}

export function getMoveUnitDefinition(
  state: GameState,
  unitId: string,
): CardDefinition | undefined {
  const instance = state.zones.cardInstances[unitId];

  return instance ? state.cardDefinitions?.[instance.definitionId] : undefined;
}
