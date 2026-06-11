import type { GameState, PlayerId } from '../core';
import { stableStringify } from '../replay';
import { evaluateState } from './evaluate';
import { legalActions } from './legal-actions';
import { simulateAction } from './simulate';
import type { AiActionCandidate, AiChooseOptions, AiDecision, AiScoredAction } from './types';

export function chooseAction(
  state: GameState,
  playerId: PlayerId,
  options: AiChooseOptions = {},
): AiDecision {
  return chooseGreedyAction(state, playerId, options);
}

export function chooseGreedyAction(
  state: GameState,
  playerId: PlayerId,
  options: AiChooseOptions = {},
): AiDecision {
  const candidates = legalActions(state, playerId, options);
  const scoredCandidates = candidates
    .map((candidate) => scoreCandidate(state, candidate, playerId, options))
    .filter((candidate) => candidate.simulation.ok);
  const sorted = sortCandidatesByScore(scoredCandidates);
  const selected = sorted[0] ?? null;

  return {
    playerId,
    action: selected?.action ?? null,
    candidates,
    evaluation: evaluateState(state, playerId, options),
    scoredCandidates: sorted,
  };
}

export function sortCandidatesByScore<TCandidate extends AiActionCandidate>(
  candidates: readonly TCandidate[],
): TCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftScore = left.score ?? Number.NEGATIVE_INFINITY;
    const rightScore = right.score ?? Number.NEGATIVE_INFINITY;

    return (
      rightScore - leftScore ||
      left.action.type.localeCompare(right.action.type) ||
      left.action.actionId.localeCompare(right.action.actionId) ||
      stableStringify(left.action.payload).localeCompare(stableStringify(right.action.payload))
    );
  });
}

function scoreCandidate(
  state: GameState,
  candidate: AiActionCandidate,
  playerId: PlayerId,
  options: AiChooseOptions,
): AiScoredAction {
  const simulation = simulateAction(state, candidate.action, options);
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
    ...candidate,
    score: evaluation.score,
    evaluation,
    simulation,
  };
}
