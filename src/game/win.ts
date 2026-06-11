import type { GameState, InstanceId, PlayerId } from '../core';
import type { GameEndResult, WinCondition } from './types';

export const DECK_OUT_PENDING_FLAG = 'deckOutPending';

const DEFAULT_WIN_CONDITION_PRIORITY: WinCondition['type'][] = [
  'INVALID_STATE_ABORT',
  'SURRENDER',
  'OPPONENT_HP_ZERO',
  'BOSS_DEFEATED',
  'DECK_OUT_LOSS',
  'TURN_LIMIT',
  'PUZZLE_OBJECTIVE',
  'DOMINANCE_OBJECTIVE',
];

export function getPlayerIds(state: GameState): PlayerId[] {
  return Object.keys(state.players).sort();
}

export function getOpponentPlayerId(state: GameState, playerId: PlayerId): PlayerId | null {
  return getPlayerIds(state).find((candidateId) => candidateId !== playerId) ?? null;
}

export function getLivingPlayerIds(state: GameState): PlayerId[] {
  return getPlayerIds(state).filter((playerId) => {
    const player = state.players[playerId];

    return !!player && player.hp > 0;
  });
}

export function getDefeatedPlayerIdsByHp(state: GameState): PlayerId[] {
  return getPlayerIds(state).filter((playerId) => {
    const player = state.players[playerId];

    return !!player && player.hp <= 0;
  });
}

export function getDefaultWinConditions(): WinCondition[] {
  return [{ type: 'OPPONENT_HP_ZERO' }, { type: 'DECK_OUT_LOSS' }];
}

export function getScenarioWinConditions(state: GameState): WinCondition[] {
  const scenarioConditions = state.scenarioState?.winConditions ?? [];
  const bossConditions =
    state.scenarioState?.bossUnitIds?.map(
      (bossUnitId): WinCondition => ({
        type: 'BOSS_DEFEATED',
        bossUnitId,
        winnerId: state.activePlayerId,
      }),
    ) ?? [];

  return [...scenarioConditions, ...bossConditions];
}

export function getWinConditionPriority(state: GameState): WinCondition['type'][] {
  return state.scenarioState?.winConditionPriority ?? DEFAULT_WIN_CONDITION_PRIORITY;
}

export function checkWinConditions(state: GameState): GameEndResult | null {
  if (state.gameStatus === 'FINISHED' || state.gameStatus === 'ABORTED') {
    return null;
  }

  const conditions = [...getDefaultWinConditions(), ...getScenarioWinConditions(state)];
  const results = conditions
    .map((condition) => evaluateWinCondition(state, condition))
    .filter((result): result is GameEndResult => result !== null);

  if (results.length === 0) {
    return null;
  }

  return sortSatisfiedEndResults(state, results)[0] ?? null;
}

export function sortSatisfiedEndResults(
  state: GameState,
  results: readonly GameEndResult[],
): GameEndResult[] {
  const priority = getWinConditionPriority(state);

  return [...results].sort((left, right) => {
    const leftPriority = getPriorityIndex(priority, left.condition);
    const rightPriority = getPriorityIndex(priority, right.condition);

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return getResultSortKey(left).localeCompare(getResultSortKey(right));
  });
}

export function evaluateWinCondition(
  state: GameState,
  condition: WinCondition,
): GameEndResult | null {
  if (condition.type === 'OPPONENT_HP_ZERO') {
    return evaluateHpWinCondition(state);
  }

  if (condition.type === 'DECK_OUT_LOSS') {
    return evaluateDeckOutWinCondition(state);
  }

  if (condition.type === 'TURN_LIMIT') {
    return evaluateTurnLimitWinCondition(state, condition);
  }

  if (condition.type === 'BOSS_DEFEATED') {
    return evaluateBossDefeatedWinCondition(state, condition);
  }

  if (condition.type === 'PUZZLE_OBJECTIVE') {
    return evaluatePuzzleObjectiveWinCondition(state, condition);
  }

  if (condition.type === 'DOMINANCE_OBJECTIVE') {
    return evaluateDominanceObjectiveWinCondition(state, condition);
  }

  return null;
}

