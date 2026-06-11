import type { GameState } from '../core';
import { applyAction } from '../game/action';
import { hashEventLog, hashGameState } from './hash';
import { createStateSnapshot, selectCheckpointForAction, verifyCheckpoint } from './snapshot';
import type {
  ActionLogEntry,
  ReplayFile,
  ReplayRunResult,
  ReplayStepResult,
  ReplayValidationError,
  ReplayValidationResult,
  StateSnapshot,
} from './types';

export function replayActions(
  initialState: GameState,
  actions: readonly ActionLogEntry[],
  options: { checkpoints?: readonly StateSnapshot[] } = {},
): ReplayRunResult {
  const initialStateHash = hashGameState(initialState);
  const steps: ReplayStepResult[] = [];
  const errors: ReplayValidationError[] = [];
  let nextState = initialState;

  for (const entry of actions) {
    const stateHashBefore = hashGameState(nextState);

    if (entry.stateHashBefore !== stateHashBefore) {
      errors.push({
        code: 'ERR_REPLAY_HASH_MISMATCH',
        reason: 'state_hash_before_mismatch',
        actionIndex: entry.index,
        expectedHash: entry.stateHashBefore,
        actualHash: stateHashBefore,
      });
      break;
    }

    const result = applyAction(nextState, entry.action);

    if (!result.ok) {
      errors.push({
        code: 'ERR_REPLAY_ACTION_FAILED',
        reason: result.validation.errors[0]?.code ?? 'action_failed',
        actionIndex: entry.index,
      });
      break;
    }

    const stateHashAfter = hashGameState(result.state);

    steps.push({
      actionIndex: entry.index,
      actionId: entry.action.actionId,
      ok: true,
      stateHashBefore,
      stateHashAfter,
      eventLogHashAfter: hashEventLog(result.state.eventLog),
    });

    if (entry.stateHashAfter && entry.stateHashAfter !== stateHashAfter) {
      errors.push({
        code: 'ERR_REPLAY_HASH_MISMATCH',
        reason: 'state_hash_after_mismatch',
        actionIndex: entry.index,
        expectedHash: entry.stateHashAfter,
        actualHash: stateHashAfter,
      });
      nextState = result.state;
      break;
    }

    const checkpoint = selectCheckpointForAction(options.checkpoints ?? [], entry.index);
    const checkpointError = checkpoint ? verifyCheckpoint(result.state, checkpoint) : null;

    if (checkpointError) {
      errors.push(checkpointError);
      nextState = result.state;
      break;
    }

    nextState = result.state;
  }

  const finalStateHash = hashGameState(nextState);
  const finalEventLogHash = hashEventLog(nextState.eventLog);

  return {
    ok: errors.length === 0,
    initialStateHash,
    finalState: nextState,
    finalStateHash,
    finalEventLogHash,
    steps,
    errors,
  };
}

export function runReplay(replayFile: ReplayFile): ReplayRunResult {
  if (!replayFile.initialState) {
    return {
      ok: false,
      initialStateHash: replayFile.initialStateHash,
      finalState: {} as GameState,
      finalStateHash: '',
      finalEventLogHash: '',
      steps: [],
      errors: [
        {
          code: 'ERR_REPLAY_FILE_INVALID',
          reason: 'missing_initial_state',
        },
      ],
    };
  }

  const result = replayActions(replayFile.initialState, replayFile.actions, {
    checkpoints: replayFile.checkpoints,
  });
  const verification = verifyReplayResult(replayFile, result.finalState);

  return {
    ...result,
    ok: result.ok && verification.ok,
    errors: [...result.errors, ...verification.errors],
  };
}

export function applyReplayAction(
  state: GameState,
  entry: ActionLogEntry,
): { state: GameState; step: ReplayStepResult | null; errors: ReplayValidationError[] } {
  const replayed = replayActions(state, [entry]);

  return {
    state: replayed.finalState,
    step: replayed.steps[0] ?? null,
    errors: replayed.errors,
  };
}

export function verifyReplayResult(
  replayFile: ReplayFile,
  finalState: GameState,
): ReplayValidationResult {
  const errors: ReplayValidationError[] = [];
  const finalStateHash = hashGameState(finalState);
  const finalEventLogHash = hashEventLog(finalState.eventLog);

  if (finalStateHash !== replayFile.finalStateHash) {
    errors.push({
      code: 'ERR_REPLAY_HASH_MISMATCH',
      reason: 'final_state_hash_mismatch',
      expectedHash: replayFile.finalStateHash,
      actualHash: finalStateHash,
    });
  }

  if (finalEventLogHash !== replayFile.finalEventLogHash) {
    errors.push({
      code: 'ERR_REPLAY_EVENT_LOG_MISMATCH',
      reason: 'final_event_log_hash_mismatch',
      expectedHash: replayFile.finalEventLogHash,
      actualHash: finalEventLogHash,
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function createReplayCheckpoints(
  initialState: GameState,
  actions: readonly ActionLogEntry[],
  interval: number,
): StateSnapshot[] {
  const checkpoints: StateSnapshot[] = [createStateSnapshot(initialState, -1)];
  let nextState = initialState;

  for (const entry of actions) {
    const result = applyAction(nextState, entry.action);

    if (!result.ok) {
      break;
    }

    nextState = result.state;

    if (interval > 0 && (entry.index + 1) % interval === 0) {
      checkpoints.push(createStateSnapshot(nextState, entry.index));
    }
  }

  if (checkpoints.at(-1)?.afterActionIndex !== actions.at(-1)?.index) {
    checkpoints.push(createStateSnapshot(nextState, actions.at(-1)?.index ?? -1));
  }

  return checkpoints;
}
