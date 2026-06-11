import { describe, expect, it } from 'vitest';
import { createSaveFile, deserializeSaveFile, serializeSaveFile } from '../src/replay';
import { createTestGameState } from './helpers/game-state';

describe('save file', () => {
  it('serializes and deserializes with the same state hash', () => {
    const state = createTestGameState();
    const saveFile = createSaveFile(state);
    const result = deserializeSaveFile(serializeSaveFile(saveFile));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.saveFile.stateHash).toBe(saveFile.stateHash);
    expect(result.saveFile.state).toEqual(state);
  });

  it('rejects unsupported save versions and hash mismatches', () => {
    const saveFile = createSaveFile(createTestGameState());
    const badVersion = deserializeSaveFile(
      JSON.stringify({ ...saveFile, saveVersion: 'save-v999' }),
    );
    const badHash = deserializeSaveFile(JSON.stringify({ ...saveFile, stateHash: 'bad' }));

    expect(badVersion.ok).toBe(false);
    expect(badVersion.ok ? undefined : badVersion.errors[0]?.code).toBe(
      'ERR_SAVE_VERSION_UNSUPPORTED',
    );
    expect(badHash.ok).toBe(false);
    expect(badHash.ok ? undefined : badHash.errors[0]?.code).toBe('ERR_SAVE_HASH_MISMATCH');
  });
});
