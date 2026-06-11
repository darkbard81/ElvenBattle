import { describe, expect, it } from 'vitest';
import { hashActionLog, hashGameState, stableStringify } from '../src/replay';
import { createTestGameState } from './helpers/game-state';

describe('replay hash', () => {
  it('stableStringify sorts object keys and removes undefined fields', () => {
    expect(stableStringify({ b: 2, a: 1, c: undefined })).toBe(stableStringify({ a: 1, b: 2 }));
  });

  it('hashes equivalent game states consistently and changes for rule state changes', () => {
    const state = createTestGameState();
    const sameStateDifferentObjectOrder = {
      ...state,
      players: {
        P2: state.players.P2!,
        P1: state.players.P1!,
      },
    };
    const damagedState = {
      ...state,
      players: {
        ...state.players,
        P2: { ...state.players.P2!, hp: 29 },
      },
    };

    expect(hashGameState(sameStateDifferentObjectOrder)).toBe(hashGameState(state));
    expect(hashGameState(damagedState)).not.toBe(hashGameState(state));
  });

  it('ignores clientTimestamp when hashing action logs', () => {
    const baseEntry = {
      index: 0,
      accepted: true,
      stateHashBefore: 'before',
      stateHashAfter: 'after',
      action: {
        actionId: 'end-phase',
        playerId: 'P1',
        type: 'END_PHASE' as const,
        payload: {},
        clientTimestamp: 1,
      },
    };
    const changedTimestampEntry = {
      ...baseEntry,
      action: {
        ...baseEntry.action,
        clientTimestamp: 999,
      },
    };

    expect(hashActionLog([baseEntry])).toBe(hashActionLog([changedTimestampEntry]));
  });
});
