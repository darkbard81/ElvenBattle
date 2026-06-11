import type { CardId, InstanceId, PlayerId } from '../core';

export interface GameConfig {
  playerIds: readonly PlayerId[];
  startingPlayerId: PlayerId;
  startingHp: number;
  startingHandSize: number;
  maxHandSize: number;
  deckSize: number;
  rngSeed: string;
  initialDecks: Record<PlayerId, CardId[]>;
  winConditions?: WinCondition[];
}

export interface TurnState {
  movedUnitIds: string[];
  attackedUnitIds: string[];
  cardsPlayedThisTurn: number;
  turnStartedAtActionIndex: number;
}

export interface ScenarioState {
  scenarioId: string;
  version: string;
  objectiveState: Record<string, boolean | number | string>;
  objectives?: Record<string, ScenarioObjectiveState>;
  bossUnitIds?: InstanceId[];
  winConditions?: WinCondition[];
  winConditionPriority?: WinCondition['type'][];
}

export type WinCondition =
  | { type: 'OPPONENT_HP_ZERO' }
  | { type: 'DECK_OUT_LOSS' }
  | { type: 'TURN_LIMIT'; maxTurns: number; result: 'WIN' | 'LOSS' | 'DRAW_BY_SCORE' }
  | { type: 'BOSS_DEFEATED'; bossUnitId: InstanceId; winnerId: PlayerId }
  | { type: 'PUZZLE_OBJECTIVE'; objectiveId: string; winnerId: PlayerId }
  | { type: 'DOMINANCE_OBJECTIVE'; playerId: PlayerId; threshold: number; turns: number }
  | { type: 'SURRENDER' }
  | { type: 'INVALID_STATE_ABORT' };

export type GameEndReason =
  | 'OPPONENT_HP_ZERO'
  | 'PLAYER_HP_ZERO'
  | 'BOTH_PLAYERS_HP_ZERO'
  | 'DECK_OUT'
  | 'TURN_LIMIT'
  | 'BOSS_DEFEATED'
  | 'PUZZLE_OBJECTIVE'
  | 'DOMINANCE_OBJECTIVE'
  | 'SURRENDER'
  | 'INVALID_STATE_ABORT';

export interface GameEndResult {
  winner: PlayerId | null;
  loser: PlayerId | null;
  reason: GameEndReason;
  condition: WinCondition['type'];
  detail?: Record<string, string | number | boolean | null>;
}

export interface ScenarioObjectiveState {
  objectiveId: string;
  completed: boolean;
  progress?: number;
}
