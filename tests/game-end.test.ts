import { describe, expect, it } from 'vitest';
import { countGameEndedEvents, finalizeGame, hasGameEnded } from '../src/game';
import { createTestGameState } from './helpers/game-state';

describe('game end finalization', () => {
  it('finalizes the game once and records a single GAME_ENDED event', () => {
    const state = createTestGameState();
    const ended = finalizeGame(state, {
      winner: 'P1',
      loser: 'P2',
      reason: 'OPPONENT_HP_ZERO',
      condition: 'OPPONENT_HP_ZERO',
    });
    const finalizedAgain = finalizeGame(ended, {
      winner: 'P2',
      loser: 'P1',
      reason: 'SURRENDER',
      condition: 'SURRENDER',
    });

    expect(hasGameEnded(finalizedAgain)).toBe(true);
    expect(finalizedAgain.phase).toBe('GAME_OVER');
    expect(finalizedAgain.gameStatus).toBe('FINISHED');
    expect(finalizedAgain.winner).toBe('P1');
    expect(finalizedAgain.priorityPlayerId).toBeNull();
    expect(countGameEndedEvents(finalizedAgain)).toBe(1);
    expect(finalizedAgain.eventLog.at(-1)?.type).toBe('GAME_ENDED');
  });
});
