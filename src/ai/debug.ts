import type { GameState, PlayerId } from '../core';
import type { GameAction } from '../rules';
import { chooseAction } from './choose';
import { evaluateState } from './evaluate';
import { scoreAction } from './simulate';
import type { AiChooseOptions, AiDecision, AiEvaluation, AiScoredAction } from './types';

export function explainEvaluation(
  state: GameState,
  playerId: PlayerId,
  options: AiChooseOptions = {},
): AiEvaluation {
  return evaluateState(state, playerId, options);
}

export function explainCandidate(
  state: GameState,
  action: GameAction,
  playerId: PlayerId,
  options: AiChooseOptions = {},
): AiScoredAction {
  return scoreAction(state, action, playerId, options);
}

export function formatAiDebugSummary(decision: AiDecision): string {
  const selected = decision.action
    ? `${decision.action.type}:${decision.action.actionId}`
    : 'NO_ACTION';

  return [
    `player=${decision.playerId}`,
    `selected=${selected}`,
    `evaluation=${decision.evaluation.score}`,
    `candidates=${decision.scoredCandidates
      .map((candidate) => `${candidate.action.type}:${candidate.score}`)
      .join(',')}`,
  ].join(' ');
}

export function chooseActionWithDebug(
  state: GameState,
  playerId: PlayerId,
  options: AiChooseOptions = {},
): { decision: AiDecision; summary: string } {
  const decision = chooseAction(state, playerId, options);

  return {
    decision,
    summary: formatAiDebugSummary(decision),
  };
}
