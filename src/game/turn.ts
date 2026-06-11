import type { GameState, PlayerId } from '../core';
import { removeExpiredModifiers, removeExpiredStatusEffects } from '../effects';
import { createTurnEndedEvent, createTurnStartedEvent } from '../events';
import { finalizeIfWinConditionMet } from './end';
import type { TurnState } from './types';

export function createInitialTurnState(): TurnState {
  return {
    movedUnitIds: [],
    attackedUnitIds: [],
    cardsPlayedThisTurn: 0,
    turnStartedAtActionIndex: 0,
  };
}

export function getPlayerOrder(state: GameState): PlayerId[] {
  return Object.keys(state.players);
}

export function getNextPlayerId(state: GameState): PlayerId {
  const playerOrder = getPlayerOrder(state);
  const activeIndex = playerOrder.findIndex((playerId) => playerId === state.activePlayerId);
  const nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % playerOrder.length;
  const nextPlayerId = playerOrder[nextIndex];

  if (!nextPlayerId) {
    throw new Error('No next player is available.');
  }

  return nextPlayerId;
}

export function startTurn(state: GameState, nextPlayerId: PlayerId): GameState {
  const expiredState = removeExpiredModifiers(
    removeExpiredStatusEffects(state, 'START_OF_TURN'),
    'START_OF_TURN',
  );
  const event = createTurnStartedEvent(expiredState, nextPlayerId);
  const nextTurnNumber = state.turnNumber + 1;

  return {
    ...expiredState,
    activePlayerId: nextPlayerId,
    priorityPlayerId: nextPlayerId,
    turnNumber: nextTurnNumber,
    phase: 'TURN_START',
    turnState: {
      ...createInitialTurnState(),
      turnStartedAtActionIndex: state.actionLog.length,
    },
    eventLog: [
      ...expiredState.eventLog,
      {
        ...event,
        turnNumber: nextTurnNumber,
      },
    ],
  };
}

export function endTurn(state: GameState): GameState {
  const expiredState = removeExpiredModifiers(
    removeExpiredStatusEffects(state, 'END_OF_TURN'),
    'END_OF_TURN',
  );
  const endedPlayerId = expiredState.activePlayerId;
  const turnEndedEvent = createTurnEndedEvent(expiredState, endedPlayerId);
  const stateWithEndedEvent: GameState = {
    ...expiredState,
    eventLog: [...expiredState.eventLog, turnEndedEvent],
  };

  return finalizeIfWinConditionMet(
    startTurn(stateWithEndedEvent, getNextPlayerId(stateWithEndedEvent)),
  );
}
