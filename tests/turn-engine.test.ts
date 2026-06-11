import { describe, expect, it } from 'vitest';
import { endTurn, getNextPlayerId, getPlayerOrder, startTurn } from '../src/game';
import { createTestGameState } from './helpers/game-state';

describe('turn engine', () => {
  it('starts a turn for the given player and resets turn state', () => {
    const state = createTestGameState({ phase: 'END', turnNumber: 3 });
    const nextState = startTurn(state, 'P2');

    expect(nextState).not.toBe(state);
    expect(nextState.activePlayerId).toBe('P2');
    expect(nextState.priorityPlayerId).toBe('P2');
    expect(nextState.turnNumber).toBe(4);
    expect(nextState.phase).toBe('TURN_START');
    expect(nextState.turnState).toEqual({
      movedUnitIds: [],
      attackedUnitIds: [],
      cardsPlayedThisTurn: 0,
      turnStartedAtActionIndex: 0,
    });
    expect(nextState.eventLog.at(-1)?.type).toBe('TURN_STARTED');
  });

  it('determines player order and the next player from state', () => {
    const state = createTestGameState();

    expect(getPlayerOrder(state)).toEqual(['P1', 'P2']);
    expect(getNextPlayerId(state)).toBe('P2');
  });

  it('ends the current turn and starts the next player turn', () => {
    const state = createTestGameState({ phase: 'END', turnNumber: 2 });
    const nextState = endTurn(state);

    expect(nextState.activePlayerId).toBe('P2');
    expect(nextState.priorityPlayerId).toBe('P2');
    expect(nextState.turnNumber).toBe(3);
    expect(nextState.phase).toBe('TURN_START');
    expect(nextState.eventLog.map((event) => event.type)).toEqual(['TURN_ENDED', 'TURN_STARTED']);
    expect(state.eventLog).toHaveLength(0);
  });
});
