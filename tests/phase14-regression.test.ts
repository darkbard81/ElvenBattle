import { describe, expect, it } from 'vitest';

import { simulateGame } from '../src/ai';
import { createPveGame } from '../src/game';
import { hashEventLog, hashGameState, runReplay } from '../src/replay';

describe('Phase14 deterministic replay regression', () => {
  it('replays a PvE AI simulation to the same state and event log hashes', () => {
    const initialState = createPveGame({ scenarioId: 'pve_intro_duel' });
    const result = simulateGame(initialState, {
      createReplayFile: true,
      maxTurns: 12,
      maxActions: 250,
    });

    expect(result.replayFile).toBeDefined();

    const replay = runReplay(result.replayFile!);

    expect(replay.ok).toBe(true);
    expect(replay.finalStateHash).toBe(hashGameState(result.finalState));
    expect(replay.finalEventLogHash).toBe(hashEventLog(result.finalState.eventLog));
  }, 15_000);

  it('creates stable initial and final hashes for the same seed and scenario', () => {
    const leftInitial = createPveGame({ scenarioId: 'pve_boss_trial' });
    const rightInitial = createPveGame({ scenarioId: 'pve_boss_trial' });

    expect(hashGameState(leftInitial)).toBe(hashGameState(rightInitial));

    const leftResult = simulateGame(leftInitial, { maxTurns: 12, maxActions: 250 });
    const rightResult = simulateGame(rightInitial, { maxTurns: 12, maxActions: 250 });

    expect(hashGameState(leftResult.finalState)).toBe(hashGameState(rightResult.finalState));
    expect(hashEventLog(leftResult.finalState.eventLog)).toBe(
      hashEventLog(rightResult.finalState.eventLog),
    );
  }, 15_000);
});
