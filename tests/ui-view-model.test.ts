import { describe, expect, it } from 'vitest';

import { createGameViewModel } from '../src/ui';
import { createPveGame } from '../src/game';

describe('Phase13 UI view model', () => {
  it('converts GameState into a playable game view model', () => {
    const state = createPveGame();
    const viewModel = createGameViewModel(state, { viewerId: 'P1' });

    expect(viewModel.activePlayerId).toBe('P1');
    expect(viewModel.phase).toBe('MAIN');
    expect(viewModel.players).toHaveLength(2);
    expect(viewModel.players[0]?.hp).toBeGreaterThan(0);
    expect(viewModel.hand.length).toBe(6);
    expect(viewModel.boardSlots).toHaveLength(12);
    expect(viewModel.opponentHandCount).toBe(6);
  });

  it('creates result view model for game over state', () => {
    const state = {
      ...createPveGame(),
      phase: 'GAME_OVER' as const,
      gameStatus: 'FINISHED' as const,
      winner: 'P1',
    };
    const viewModel = createGameViewModel(state, { viewerId: 'P1' });

    expect(viewModel.result).toEqual({
      winner: 'P1',
      status: 'FINISHED',
      reason: 'FINISHED',
    });
  });
});
