import { describe, expect, it } from 'vitest';

import { formatPhase14BalanceReport, runPhase14BalanceCheck } from '../scripts/phase14-balance';

describe('Phase14 balance gate', () => {
  it('produces deterministic PvE balance metrics without illegal actions or replay mismatches', () => {
    const report = runPhase14BalanceCheck({
      seeds: ['test-seed-a', 'test-seed-b'],
      scenarioIds: ['pve_intro_duel', 'pve_boss_trial'],
      maxTurns: 30,
      maxActions: 300,
    });

    expect(report.ok).toBe(true);
    expect(report.scenarios).toHaveLength(2);

    for (const scenario of report.scenarios) {
      expect(scenario.sampleCount).toBe(2);
      expect(scenario.completedGames).toBe(2);
      expect(scenario.illegalActionRate).toBe(0);
      expect(scenario.replayMismatchCount).toBe(0);
      expect(scenario.finalStateHashes).toHaveLength(2);
    }

    expect(formatPhase14BalanceReport(report)).toContain('Phase14 Balance Check');
  }, 15_000);
});