export function evaluateHpWinCondition(state: GameState): GameEndResult | null {
  const defeatedPlayerIds = getDefeatedPlayerIdsByHp(state);

  if (defeatedPlayerIds.length === 0) {
    return null;
  }

  if (defeatedPlayerIds.length > 1) {
    return {
      winner: null,
      loser: null,
      reason: 'BOTH_PLAYERS_HP_ZERO',
      condition: 'OPPONENT_HP_ZERO',
      detail: {
        defeatedPlayerIds: defeatedPlayerIds.join(','),
      },
    };
  }

  const loser = defeatedPlayerIds[0]!;
  const winner = getOpponentPlayerId(state, loser);

  return {
    winner,
    loser,
    reason: loser === state.activePlayerId ? 'PLAYER_HP_ZERO' : 'OPPONENT_HP_ZERO',
    condition: 'OPPONENT_HP_ZERO',
    detail: {
      loser,
    },
  };
}

export function isDeckOut(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId]?.flags[DECK_OUT_PENDING_FLAG] === true;
}

export function markDeckOut(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];

  if (!player) {
    return state;
  }

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        flags: {
          ...player.flags,
          [DECK_OUT_PENDING_FLAG]: true,
        },
      },
    },
  };
}

export function evaluateDeckOutWinCondition(state: GameState): GameEndResult | null {
  const deckOutPlayerIds = getPlayerIds(state).filter((playerId) => isDeckOut(state, playerId));

  if (deckOutPlayerIds.length === 0) {
    return null;
  }

  if (deckOutPlayerIds.length > 1) {
    return {
      winner: null,
      loser: null,
      reason: 'DECK_OUT',
      condition: 'DECK_OUT_LOSS',
      detail: {
        deckOutPlayerIds: deckOutPlayerIds.join(','),
      },
    };
  }

  const loser = deckOutPlayerIds[0]!;

  return {
    winner: getOpponentPlayerId(state, loser),
    loser,
    reason: 'DECK_OUT',
    condition: 'DECK_OUT_LOSS',
    detail: {
      loser,
    },
  };
}

export function handleDrawFromEmptyDeck(state: GameState, playerId: PlayerId): GameState {
  return markDeckOut(state, playerId);
}

export function evaluateTurnLimitWinCondition(
  state: GameState,
  condition: Extract<WinCondition, { type: 'TURN_LIMIT' }>,
): GameEndResult | null {
  if (state.turnNumber < condition.maxTurns) {
    return null;
  }

  const defaultPlayerId = state.activePlayerId;
  const opponentPlayerId = getOpponentPlayerId(state, defaultPlayerId);

  if (condition.result === 'WIN') {
    return {
      winner: defaultPlayerId,
      loser: opponentPlayerId,
      reason: 'TURN_LIMIT',
      condition: 'TURN_LIMIT',
      detail: { maxTurns: condition.maxTurns, result: condition.result },
    };
  }

  if (condition.result === 'LOSS') {
    return {
      winner: opponentPlayerId,
      loser: defaultPlayerId,
      reason: 'TURN_LIMIT',
      condition: 'TURN_LIMIT',
      detail: { maxTurns: condition.maxTurns, result: condition.result },
    };
  }

  const winner = calculateTurnLimitWinnerByScore(state);

  return {
    winner,
    loser: winner ? getOpponentPlayerId(state, winner) : null,
    reason: 'TURN_LIMIT',
    condition: 'TURN_LIMIT',
    detail: { maxTurns: condition.maxTurns, result: condition.result },
  };
}

export function calculateTurnLimitScore(state: GameState, playerId = state.activePlayerId): number {
  const player = state.players[playerId];

  if (!player) {
    return 0;
  }

  const unitCount = Object.values(state.board.slots).filter(
    (slot) => slot.ownerSide === playerId && slot.unit !== null,
  ).length;

  return player.hp + player.dominance.boardValue + unitCount;
}

