import type { GameState } from '../core';
import { hashGameState } from './hash';
import type { ReplayValidationError, StateSnapshot } from './types';

export function createStateSnapshot(state: GameState, afterActionIndex: number): StateSnapshot {
  return {
    afterActionIndex,
    turnNumber: state.turnNumber,
    phase: state.phase,
    stateHash: hashGameState(state),
  };
}

export function verifyCheckpoint(
  state: GameState,
  snapshot: StateSnapshot,
): ReplayValidationError | null {
  const actualHash = hashGameState(state);

  if (actualHash === snapshot.stateHash) {
    return null;
  }

  return {
    code: 'ERR_REPLAY_CHECKPOINT_MISMATCH',
    reason: 'checkpoint_hash_mismatch',
    actionIndex: snapshot.afterActionIndex,
    expectedHash: snapshot.stateHash,
    actualHash,
  };
}

export function selectCheckpointForAction(
  checkpoints: readonly StateSnapshot[],
  actionIndex: number,
): StateSnapshot | null {
  return checkpoints.find((checkpoint) => checkpoint.afterActionIndex === actionIndex) ?? null;
}
