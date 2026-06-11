import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyAction } from '../src/game';
import {
  createReplayCheckpoints,
  createReplayFile,
  createStateSnapshot,
  runReplay,
} from '../src/replay';
import { addHandCard, createPhase6State } from './phase6-helpers';

describe('replay checkpoints', () => {
  it('creates checkpoints and reports checkpoint mismatches with action indexes', () => {
    const initialState = addHandCard(
      createPhase6State({ phase: 'MAIN' }),
      'summon-checkpoint-1',
      'unit_basic_vanguard',
    );
    const action = {
      actionId: 'summon-checkpoint',
      playerId: 'P1' as const,
      type: 'SUMMON_UNIT' as const,
      payload: {
        instanceId: 'summon-checkpoint-1',
        slotId: createSlotId('P1', 'FRONT', 0),
      },
    };
    const result = applyAction(initialState, action);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const checkpoints = createReplayCheckpoints(initialState, result.state.actionLog, 1);
    const badCheckpoint = { ...createStateSnapshot(result.state, 0), stateHash: 'bad' };
    const replayFile = createReplayFile(initialState, result.state, {
      checkpoints: [checkpoints[0]!, badCheckpoint],
    });
    const replayResult = runReplay(replayFile);

    expect(checkpoints).toHaveLength(2);
    expect(replayResult.ok).toBe(false);
    expect(replayResult.errors[0]).toMatchObject({
      code: 'ERR_REPLAY_CHECKPOINT_MISMATCH',
      actionIndex: 0,
      expectedHash: 'bad',
    });
  });
});
