import { describe, expect, it } from 'vitest';
import { abortGame, applyAction } from '../src/game';
import { createTestGameState } from './helpers/game-state';

describe('surrender and abort', () => {
  it('handles surrender as a normal accepted action', () => {
    const result = applyAction(createTestGameState(), {
      actionId: 'surrender-1',
      playerId: 'P1',
      type: 'SURRENDER',
      payload: {},
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.state.gameStatus).toBe('FINISHED');
    expect(result.state.phase).toBe('GAME_OVER');
    expect(result.state.winner).toBe('P2');
    expect(result.state.eventLog.at(-1)?.payload).toMatchObject({
      loser: 'P1',
      reason: 'SURRENDER',
    });
  });

  it('handles invalid-state abort without a winner', () => {
    const result = abortGame(createTestGameState(), 'invalid_test_state');

    expect(result.gameStatus).toBe('ABORTED');
    expect(result.phase).toBe('GAME_OVER');
    expect(result.winner).toBeNull();
    expect(result.eventLog.at(-1)?.payload).toMatchObject({
      winner: null,
      reason: 'INVALID_STATE_ABORT',
    });
  });
});
