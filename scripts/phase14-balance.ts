import { createPveGameFromScenario, getPveScenario, PVE_PLAYER_ID } from '../src/game';
import { simulateGame } from '../src/ai';
import { hashGameState, runReplay } from '../src/replay';
import type { GameEndedPayload } from '../src/events';
import type { PlayerId } from '../src/core';
import type { PveScenarioId } from '../src/game';

export const PHASE14_BALANCE_SEEDS = [
  'phase14-balance-001',
  'phase14-balance-002',
  'phase14-balance-003',
  'phase14-balance-004',
] as const;

export interface Phase14BalanceOptions {
  seeds?: readonly string[];
  scenarioIds?: readonly PveScenarioId[];
  maxTurns?: number;
  maxActions?: number;
}

export interface Phase14BalanceScenarioMetrics {
  scenarioId: PveScenarioId;
  sampleCount: number;
  completedGames: number;
  playerWinRate: number;
  bossClearRate: number | null;
  averageTurnCount: number;
  medianTurnCount: number;
  deckOutRate: number;
  averageRemainingHp: number;
  dominanceOverloadRate: number;
  illegalActionRate: number;
  replayMismatchCount: number;
  finalStateHashes: string[];
  warnings: string[];
}

export interface Phase14BalanceReport {
  generatedAtPolicy: 'OMITTED_FOR_DETERMINISM';
  seeds: readonly string[];
  scenarios: Phase14BalanceScenarioMetrics[];
  ok: boolean;
  errors: string[];
}

export function runPhase14BalanceCheck(options: Phase14BalanceOptions = {}): Phase14BalanceReport {
  const seeds = options.seeds ?? PHASE14_BALANCE_SEEDS;
  const scenarioIds = options.scenarioIds ?? ['pve_intro_duel', 'pve_boss_trial'];
  const scenarios = scenarioIds.map((scenarioId) =>
    runScenarioBalanceCheck(scenarioId, seeds, options),
  );
  const errors = scenarios.flatMap((scenario) => {
    const scenarioErrors: string[] = [];

    if (scenario.completedGames !== scenario.sampleCount) {
      scenarioErrors.push(
        `${scenario.scenarioId}: completed ${scenario.completedGames}/${scenario.sampleCount}`,
      );
    }

    if (scenario.illegalActionRate > 0) {
      scenarioErrors.push(
        `${scenario.scenarioId}: illegal action rate ${scenario.illegalActionRate}`,
      );
    }

    if (scenario.replayMismatchCount > 0) {
      scenarioErrors.push(
        `${scenario.scenarioId}: replay mismatches ${scenario.replayMismatchCount}`,
      );
    }

    return scenarioErrors;
  });

  return {
    generatedAtPolicy: 'OMITTED_FOR_DETERMINISM',
    seeds,
    scenarios,
    ok: errors.length === 0,
    errors,
  };
}

export function formatPhase14BalanceReport(report: Phase14BalanceReport): string {
  const lines = [
    '# Phase14 Balance Check',
    '',
    `status: ${report.ok ? 'ok' : 'failed'}`,
    `seeds: ${report.seeds.join(', ')}`,
    '',
  ];

  for (const scenario of report.scenarios) {
    lines.push(`## ${scenario.scenarioId}`);
    lines.push(`sampleCount: ${scenario.sampleCount}`);
    lines.push(`completedGames: ${scenario.completedGames}`);
    lines.push(`playerWinRate: ${formatRatio(scenario.playerWinRate)}`);
    lines.push(
      `bossClearRate: ${
        scenario.bossClearRate === null ? 'n/a' : formatRatio(scenario.bossClearRate)
      }`,
    );
    lines.push(`averageTurnCount: ${scenario.averageTurnCount.toFixed(2)}`);
    lines.push(`medianTurnCount: ${scenario.medianTurnCount.toFixed(2)}`);
    lines.push(`deckOutRate: ${formatRatio(scenario.deckOutRate)}`);
    lines.push(`averageRemainingHp: ${scenario.averageRemainingHp.toFixed(2)}`);
    lines.push(`dominanceOverloadRate: ${formatRatio(scenario.dominanceOverloadRate)}`);
    lines.push(`illegalActionRate: ${formatRatio(scenario.illegalActionRate)}`);
    lines.push(`replayMismatchCount: ${scenario.replayMismatchCount}`);
    lines.push(`finalStateHashes: ${scenario.finalStateHashes.join(', ')}`);

    if (scenario.warnings.length > 0) {
      lines.push(`warnings: ${scenario.warnings.join('; ')}`);
    }

    lines.push('');
  }

  if (report.errors.length > 0) {
    lines.push('## Errors');
    lines.push(...report.errors.map((error) => `- ${error}`));
    lines.push('');
  }

  return lines.join('\n');
}

