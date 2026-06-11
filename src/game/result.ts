import type { GameState } from '../core';
import type { GameEvent } from '../events';
import type { ActionLogEntry } from '../replay';
import type { ValidationResult } from '../rules';

export type ApplyActionResult =
  | {
      ok: true;
      state: GameState;
      events: GameEvent[];
      actionLogEntry: ActionLogEntry;
    }
  | {
      ok: false;
      state: GameState;
      validation: ValidationResult;
    };
