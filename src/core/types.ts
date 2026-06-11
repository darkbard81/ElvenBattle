import type { BoardState } from '../board';
import type { CardDefinition } from '../cards';
import type { DominanceConfig, DominanceState, ResourceState } from '../dominance';
import type { GameEvent } from '../events';
import type { ContinuousEffect, PendingEffect, PendingTrigger } from '../effects';
import type { ActionLogEntry } from '../replay';
import type { ScenarioState, TurnState } from '../game';
import type { ZoneRegistry } from '../zones';
import type { RULE_VERSION } from './version';

export type GameId = string;
export type PlayerId = string;
export type CardId = string;
export type InstanceId = string;
export type EffectId = string;
export type ActionId = string;
export type EventId = string;

export type Phase =
  | 'SETUP'
  | 'MULLIGAN'
  | 'TURN_START'
  | 'DRAW'
  | 'RESOURCE'
  | 'MAIN'
  | 'COMBAT'
  | 'END'
  | 'GAME_OVER';

export type GameStatus = 'SETUP' | 'RUNNING' | 'FINISHED' | 'ABORTED';

export type PlayerKind = 'HUMAN' | 'AI' | 'SCENARIO';

export interface AiMetadata {
  difficulty?: 'EASY' | 'NORMAL' | 'HARD' | 'BOSS';
  strategyId?: string;
  evaluationBias?: Record<string, number>;
}

export interface PlayerState {
  playerId: PlayerId;
  kind: PlayerKind;
  hp: number;
  maxHp: number;
  deck: InstanceId[];
  hand: InstanceId[];
  graveyard: InstanceId[];
  banished: InstanceId[];
  resource: ResourceState;
  dominance: DominanceState;
  flags: Record<string, boolean | number | string>;
  oncePerTurn: Record<string, number>;
  revealedCards: InstanceId[];
  aiMetadata?: AiMetadata;
}

export interface GameState {
  gameId: GameId;
  ruleVersion: typeof RULE_VERSION;
  cardDataVersion: string;
  cardDefinitions?: Record<CardId, CardDefinition>;
  scenarioId?: string;
  turnNumber: number;
  activePlayerId: PlayerId;
  priorityPlayerId: PlayerId | null;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  dominanceConfig: DominanceConfig;
  board: BoardState;
  zones: ZoneRegistry;
  eventQueue: GameEvent[];
  effectStack: PendingEffect[];
  continuousEffects: ContinuousEffect[];
  pendingTriggers: PendingTrigger[];
  actionLog: ActionLogEntry[];
  eventLog: GameEvent[];
  rngSeed: string;
  rngCursor: number;
  winner: PlayerId | null;
  gameStatus: GameStatus;
  turnState: TurnState;
  scenarioState?: ScenarioState;
}
