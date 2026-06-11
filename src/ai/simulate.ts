import type { GameState, PlayerId } from '../core';
import { applyAction } from '../game';
import { hashGameState } from '../replay';
import type { GameAction } from '../rules';
import { evaluateState } from './evaluate';
import type { AiScoredAction, AiSimulationOptions, AiSimulationResult } from './types';

export function simulateAction(
  state: GameState,
  action: GameAction,
  options: AiSimulationOptions = {},
): AiSimulationResult {
  void options;

  const stateHashBefore = hashGameState(state);
  const result = applyAction(state, action);

  if (!result.ok) {
    return {
      ok: false,
      state,
      action,
      errors: result.validation.errors,
      stateHashBefore,
      stateHashAfter: hashGameState(state),
    };
  }

  return {
    ok: true,
    state: result.state,
    action,
    errors: [],
    stateHashBefore,
    stateHashAfter: hashGameState(result.state),
  };
}

export function scoreAction(
  state: GameState,
  action: GameAction,
  playerId: PlayerId,
  options: AiSimulationOptions = {},
): AiScoredAction {
  const simulation = simulateAction(state, action, options);
  const evaluation = simulation.ok
    ? evaluateState(simulation.state, playerId, options)
    : {
        playerId,
        score: Number.NEGATIVE_INFINITY,
        breakdown: {
          invalidAction: Number.NEGATIVE_INFINITY,
        },
      };

  return {
    action,
    source: 'RULES',
    score: evaluation.score,
    evaluation,
    simulation,
  };
}