function runScenarioBalanceCheck(
  scenarioId: PveScenarioId,
  seeds: readonly string[],
  options: Phase14BalanceOptions,
): Phase14BalanceScenarioMetrics {
  const scenario = getPveScenario(scenarioId);
  const results = seeds.map((seed) => {
    const initialState = createPveGameFromScenario({
      ...scenario,
      rngSeed: `${scenario.rngSeed}:${seed}`,
    });

    return simulateGame(initialState, {
      createReplayFile: true,
      maxTurns: options.maxTurns ?? 30,
      maxActions: options.maxActions ?? 300,
    });
  });
  const playerWins = results.filter((result) => result.winner === PVE_PLAYER_ID).length;
  const completedGames = results.filter(
    (result) => result.finalState.gameStatus === 'FINISHED',
  ).length;
  const turnCounts = results.map((result) => result.turnCount).sort((left, right) => left - right);
  const deckOutGames = results.filter(
    (result) => getGameEndReason(result.finalState) === 'DECK_OUT',
  );
  const bossClearGames = results.filter(
    (result) =>
      getGameEndCondition(result.finalState) === 'BOSS_DEFEATED' &&
      result.winner === scenario.playerId,
  );
  const overloadedGames = results.filter((result) =>
    Object.values(result.finalState.players).some((player) => player.dominance.overloaded),
  );
  const replayMismatchCount = results.filter((result) => {
    if (!result.replayFile) {
      return true;
    }

    return !runReplay(result.replayFile).ok;
  }).length;
  const remainingHpValues = results.map((result) =>
    getPlayerHp(result.finalState.players, PVE_PLAYER_ID),
  );
  const warnings = createBalanceWarnings({
    scenarioId,
    playerWinRate: ratio(playerWins, results.length),
    bossClearRate: scenario.boss ? ratio(bossClearGames.length, results.length) : null,
    averageTurnCount: average(turnCounts),
  });

  return {
    scenarioId,
    sampleCount: results.length,
    completedGames,
    playerWinRate: ratio(playerWins, results.length),
    bossClearRate: scenario.boss ? ratio(bossClearGames.length, results.length) : null,
    averageTurnCount: average(turnCounts),
    medianTurnCount: median(turnCounts),
    deckOutRate: ratio(deckOutGames.length, results.length),
    averageRemainingHp: average(remainingHpValues),
    dominanceOverloadRate: ratio(overloadedGames.length, results.length),
    illegalActionRate: ratio(
      results.filter((result) => result.errors.length > 0 || !result.ok).length,
      results.length,
    ),
    replayMismatchCount,
    finalStateHashes: results.map((result) => hashGameState(result.finalState)),
    warnings,
  };
}

function createBalanceWarnings(input: {
  scenarioId: PveScenarioId;
  playerWinRate: number;
  bossClearRate: number | null;
  averageTurnCount: number;
}): string[] {
  const warnings: string[] = [];

  if (
    input.scenarioId === 'pve_intro_duel' &&
    (input.playerWinRate < 0.45 || input.playerWinRate > 0.75)
  ) {
    warnings.push('intro playerWinRate outside recommended 45%-75% range');
  }

  if (input.bossClearRate !== null && (input.bossClearRate < 0.25 || input.bossClearRate > 0.6)) {
    warnings.push('bossClearRate outside recommended 25%-60% range');
  }

  if (
    input.scenarioId === 'pve_intro_duel' &&
    (input.averageTurnCount < 5 || input.averageTurnCount > 14)
  ) {
    warnings.push('intro averageTurnCount outside recommended 5-14 range');
  }

  if (
    input.scenarioId === 'pve_boss_trial' &&
    (input.averageTurnCount < 7 || input.averageTurnCount > 20)
  ) {
    warnings.push('boss averageTurnCount outside recommended 7-20 range');
  }

  return warnings;
}

function getPlayerHp(players: Record<PlayerId, { hp: number }>, playerId: PlayerId): number {
  return players[playerId]?.hp ?? 0;
}

function getGameEndPayload(state: {
  eventLog: readonly { type: string; payload: unknown }[];
}): GameEndedPayload | null {
  const event = [...state.eventLog].reverse().find((candidate) => candidate.type === 'GAME_ENDED');

  return isGameEndedPayload(event?.payload) ? event.payload : null;
}

function getGameEndReason(state: {
  eventLog: readonly { type: string; payload: unknown }[];
}): string | null {
  return getGameEndPayload(state)?.reason ?? null;
}

function getGameEndCondition(state: {
  eventLog: readonly { type: string; payload: unknown }[];
}): string | null {
  return getGameEndPayload(state)?.condition ?? null;
}

function isGameEndedPayload(value: unknown): value is GameEndedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'reason' in value &&
    'condition' in value &&
    'winner' in value
  );
}

function ratio(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const middle = Math.floor(values.length / 2);

  if (values.length % 2 === 1) {
    return values[middle] ?? 0;
  }

  return ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2;
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
