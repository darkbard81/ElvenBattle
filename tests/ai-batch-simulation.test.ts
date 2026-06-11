import { describe, expect, it } from 'vitest';

import { createSlotId } from '../src/board';
import { runSimulationBatch, simulateGame } from '../src/ai';
import { hashActionLog } from '../src/replay';
import { addBoardUnit, createPhase6State } from './phase6-helpers';

function createLethalState() {
  return addBoardUnit(
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
}

describe('AI batch simulation', () => {
  it('simulates a deterministic game result', () => {
    const first = simulateGame(createLethalState());
    const second = simulateGame(createLethalState());

    expect(first.finalState.phase).toBe('GAME_OVER');
    expect(first.winner).toBe('P1');
    expect(hashActionLog(first.finalState.actionLog)).toBe(
      hashActionLog(second.finalState.actionLog),
    );
  });

  it('summarizes repeated simulation results', () => {
    const batch = runSimulationBatch([createLethalState(), createLethalState()]);

    expect(batch.summary.games).toBe(2);
    expect(batch.summary.completedGames).toBe(2);
    expect(batch.summary.winsByPlayer.P1).toBe(2);
  });
});
