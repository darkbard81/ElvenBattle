import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyAction } from '../src/game';
import { createReplayFile, hashEventLog, hashGameState, validateReplayFile } from '../src/replay';
import { addHandCard, createPhase6State } from './phase6-helpers';

describe('replay file', () => {
  function createReplayWithOneAction() {
    const initialState = addHandCard(
      createPhase6State({ phase: 'MAIN' }),
      'summon-replay-1',
      'unit_basic_vanguard',
    );
    const result = applyAction(initialState, {
      actionId: 'summon-replay',
      playerId: 'P1',
      type: 'SUMMON_UNIT',
      payload: {
        instanceId: 'summon-replay-1',
        slotId: createSlotId('P1', 'FRONT', 0),
      },
    });

    if (!result.ok) {
      throw new Error('Failed to build replay fixture.');
    }

    return {
      initialState,
      finalState: result.state,
      replayFile: createReplayFile(initialState, result.state),
    };
  }

  it('creates and validates a replay file with state and event hashes', () => {
    const { initialState, finalState, replayFile } = createReplayWithOneAction();

    expect(replayFile.initialStateHash).toBe(hashGameState(initialState));
    expect(replayFile.finalStateHash).toBe(hashGameState(finalState));
    expect(replayFile.finalEventLogHash).toBe(hashEventLog(finalState.eventLog));
    expect(replayFile.actions[0]?.stateHashBefore).toBe(hashGameState(initialState));
    expect(replayFile.actions[0]?.stateHashAfter).toBeDefined();
    expect(validateReplayFile(replayFile).ok).toBe(true);
  });

  it('rejects replay files with non-sequential action indexes', () => {
    const { replayFile } = createReplayWithOneAction();
    const result = validateReplayFile({
      ...replayFile,
      actions: [{ ...replayFile.actions[0], index: 99 }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('ERR_REPLAY_FILE_INVALID');
  });
});
