import { describe, expect, it } from 'vitest';
import { createEmptyBoard } from '../src/board';
import type { CardInstance } from '../src/cards';
import type { GameState, PlayerState } from '../src/core';
import { RULE_VERSION } from '../src/core';
import {
  DEFAULT_DOMINANCE_CONFIG,
  DEFAULT_RESOURCE_STATE,
  createInitialDominanceState,
} from '../src/dominance';
import type { GameEvent } from '../src/events';

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

describe('core game state model', () => {
  it('assembles a minimal GameState with Phase 3 model types', () => {
    const playerOne = createPlayer('P1');
    const playerTwo = createPlayer('P2');
    const unit: CardInstance = {
      instanceId: 'instance-game-001',
      definitionId: 'unit_model_vanguard',
      ownerId: 'P1',
      controllerId: 'P1',
      currentZone: {
        type: 'HAND',
        ownerId: 'P1',
      },
      damage: 0,
      statusEffects: [],
      exhausted: false,
      summonedThisTurn: false,
      temporaryModifiers: [],
      attachedEffects: [],
    };
    const event: GameEvent<{ activePlayerId: string }> = {
      eventId: 'event-001',
      type: 'TURN_STARTED',
      turnNumber: 1,
      phase: 'TURN_START',
      payload: { activePlayerId: 'P1' },
      visibility: 'PUBLIC',
    };

    const state: GameState = {
      gameId: 'game-001',
      ruleVersion: RULE_VERSION,
      cardDataVersion: 'cards-dev',
      turnNumber: 1,
      activePlayerId: 'P1',
      priorityPlayerId: 'P1',
      phase: 'TURN_START',
      players: {
        P1: playerOne,
        P2: playerTwo,
      },
      dominanceConfig: DEFAULT_DOMINANCE_CONFIG,
      board: createEmptyBoard(['P1', 'P2']),
      zones: {
        cardInstances: {
          [unit.instanceId]: unit,
        },
        stack: [],
        revealed: {
          P1: [],
          P2: [],
        },
        temporary: [],
      },
      eventQueue: [event],
      effectStack: [],
      continuousEffects: [],
      pendingTriggers: [],
      actionLog: [],
      eventLog: [event],
      rngSeed: 'phase3-seed',
      rngCursor: 0,
      winner: null,
      gameStatus: 'RUNNING',
      turnState: {
        movedUnitIds: [],
        attackedUnitIds: [],
        cardsPlayedThisTurn: 0,
        turnStartedAtActionIndex: 0,
      },
    };

    expect(state.ruleVersion).toBe('core-rule-v0.1');
    expect(state.players.P1?.dominance.limit).toBe(3);
    expect(Object.keys(state.board.slots)).toHaveLength(12);
    expect(state.zones.cardInstances[unit.instanceId]?.definitionId).toBe(unit.definitionId);
  });
});
