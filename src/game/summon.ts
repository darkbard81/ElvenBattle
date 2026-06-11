import { placeUnitOnBoard, validatePlacementSlot } from '../board';
import type { CardDefinition } from '../cards';
import type { GameState } from '../core';
import { canPayDominanceForSummon, recalculateDominance } from '../dominance';
import { createUnitSummonedEvent } from '../events';
import { createActionLogEntry } from '../replay';
import {
  mergeValidationResults,
  validationError,
  validationOk,
  type GameAction,
  type SummonUnitPayload,
  type ValidationResult,
} from '../rules';
import { moveCard } from '../zones';
import type { ApplyActionResult } from './result';

export function applySummonUnit(
  state: GameState,
  action: GameAction<SummonUnitPayload>,
): ApplyActionResult {
  const validation = validateSummonUnit(state, action);

  if (!validation.ok) {
    return {
      ok: false,
      state,
      validation,
    };
  }

  const definition = getDefinitionForAction(state, action.payload.instanceId);

  if (!definition) {
    return missingDefinitionResult(state, action.payload.instanceId);
  }

  const player = state.players[action.playerId];

  if (!player) {
    return {
      ok: false,
      state,
      validation: validationError('ERR_INVALID_TARGET', 'error.invalid_target', {
        playerId: action.playerId,
      }),
    };
  }

  const paidState: GameState = {
    ...state,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        resource: {
          ...player.resource,
          current: player.resource.current - definition.cost,
        },
      },
    },
  };
  const movedResult = moveCard(
    paidState,
    action.payload.instanceId,
    {
      type: 'BATTLEFIELD',
      ownerId: action.playerId,
      slotId: action.payload.slotId,
    },
    'SUMMON',
  );

  if (!movedResult.ok) {
    return {
      ok: false,
      state,
      validation: movedResult.validation,
    };
  }

  const movedInstance = movedResult.state.zones.cardInstances[action.payload.instanceId];

  if (!movedInstance) {
    return missingInstanceResult(state, action.payload.instanceId);
  }

  const instanceUpdatedState = {
    ...movedResult.state,
    zones: {
      ...movedResult.state.zones,
      cardInstances: {
        ...movedResult.state.zones.cardInstances,
        [action.payload.instanceId]: {
          ...movedInstance,
          summonedThisTurn: true,
          exhausted: false,
        },
      },
    },
  };
  const placedState = placeUnitOnBoard(
    instanceUpdatedState,
    action.payload.instanceId,
    action.payload.slotId,
  );
  const summonedEvent = createUnitSummonedEvent(
    placedState,
    action.playerId,
    action.payload.instanceId,
    action.payload.slotId,
  );
  const stateWithSummonedEvent: GameState = {
    ...placedState,
    eventLog: [...placedState.eventLog, summonedEvent],
  };
  const dominanceResult = recalculateDominance(
    stateWithSummonedEvent,
    stateWithSummonedEvent.cardDefinitions ?? {},
    action.playerId,
    'SUMMON',
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

function validateSummonUnit(
  state: GameState,
  action: GameAction<SummonUnitPayload>,
): ValidationResult {
  const instance = state.zones.cardInstances[action.payload.instanceId];

  if (!instance) {
    return validationError('ERR_CARD_INSTANCE_NOT_FOUND', 'error.card_instance_not_found', {
      instanceId: action.payload.instanceId,
    });
  }

  const definition = getDefinitionForAction(state, action.payload.instanceId);

  if (!definition) {
    return validationError('ERR_CARD_DEFINITION_NOT_FOUND', 'error.card_definition_not_found', {
      cardId: instance.definitionId,
    });
  }

  const player = state.players[action.playerId];

  if (!player) {
    return validationError('ERR_INVALID_TARGET', 'error.invalid_target', {
      playerId: action.playerId,
    });
  }

  const unitValidation =
    definition.type === 'UNIT'
      ? validationOk()
      : validationError('ERR_CARD_NOT_UNIT', 'error.card_not_unit', {
          cardId: definition.cardId,
          type: definition.type,
        });
  const handValidation =
    instance.currentZone.type === 'HAND' &&
    instance.currentZone.ownerId === action.playerId &&
    player.hand.includes(action.payload.instanceId)
      ? validationOk()
      : validationError('ERR_CARD_NOT_IN_ZONE', 'error.card_not_in_zone', {
          instanceId: action.payload.instanceId,
          expectedZone: 'HAND',
          actualZone: instance.currentZone,
        });
  const resourceValidation =
    player.resource.current >= definition.cost
      ? validationOk()
      : validationError('ERR_INSUFFICIENT_RESOURCE', 'error.insufficient_resource', {
          playerId: action.playerId,
          cost: definition.cost,
          current: player.resource.current,
        });

  return mergeValidationResults(
    unitValidation,
    handValidation,
    validatePlacementSlot(state.board, action.payload.slotId, action.playerId, definition),
    resourceValidation,
    canPayDominanceForSummon(state, action.playerId, definition, action.payload.slotId),
  );
}

function getDefinitionForAction(state: GameState, instanceId: string): CardDefinition | undefined {
  const instance = state.zones.cardInstances[instanceId];

  if (!instance) {
    return undefined;
  }

  return state.cardDefinitions?.[instance.definitionId];
}

function missingDefinitionResult(state: GameState, instanceId: string): ApplyActionResult {
  const instance = state.zones.cardInstances[instanceId];

  return {
    ok: false,
    state,
    validation: validationError(
      'ERR_CARD_DEFINITION_NOT_FOUND',
      'error.card_definition_not_found',
      {
        instanceId,
        cardId: instance?.definitionId,
      },
    ),
  };
}

function missingInstanceResult(state: GameState, instanceId: string): ApplyActionResult {
  return {
    ok: false,
    state,
    validation: validationError('ERR_CARD_INSTANCE_NOT_FOUND', 'error.card_instance_not_found', {
      instanceId,
    }),
  };
}
