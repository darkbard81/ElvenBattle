import type { GameState, PlayerId } from '../core';
import type { ActionType, GameAction, RuleError, RuleErrorCode, ValidationResult } from './types';

const PHASE_ACTIONS = {
  MAIN: ['SUMMON_UNIT', 'MOVE_UNIT', 'END_PHASE', 'SURRENDER'],
  COMBAT: ['ATTACK', 'END_PHASE', 'SURRENDER'],
  END: ['END_TURN', 'SURRENDER'],
} as const;

const IMPLEMENTED_ACTIONS = [
  'SUMMON_UNIT',
  'MOVE_UNIT',
  'ATTACK',
  'END_PHASE',
  'END_TURN',
  'SURRENDER',
] as const;

export function validationOk(): ValidationResult {
  return {
    ok: true,
    errors: [],
  };
}

export function validationError(
  code: RuleErrorCode,
  messageKey: string,
  detail?: Record<string, unknown>,
): ValidationResult {
  const error: RuleError =
    detail === undefined
      ? { code, messageKey }
      : {
          code,
          messageKey,
          detail,
        };

  return {
    ok: false,
    errors: [error],
  };
}

export function mergeValidationResults(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((result) => result.errors);

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateGameRunning(state: GameState): ValidationResult {
  if (state.gameStatus !== 'RUNNING' || state.phase === 'GAME_OVER') {
    return validationError('ERR_GAME_ALREADY_FINISHED', 'error.game_already_finished', {
      gameStatus: state.gameStatus,
      phase: state.phase,
    });
  }

  return validationOk();
}

export function validatePriorityPlayer(state: GameState, playerId: PlayerId): ValidationResult {
  if (state.priorityPlayerId !== playerId) {
    return validationError('ERR_NOT_PRIORITY_PLAYER', 'error.not_priority_player', {
      expectedPlayerId: state.priorityPlayerId,
      actualPlayerId: playerId,
    });
  }

  return validationOk();
}

export function validatePhaseAllowsAction(state: GameState, action: GameAction): ValidationResult {
  if (!isImplementedAction(action.type)) {
    return validationError('ERR_ACTION_NOT_IMPLEMENTED', 'error.action_not_implemented', {
      actionType: action.type,
    });
  }

  const allowedActions: readonly ActionType[] =
    PHASE_ACTIONS[state.phase as keyof typeof PHASE_ACTIONS] ?? [];

  if (!allowedActions.includes(action.type)) {
    return validationError('ERR_WRONG_PHASE', 'error.wrong_phase', {
      phase: state.phase,
      actionType: action.type,
    });
  }

  return validationOk();
}

function isImplementedAction(actionType: GameAction['type']): boolean {
  return IMPLEMENTED_ACTIONS.some((implementedAction) => implementedAction === actionType);
}
