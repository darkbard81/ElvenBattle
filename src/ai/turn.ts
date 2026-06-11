import type { GameState, PlayerId } from '../core';
import { applyAction, advanceToFirstPlayablePhase } from '../game';
import type { GameAction } from '../rules';
import { chooseAction } from './choose';
import type { AiGameSimulationResult, AiStepResult, AiTurnOptions, AiTurnResult } from './types';

const DEFAULT_MAX_ACTIONS_PER_TURN = 20;

export function playAiStep(
  state: GameState,
  playerId: PlayerId,
  options: AiTurnOptions = {},
): AiStepResult {
  const playableState = advanceToFirstPlayablePhase(state);
  const decision = chooseAction(playableState, playerId, options);

  if (!decision.action) {
    return {
      ok: false,
      state: playableState,
      decision,
      action: null,
      errors: ['AI_NO_ACTION_AVAILABLE'],
    };
  }

  const result = applyAction(playableState, decision.action);

  if (!result.ok) {
    return {
      ok: false,
      state: playableState,
      decision,
      action: decision.action,
      errors: result.validation.errors.map((error) => error.code),
    };
  }

  return {
    ok: true,
    state: result.state,
    decision,
    action: decision.action,
    errors: [],
  };
}

export function playAiTurn(
  state: GameState,
  playerId: PlayerId,
  options: AiTurnOptions = {},
): AiTurnResult {
  const maxActions = options.maxActionsPerTurn ?? DEFAULT_MAX_ACTIONS_PER_TURN;
  const actions: GameAction[] = [];
  const decisions = [];
  const errors: string[] = [];
  let nextState = advanceToFirstPlayablePhase(state);

  for (let step = 0; step < maxActions; step += 1) {
    if (
      nextState.gameStatus !== 'RUNNING' ||
      nextState.phase === 'GAME_OVER' ||
      nextState.priorityPlayerId !== playerId
    ) {
      return {
        ok: errors.length === 0,
        finalState: nextState,
        actions,
        decisions,
        errors,
      };
    }

    const result = playAiStep(nextState, playerId, options);
    decisions.push(result.decision);

    if (!result.ok) {
      errors.push(...result.errors);

      return {
        ok: false,
        finalState: result.state,
        actions,
        decisions,
        errors,
      };
    }

    if (result.action) {
      actions.push(result.action);
    }

    if (
      result.state.gameStatus !== 'RUNNING' ||
      result.state.phase === 'GAME_OVER' ||
      result.state.priorityPlayerId !== playerId
    ) {
      nextState = result.state;
    } else {
      nextState = advanceToFirstPlayablePhase(result.state);
    }
  }

  return {
    ok: false,
    finalState: nextState,
    actions,
    decisions,
    errors: [...errors, 'AI_TURN_ACTION_LIMIT_REACHED'],
  };
}

export function advanceAiControlledGame(
  state: GameState,
  options: AiTurnOptions = {},
): AiGameSimulationResult {
  const activePlayerId = advanceToFirstPlayablePhase(state).priorityPlayerId;

  if (!activePlayerId) {
    return {
      ok: state.gameStatus !== 'RUNNING',
      finalState: state,
      actions: [],
      winner: state.winner,
      turnCount: state.turnNumber,
      actionCount: 0,
      errors: ['AI_NO_PRIORITY_PLAYER'],
    };
  }

  const result = playAiTurn(state, activePlayerId, options);

  return {
    ok: result.ok,
    finalState: result.finalState,
    actions: result.actions,
    winner: result.finalState.winner,
    turnCount: result.finalState.turnNumber,
    actionCount: result.actions.length,
    errors: result.errors,
  };
}