export function evaluateBossDefeatedWinCondition(
  state: GameState,
  condition: Extract<WinCondition, { type: 'BOSS_DEFEATED' }>,
): GameEndResult | null {
  if (!isBossDefeated(state, condition.bossUnitId)) {
    return null;
  }

  return {
    winner: condition.winnerId,
    loser: getOpponentPlayerId(state, condition.winnerId),
    reason: 'BOSS_DEFEATED',
    condition: 'BOSS_DEFEATED',
    detail: {
      bossUnitId: condition.bossUnitId,
    },
  };
}

export function evaluatePuzzleObjectiveWinCondition(
  state: GameState,
  condition: Extract<WinCondition, { type: 'PUZZLE_OBJECTIVE' }>,
): GameEndResult | null {
  const objective = state.scenarioState?.objectives?.[condition.objectiveId];
  const legacyObjective = state.scenarioState?.objectiveState[condition.objectiveId];

  if (objective?.completed !== true && legacyObjective !== true) {
    return null;
  }

  return {
    winner: condition.winnerId,
    loser: getOpponentPlayerId(state, condition.winnerId),
    reason: 'PUZZLE_OBJECTIVE',
    condition: 'PUZZLE_OBJECTIVE',
    detail: {
      objectiveId: condition.objectiveId,
    },
  };
}

export function evaluateDominanceObjectiveWinCondition(
  state: GameState,
  condition: Extract<WinCondition, { type: 'DOMINANCE_OBJECTIVE' }>,
): GameEndResult | null {
  const player = state.players[condition.playerId];

  if (!player || player.dominance.boardValue < condition.threshold) {
    return null;
  }

  const progressKey = getDominanceObjectiveProgressKey(condition);
  const progressValue = state.scenarioState?.objectiveState[progressKey];
  const progress = typeof progressValue === 'number' ? progressValue : 1;

  if (progress < condition.turns) {
    return null;
  }

  return {
    winner: condition.playerId,
    loser: getOpponentPlayerId(state, condition.playerId),
    reason: 'DOMINANCE_OBJECTIVE',
    condition: 'DOMINANCE_OBJECTIVE',
    detail: {
      playerId: condition.playerId,
      threshold: condition.threshold,
      turns: condition.turns,
    },
  };
}

export function getDominanceObjectiveProgressKey(
  condition: Extract<WinCondition, { type: 'DOMINANCE_OBJECTIVE' }>,
): string {
  return `dominance:${condition.playerId}:${condition.threshold}:${condition.turns}`;
}

function getPriorityIndex(
  priority: readonly WinCondition['type'][],
  conditionType: WinCondition['type'],
): number {
  const index = priority.findIndex((candidate) => candidate === conditionType);

  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function getResultSortKey(result: GameEndResult): string {
  return [
    result.condition,
    result.reason,
    result.winner ?? '',
    result.loser ?? '',
    result.detail ? JSON.stringify(result.detail) : '',
  ].join(':');
}

function isBossDefeated(state: GameState, bossUnitId: InstanceId): boolean {
  const instance = state.zones.cardInstances[bossUnitId];
  const destroyedEventExists = state.eventLog.some(
    (event) =>
      event.type === 'UNIT_DESTROYED' &&
      typeof event.payload === 'object' &&
      event.payload !== null &&
      (event.payload as { unitId?: string }).unitId === bossUnitId,
  );

  return instance?.currentZone.type === 'GRAVEYARD' || destroyedEventExists;
}

function calculateTurnLimitWinnerByScore(state: GameState): PlayerId | null {
  const scores = getPlayerIds(state).map((playerId) => ({
    playerId,
    score: calculateTurnLimitScore(state, playerId),
  }));

  const sortedScores = scores.sort((left, right) => right.score - left.score);
  const first = sortedScores[0];
  const second = sortedScores[1];

  if (!first || !second || first.score === second.score) {
    return null;
  }

  return first.playerId;
}
