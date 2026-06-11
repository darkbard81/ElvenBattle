import { describe, expect, it } from 'vitest';

import { createSlotId } from '../src/board';
import { simulateGame } from '../src/ai';
import { hashGameState, runReplay } from '../src/replay';
import { addBoardUnit, createPhase6State } from './phase6-helpers';

describe('Phase12 AI replay integration', () => {
  it('replays an AI simulation to the same final state hash', () => {
    const initialState = addBoardUnit(
      createPhase6State({
        phase: 'COMBAT',
        players: {
          ...createPhase6State().players,
          P2: {
            ...createPhase6State().players.P2!,
            hp: 2,
          },
        },
      }),
      'attacker',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 0),
    );
    const result = simulateGame(initialState, { createReplayFile: true });

    expect(result.replayFile).toBeDefined();

    const replayResult = runReplay(result.replayFile!);

    expect(replayResult.ok).toBe(true);
    expect(replayResult.finalStateHash).toBe(hashGameState(result.finalState));
  });
});
