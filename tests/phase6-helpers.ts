import basicOngoing from '../card-data/examples/basic-ongoing.example.json';
import basicTactic from '../card-data/examples/basic-tactic.example.json';
import backSupport from '../card-data/examples/back-support.example.json';
import basicUnit from '../card-data/examples/basic-unit.example.json';
import { createCardInstance, createCardRegistry, parseCardDefinitions } from '../src/cards';
import type { CardInstance } from '../src/cards';
import type { GameState, PlayerState } from '../src/core';
import { createSlotId } from '../src/board';
import { createTestGameState } from './helpers/game-state';

export const phase6Definitions = parseCardDefinitions([
  basicUnit,
  backSupport,
  basicTactic,
  basicOngoing,
]);
export const phase6Registry = createCardRegistry(phase6Definitions);

export function createPhase6State(overrides: Partial<GameState> = {}): GameState {
  const baseState = createTestGameState();

  return {
    ...baseState,
    cardDefinitions: phase6Registry.definitions,
    players: {
      ...baseState.players,
      P1: {
        ...baseState.players.P1!,
        resource: {
          ...baseState.players.P1!.resource,
          current: 10,
          max: 10,
        },
      },
    },
    ...overrides,
  };
}

export function addHandCard(
  state: GameState,
  instanceId: string,
  cardId: string,
  playerId: 'P1' | 'P2' = 'P1',
): GameState {
  const definition = phase6Registry.definitions[cardId];

  if (!definition) {
    throw new Error(`Missing test definition: ${cardId}`);
  }

  const instance = {
    ...createCardInstance(definition, playerId, instanceId),
    currentZone: {
      type: 'HAND' as const,
      ownerId: playerId,
    },
  };
  const player = state.players[playerId] as PlayerState;

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: [...player.hand, instanceId],
      },
    },
    zones: {
      ...state.zones,
      cardInstances: {
        ...state.zones.cardInstances,
        [instanceId]: instance,
      },
    },
  };
}

export function addBoardUnit(
  state: GameState,
  instanceId: string,
  cardId: string,
  slotId = createSlotId('P1', 'FRONT', 0),
  playerId: 'P1' | 'P2' = 'P1',
  instanceOverrides: Partial<CardInstance> = {},
): GameState {
  const definition = phase6Registry.definitions[cardId];

  if (!definition) {
    throw new Error(`Missing test definition: ${cardId}`);
  }

  const instance = {
    ...createCardInstance(definition, playerId, instanceId),
    currentZone: {
      type: 'BATTLEFIELD' as const,
      ownerId: playerId,
      slotId,
    },
    ...instanceOverrides,
  };
  const slot = state.board.slots[slotId];

  if (!slot) {
    throw new Error(`Missing test slot: ${slotId}`);
  }

  return {
    ...state,
    board: {
      ...state.board,
      slots: {
        ...state.board.slots,
        [slotId]: {
          ...slot,
          unit: instanceId,
        },
      },
    },
    zones: {
      ...state.zones,
      cardInstances: {
        ...state.zones.cardInstances,
        [instanceId]: instance,
      },
    },
  };
}
