import type { GameState } from '../core';
import type { GameEvent } from '../events';
import type { ValidationResult } from '../rules';

export interface ProcessEffectsOptions {
  maxIterations?: number;
}

export type EffectResolutionStatus = 'RESOLVED' | 'SKIPPED' | 'FAILED';

export interface ProcessEffectsResult {
  ok: boolean;
  state: GameState;
  events: GameEvent[];
  validation?: ValidationResult;
}

export interface ResolveEffectResult {
  ok: boolean;
  state: GameState;
  events: GameEvent[];
  status: EffectResolutionStatus;
  validation?: ValidationResult;
}
