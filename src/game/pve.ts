import basicOngoing from '../../card-data/examples/basic-ongoing.example.json';
import basicTactic from '../../card-data/examples/basic-tactic.example.json';
import backSupport from '../../card-data/examples/back-support.example.json';
import basicUnit from '../../card-data/examples/basic-unit.example.json';
import { createEmptyBoard, placeUnitOnBoard } from '../board';
import {
  createCardInstance,
  createCardRegistry,
  createInitialDeckSetup,
  parseCardDefinitions,
} from '../cards';
import type { CardRegistry, DeterministicRng } from '../cards';
import { RULE_VERSION } from '../core';
import type { GameState, PlayerId, PlayerState } from '../core';
import {
  DEFAULT_DOMINANCE_CONFIG,
  DEFAULT_RESOURCE_STATE,
  createInitialDominanceState,
  recalculateDominance,
} from '../dominance';
import { expandPveDeck, PVE_AI_ID, PVE_PLAYER_ID } from './pve-decks';
import { getPveScenario, type PveScenarioDefinition, type PveScenarioId } from './scenario';
import { createInitialTurnState } from './turn';

export const PVE_CARD_DATA_VERSION = 'phase13-pve-cards';
export const PVE_CARD_REGISTRY = createCardRegistry(
  parseCardDefinitions([basicUnit, backSupport, basicTactic, basicOngoing]),
);

export interface CreatePveGameOptions {
  scenarioId?: PveScenarioId;
}

export function createPveGame(options: CreatePveGameOptions = {}): GameState {
  const scenario = getPveScenario(options.scenarioId ?? 'pve_intro_duel');

  return createPveGameFromScenario(scenario, PVE_CARD_REGISTRY);
}

export function createPveGameFromScenario(
  scenario: PveScenarioDefinition,
  registry: CardRegistry = PVE_CARD_REGISTRY,
): GameState {
  const startingRng: DeterministicRng = {
    seed: scenario.rngSeed,
    cursor: 0,
  };
  const playerSetup = createInitialDeckSetup(
    registry,
    scenario.playerId,
    scenario.playerDeck,
    'pve-player',
    startingRng,
    scenario.startingHandSize,
  );
  const aiSetup = createInitialDeckSetup(
    registry,
    scenario.aiPlayerId,
    scenario.aiDeck,
    'pve-ai',
    playerSetup.rng,
    scenario.startingHandSize,
  );
  const initialPlayers = {
    [scenario.playerId]: createPvePlayer(scenario.playerId, 'HUMAN', scenario, playerSetup),
    [scenario.aiPlayerId]: createPvePlayer(scenario.aiPlayerId, 'AI', scenario, aiSetup),
  };
  const baseState: GameState = {
    gameId: `game:${scenario.scenarioId}`,
    ruleVersion: RULE_VERSION,
    cardDataVersion: PVE_CARD_DATA_VERSION,
    cardDefinitions: registry.definitions,
    scenarioId: scenario.scenarioId,
    turnNumber: 1,
    activePlayerId: scenario.startingPlayerId,
    priorityPlayerId: scenario.startingPlayerId,
    phase: 'MAIN',
    players: initialPlayers,
    dominanceConfig: DEFAULT_DOMINANCE_CONFIG,
    board: createEmptyBoard([scenario.playerId, scenario.aiPlayerId]),
    zones: {
      cardInstances: {
        ...playerSetup.cardInstances,
        ...aiSetup.cardInstances,
      },
      stack: [],
      revealed: {
        [scenario.playerId]: [],
        [scenario.aiPlayerId]: [],
      },
      temporary: [],
    },
    eventQueue: [],
    effectStack: [],
    continuousEffects: [],
    pendingTriggers: [],
    actionLog: [],
    eventLog: [],
    rngSeed: scenario.rngSeed,
    rngCursor: aiSetup.rng.cursor,
    winner: null,
    gameStatus: 'RUNNING',
    turnState: createInitialTurnState(),
    scenarioState: {
      scenarioId: scenario.scenarioId,
      version: scenario.version,
      objectiveState: {},
      winConditions: scenario.winConditions,
      ...(scenario.boss
        ? {
            bossUnitIds: [scenario.boss.unitId],
            objectives: {
              defeatBoss: {
                objectiveId: 'defeatBoss',
                completed: false,
              },
            },
          }
        : {}),
    },
  };

  return scenario.boss ? addBossUnit(baseState, scenario, registry) : baseState;
}

function createPvePlayer(
  playerId: PlayerId,
  kind: PlayerState['kind'],
  scenario: PveScenarioDefinition,
  setup: {
    deck: string[];
    hand: string[];
  },
): PlayerState {
  return {
    playerId,
    kind,
    hp: scenario.startingHp,
    maxHp: scenario.startingHp,
    deck: setup.deck,
    hand: setup.hand,
    graveyard: [],
    banished: [],
    resource: {
      ...DEFAULT_RESOURCE_STATE,
      current: 3,
      max: 3,
    },
    dominance: createInitialDominanceState(),
    flags: {},
    oncePerTurn: {},
    revealedCards: [],
  };
}

function addBossUnit(
  state: GameState,
  scenario: PveScenarioDefinition,
  registry: CardRegistry,
): GameState {
  if (!scenario.boss) {
    return state;
  }

  const bossDefinition = registry.definitions[scenario.boss.cardId];

  if (!bossDefinition) {
    throw new Error(`Missing boss card definition: ${scenario.boss.cardId}`);
  }

  const bossInstance = {
    ...createCardInstance(bossDefinition, scenario.aiPlayerId, scenario.boss.unitId),
    currentZone: {
      type: 'BATTLEFIELD' as const,
      ownerId: scenario.aiPlayerId,
      slotId: scenario.boss.slotId,
    },
    currentAttack: Math.max(3, bossDefinition.baseAttack ?? 0),
    currentHealth: Math.max(6, bossDefinition.baseHealth ?? 0),
  };
  const stateWithBoss: GameState = placeUnitOnBoard(
    {
      ...state,
      zones: {
        ...state.zones,
        cardInstances: {
          ...state.zones.cardInstances,
          [bossInstance.instanceId]: bossInstance,
        },
      },
    },
    bossInstance.instanceId,
    scenario.boss.slotId,
  );
  const dominanceResult = recalculateDominance(
    stateWithBoss,
    stateWithBoss.cardDefinitions ?? {},
    scenario.aiPlayerId,
    'RECALCULATE',
  );

  return dominanceResult.state;
}

export function createPveInitialDecks(scenario: PveScenarioDefinition): Record<PlayerId, string[]> {
  return {
    [PVE_PLAYER_ID]: expandPveDeck(scenario.playerDeck),
    [PVE_AI_ID]: expandPveDeck(scenario.aiDeck),
  };
}
