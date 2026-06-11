import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyAction } from '../src/game';
import { createReplayFile, runReplay } from '../src/replay';
import { addHandCard, createPhase6State } from './phase6-helpers';

function createSummonReplay() {
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

  return createReplayFile(initialState, result.state);
}

describe('replay runner', () => {
  it('replays accepted action logs and verifies the final hash', () => {
    const replayFile = createSummonReplay();
    const result = runReplay(replayFile);

    expect(result.ok).toBe(true);
    expect(result.finalStateHash).toBe(replayFile.finalStateHash);
    expect(result.finalEventLogHash).toBe(replayFile.finalEventLogHash);
    expect(result.finalState.eventLog.at(-1)?.type).toBe('DOMINANCE_CHANGED');
  });

  it('detects changed action payloads as replay failures', () => {
    const replayFile = createSummonReplay();
    const result = runReplay({
      ...replayFile,
      actions: [
        {
          ...replayFile.actions[0]!,
          action: {
            ...replayFile.actions[0]!.action,
            payload: {
              instanceId: 'summon-replay-1',
              slotId: createSlotId('P1', 'BACK', 2),
            },
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('ERR_REPLAY_HASH_MISMATCH');
  });
});
