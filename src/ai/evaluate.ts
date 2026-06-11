import { getUnitAttack, getUnitRemainingHealth } from '../battle';
import type { GameState, PlayerId } from '../core';
import { createAiView } from './visibility';
import type { AiEvaluation, AiEvaluationOptions, AiEvaluationWeights } from './types';

export const DEFAULT_AI_EVALUATION_WEIGHTS: AiEvaluationWeights = {
  win: 100000,
  loss: -100000,
  hpDelta: 10,
  unitCountDelta: 80,
  frontUnit: 25,
  backUnit: 15,
  attackDelta: 20,
  healthDelta: 15,
  handDelta: 8,
  resourceAvailable: 3,
  dominanceBoardValueDelta: 12,
  dominanceAvailable: 5,
};

export function evaluateState(
  state: GameState,
  playerId: PlayerId,
  options: AiEvaluationOptions = {},
): AiEvaluation {
  const view = createAiView(state, playerId, options);
  const visibleState = view.state;
  const player = visibleState.players[playerId];
  const opponents = Object.values(visibleState.players).filter((candidate) => {
    return candidate.playerId !== playerId;
  });
  const opponent = opponents[0];
  const weights = {
    ...DEFAULT_AI_EVALUATION_WEIGHTS,
    ...options.weights,
  };

  if (!player) {
    return {
      playerId,
      score: weights.loss,
      breakdown: {
        missingPlayer: weights.loss,
      },
    };
  }

  const playerBoard = collectBoardMetrics(visibleState, playerId);
  const opponentBoard = opponent
    ? collectBoardMetrics(visibleState, opponent.playerId)
    : emptyBoardMetrics();
  const breakdown: Record<string, number> = {
    win: visibleState.winner === playerId ? weights.win : 0,
    loss:
      visibleState.gameStatus === 'FINISHED' && visibleState.winner !== playerId ? weights.loss : 0,
    hpDelta: ((player.hp ?? 0) - (opponent?.hp ?? 0)) * weights.hpDelta,
    unitCountDelta: (playerBoard.units - opponentBoard.units) * weights.unitCountDelta,
    frontUnit: playerBoard.frontUnits * weights.frontUnit,
    backUnit: playerBoard.backUnits * weights.backUnit,
    attackDelta: (playerBoard.attack - opponentBoard.attack) * weights.attackDelta,
    healthDelta: (playerBoard.health - opponentBoard.health) * weights.healthDelta,
    handDelta: (player.hand.length - (opponent?.hand.length ?? 0)) * weights.handDelta,
    resourceAvailable: player.resource.current * weights.resourceAvailable,
    dominanceBoardValueDelta:
      (player.dominance.boardValue - (opponent?.dominance.boardValue ?? 0)) *
      weights.dominanceBoardValueDelta,
    dominanceAvailable:
      Math.max(
        0,
        player.dominance.limit + player.dominance.temporaryLimit - player.dominance.used,
      ) * weights.dominanceAvailable,
  };
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

  return {
    playerId,
    score,
    breakdown,
  };
}

function collectBoardMetrics(
  state: GameState,
  playerId: PlayerId,
): {
  units: number;
  frontUnits: number;
  backUnits: number;
  attack: number;
  health: number;
} {
  return Object.values(state.board.slots)
    .filter((slot) => slot.ownerSide === playerId && slot.unit !== null)
    .reduce((metrics, slot) => {
      const unitId = slot.unit;

      if (!unitId) {
        return metrics;
      }

      return {
        units: metrics.units + 1,
        frontUnits: metrics.frontUnits + (slot.row === 'FRONT' ? 1 : 0),
        backUnits: metrics.backUnits + (slot.row === 'BACK' ? 1 : 0),
        attack: metrics.attack + getUnitAttack(state, unitId),
        health: metrics.health + getUnitRemainingHealth(state, unitId),
      };
    }, emptyBoardMetrics());
}

function emptyBoardMetrics(): {
  units: number;
  frontUnits: number;
  backUnits: number;
  attack: number;
  health: number;
} {
  return {
    units: 0,
    frontUnits: 0,
    backUnits: 0,
    attack: 0,
    health: 0,
  };
}
