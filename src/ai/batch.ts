import type { GameState, PlayerId } from '../core';
import { advanceToFirstPlayablePhase } from '../game';
import { createReplayFile } from '../replay';
import { playAiTurn } from './turn';
import type {
  AiBatchSimulationOptions,
  AiBatchSimulationResult,
  AiGameSimulationOptions,
  AiGameSimulationResult,
  AiSimulationSummary,
} from './types';

const DEFAULT_MAX_TURNS = 50;
const DEFAULT_MAX_ACTIONS = 500;

export function simulateGame(
  initialState: GameState,
  options: AiGameSimulationOptions = {},
): AiGameSimulationResult {
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxActions = options.maxActions ?? DEFAULT_MAX_ACTIONS;
  const actions = [];
  const errors = [];
  let nextState = advanceToFirstPlayablePhase(initialState);

  while (
    nextState.gameStatus === 'RUNNING' &&
    nextState.phase !== 'GAME_OVER' &&
    nextState.turnNumber <= maxTurns &&
    actions.length < maxActions
  ) {
    const playerId = nextState.priorityPlayerId;

    if (!playerId) {
      errors.push('AI_NO_PRIORITY_PLAYER');
      break;
    }

    const turnResult = playAiTurn(nextState, playerId, options);
    actions.push(...turnResult.actions);
    nextState = advanceToFirstPlayablePhase(turnResult.finalState);

    if (!turnResult.ok) {
      errors.push(...turnResult.errors);
      break;
    }
  }

  if (nextState.gameStatus === 'RUNNING' && nextState.turnNumber > maxTurns) {
    errors.push('AI_SIMULATION_TURN_LIMIT_REACHED');
  }

  if (nextState.gameStatus === 'RUNNING' && actions.length >= maxActions) {
    errors.push('AI_SIMULATION_ACTION_LIMIT_REACHED');
  }

  const baseResult = {
    ok: errors.length === 0 && nextState.gameStatus !== 'ABORTED',
    finalState: nextState,
    actions,
    winner: nextState.winner,
    turnCount: nextState.turnNumber,
    actionCount: actions.length,
    errors,
  };

  if (!options.createReplayFile) {
    return baseResult;
  }

  return {
    ...baseResult,
    replayFile: createReplayFile(initialState, nextState),
  };
}

export function runSimulationBatch(
  initialStates: readonly GameState[],
  options: AiBatchSimulationOptions = {},
): AiBatchSimulationResult {
  const maxGames = options.maxGames ?? initialStates.length;
  const results = initialStates.slice(0, maxGames).map((state) => simulateGame(state, options));

  return {
    results,
    summary: summarizeSimulationResults(results),
  };
}

export function summarizeSimulationResults(
  results: readonly AiGameSimulationResult[],
): AiSimulationSummary {
  const winsByPlayer: Record<PlayerId, number> = {};
  let completedGames = 0;
  let draws = 0;
  let totalTurns = 0;
  let totalActions = 0;

  for (const result of results) {
    if (result.finalState.gameStatus === 'FINISHED') {
      completedGames += 1;
    }

    if (result.winner) {
      winsByPlayer[result.winner] = (winsByPlayer[result.winner] ?? 0) + 1;
    } else {
      draws += 1;
    }

    totalTurns += result.turnCount;
    totalActions += result.actionCount;
  }

  return {
    games: results.length,
    completedGames,
    winsByPlayer,
    draws,
    averageTurns: results.length === 0 ? 0 : totalTurns / results.length,
    averageActions: results.length === 0 ? 0 : totalActions / results.length,
  };
}
