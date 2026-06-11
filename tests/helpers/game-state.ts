import { createEmptyBoard } from '../../src/board';
import type { GameState, PlayerState } from '../../src/core';
import { RULE_VERSION } from '../../src/core';
import {
  DEFAULT_DOMINANCE_CONFIG,
  DEFAULT_RESOURCE_STATE,
  createInitialDominanceState,
} from '../../src/dominance';

function createPlayer(playerId: 'P1' | 'P2'): PlayerState {
  return {
    playerId,
    kind: playerId === 'P1' ? 'HUMAN' : 'AI',
    hp: 30,
    maxHp: 30,
    deck: [],
    hand: [],
    graveyard: [],
    banished: [],
    resource: { ...DEFAULT_RESOURCE_STATE },
    dominance: createInitialDominanceState(),
    flags: {},
    oncePerTurn: {},
    revealedCards: [],
  };
}

export function createTestGameState(overrides: Partial<GameState> = {}): GameState {
  const state: GameState = {
    gameId: 'game-phase4-test',
    ruleVersion: RULE_VERSION,
    cardDataVersion: 'cards-dev',
    turnNumber: 1,
    activePlayerId: 'P1',
    priorityPlayerId: 'P1',
    phase: 'MAIN',
    players: {
      P1: createPlayer('P1'),
      P2: createPlayer('P2'),
    },
    dominanceConfig: DEFAULT_DOMINANCE_CONFIG,
    board: createEmptyBoard(['P1', 'P2']),
    zones: {
      cardInstances: {},
      stack: [],
      revealed: {
        P1: [],
        P2: [],
      },
      temporary: [],
    },
    eventQueue: [],
    effectStack: [],
    continuousEffects: [],
    pendingTriggers: [],
    actionLog: [],
    eventLog: [],
    rngSeed: 'phase4-seed',
    rngCursor: 0,
    winner: null,
    gameStatus: 'RUNNING',
    turnState: {
      movedUnitIds: ['unit-that-moved'],
      attackedUnitIds: ['unit-that-attacked'],
      cardsPlayedThisTurn: 1,
      turnStartedAtActionIndex: 0,
    },
  };

  return {
    ...state,
    ...overrides,
  };
}
