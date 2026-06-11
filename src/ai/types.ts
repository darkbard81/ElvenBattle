import type { GameState, PlayerId } from '../core';
import type { ReplayFile } from '../replay';
import type { GameAction, RuleError } from '../rules';

export interface AiOptions {
  omniscient?: boolean;
}

export interface AiEvaluationOptions extends AiOptions {
  weights?: Partial<AiEvaluationWeights>;
}

export interface AiSimulationOptions extends AiOptions {
  createReplayFile?: boolean;
  initialState?: GameState;
}

export interface AiChooseOptions extends AiEvaluationOptions {
  includeDebug?: boolean;
}

export interface AiTurnOptions extends AiChooseOptions {
  maxActionsPerTurn?: number;
}

export interface AiGameSimulationOptions extends AiTurnOptions {
  maxTurns?: number;
  maxActions?: number;
  createReplayFile?: boolean;
}

export interface AiBatchSimulationOptions extends AiGameSimulationOptions {
  maxGames?: number;
}

export interface AiEvaluationWeights {
  win: number;
  loss: number;
  hpDelta: number;
  unitCountDelta: number;
  frontUnit: number;
  backUnit: number;
  attackDelta: number;
  healthDelta: number;
  handDelta: number;
  resourceAvailable: number;
  dominanceBoardValueDelta: number;
  dominanceAvailable: number;
}

export interface AiActionCandidate {
  action: GameAction;
  source: 'RULES' | 'FALLBACK_END_PHASE' | 'FALLBACK_END_TURN';
  score?: number;
  reason?: string;
}

export interface AiEvaluation {
  playerId: PlayerId;
  score: number;
  breakdown: Record<string, number>;
}

export interface AiScoredAction extends AiActionCandidate {
  score: number;
  evaluation: AiEvaluation;
  simulation: AiSimulationResult;
}

export interface AiDecision {
  playerId: PlayerId;
  action: GameAction | null;
  candidates: AiActionCandidate[];
  evaluation: AiEvaluation;
  scoredCandidates: AiScoredAction[];
}

export interface AiSimulationResult {
  ok: boolean;
  state: GameState;
  action: GameAction;
  errors: RuleError[];
  stateHashBefore: string;
  stateHashAfter: string;
}

export interface AiStepResult {
  ok: boolean;
  state: GameState;
  decision: AiDecision;
  action: GameAction | null;
  errors: string[];
}

export interface AiTurnResult {
  ok: boolean;
  finalState: GameState;
  actions: GameAction[];
  decisions: AiDecision[];
  errors: string[];
}

export interface AiGameSimulationResult {
  ok: boolean;
  finalState: GameState;
  actions: GameAction[];
  winner: PlayerId | null;
  turnCount: number;
  actionCount: number;
  replayFile?: ReplayFile;
  errors: string[];
}

export interface AiBatchSimulationResult {
  results: AiGameSimulationResult[];
  summary: AiSimulationSummary;
}

export interface AiSimulationSummary {
  games: number;
  completedGames: number;
  winsByPlayer: Record<PlayerId, number>;
  draws: number;
  averageTurns: number;
  averageActions: number;
}

export interface AiGameView {
  playerId: PlayerId;
  state: GameState;
  omniscient: boolean;
}
