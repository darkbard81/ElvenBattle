import { describe, expect, it } from 'vitest';
import { advanceAutomaticPhase, checkWinConditions, handleDrawFromEmptyDeck } from '../src/game';
import { createTestGameState } from './helpers/game-state';

describe('deck out win condition', () => {
  it('does not end merely because a deck is empty', () => {
    const state = createTestGameState();

    expect(state.players.P1?.deck).toEqual([]);
    expect(checkWinConditions(state)).toBeNull();
  });

  it('ends the game when the DRAW phase attempts to draw from an empty deck', () => {
    const state = createTestGameState({ phase: 'DRAW' });
    const result = advanceAutomaticPhase(state);

    expect(result.phase).toBe('GAME_OVER');
    expect(result.gameStatus).toBe('FINISHED');
    expect(result.winner).toBe('P2');
    expect(result.eventLog.at(-1)?.type).toBe('GAME_ENDED');
    expect(result.eventLog.at(-1)?.payload).toMatchObject({
      loser: 'P1',
      reason: 'DECK_OUT',
    });
  });

  it('marks empty-deck draw attempts for later deterministic evaluation', () => {
    const marked = handleDrawFromEmptyDeck(createTestGameState(), 'P1');

    expect(checkWinConditions(marked)).toMatchObject({
      winner: 'P2',
      loser: 'P1',
      reason: 'DECK_OUT',
    });
  });
});
