import type { GameState } from '../core';
import { enqueueEvents, flushEventQueue } from '../effects';
import { createPhaseChangedEvent } from '../events';
import { completeActionLogEntryHash, createActionLogEntry } from '../replay/log';
import type { GameAction } from '../rules';
import type { AttackPayload, MoveUnitPayload, SummonUnitPayload } from '../rules';
import {
  mergeValidationResults,
  validateGameRunning,
  validatePhaseAllowsAction,
  validatePriorityPlayer,
} from '../rules';
import { applyAttack } from '../battle';
import { finalizeIfWinConditionMet, surrenderGame } from './end';
import { getNextPhase } from './phase';
import type { ApplyActionResult } from './result';
import { applyMoveUnit } from './move';
import { applySummonUnit } from './summon';
import { endTurn } from './turn';

export function applyAction(state: GameState, action: GameAction): ApplyActionResult {
  const validation = mergeValidationResults(
    validateGameRunning(state),
    validatePriorityPlayer(state, action.playerId),
    validatePhaseAllowsAction(state, action),
  );

  if (!validation.ok) {
    return {
      ok: false,
      state,
      validation,
    };
  }

  if (action.type === 'SUMMON_UNIT') {
    return withTriggeredEffects(
      state,
      applySummonUnit(state, action as GameAction<SummonUnitPayload>),
    );
  }

  if (action.type === 'MOVE_UNIT') {
    return withTriggeredEffects(state, applyMoveUnit(state, action as GameAction<MoveUnitPayload>));
  }

  if (action.type === 'ATTACK') {
    return withTriggeredEffects(state, applyAttack(state, action as GameAction<AttackPayload>));
  }

  if (action.type === 'END_PHASE') {
    return withTriggeredEffects(state, applyEndPhase(state, action));
  }

  if (action.type === 'END_TURN') {
    return withTriggeredEffects(state, applyEndTurn(state, action));
  }

  if (action.type === 'SURRENDER') {
    return applySurrender(state, action);
  }

  return {
    ok: false,
    state,
    validation: {
      ok: false,
      errors: [
        {
          code: 'ERR_ACTION_NOT_IMPLEMENTED',
          messageKey: 'error.action_not_implemented',
          detail: { actionType: action.type },
        },
      ],
    },
  };
}

function withTriggeredEffects(
  previousState: GameState,
  result: ApplyActionResult,
): ApplyActionResult {
  if (!result.ok) {
    return result;
  }

  const effectResult = flushEventQueue(enqueueEvents(result.state, result.events));
  const stateAfterWinCheck = finalizeIfWinConditionMet(effectResult.state);
  const completed = completeActionLogEntryHash(
    stateAfterWinCheck,
    result.actionLogEntry.index,
    previousState,
  );
  const events = completed.state.eventLog.slice(previousState.eventLog.length);

  return {
    ok: true,
    state: completed.state,
    events,
    actionLogEntry: completed.actionLogEntry,
  };
}

function applyEndPhase(state: GameState, action: GameAction): ApplyActionResult {
  const nextPhase = getNextPhase(state.phase);

  if (nextPhase !== 'COMBAT' && nextPhase !== 'END') {
    return {
      ok: false,
      state,
      validation: {
        ok: false,
        errors: [
          {
            code: 'ERR_WRONG_PHASE',
            messageKey: 'error.wrong_phase',
            detail: { phase: state.phase, actionType: action.type },
          },
        ],
      },
    };
  }

  const event = createPhaseChangedEvent(state, state.phase, nextPhase);
  const actionLogEntry = createActionLogEntry(state, action, true);
  const nextState: GameState = {
    ...state,
    phase: nextPhase,
    priorityPlayerId: state.activePlayerId,
    eventLog: [...state.eventLog, event],
    actionLog: [...state.actionLog, actionLogEntry],
  };

  return {
    ok: true,
    state: nextState,
    events: [event],
    actionLogEntry,
  };
}

function applyEndTurn(state: GameState, action: GameAction): ApplyActionResult {
  const actionLogEntry = createActionLogEntry(state, action, true);
  const stateWithActionLog: GameState = {
    ...state,
    actionLog: [...state.actionLog, actionLogEntry],
  };
  const nextState = endTurn(stateWithActionLog);
  const events = nextState.eventLog.slice(state.eventLog.length);

  return {
    ok: true,
    state: nextState,
    events,
    actionLogEntry,
  };
}

function applySurrender(state: GameState, action: GameAction): ApplyActionResult {
  const actionLogEntry = createActionLogEntry(state, action, true);
  const stateWithActionLog: GameState = {
    ...state,
    actionLog: [...state.actionLog, actionLogEntry],
  };
  const nextState = surrenderGame(stateWithActionLog, action.playerId);
  const completed = completeActionLogEntryHash(nextState, actionLogEntry.index, state);

  return {
    ok: true,
    state: completed.state,
    events: completed.state.eventLog.slice(state.eventLog.length),
    actionLogEntry: completed.actionLogEntry,
  };
}
