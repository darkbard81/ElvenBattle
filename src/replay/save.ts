import type { GameState } from '../core';
import { hashActionLog, hashEventLog, hashGameState, stableStringify } from './hash';
import type { ReplayValidationError, SaveFile } from './types';
import { SAVE_VERSION } from './types';

export type DeserializeSaveFileResult =
  | { ok: true; saveFile: SaveFile }
  | { ok: false; errors: ReplayValidationError[] };

export function createSaveFile(state: GameState): SaveFile {
  const saveFileBase = {
    saveVersion: SAVE_VERSION,
    savedAtPolicy: 'OMITTED_FOR_DETERMINISM' as const,
    gameId: state.gameId,
    ruleVersion: state.ruleVersion,
    cardDataVersion: state.cardDataVersion,
    stateHash: hashGameState(state),
    state,
    actionLogHash: hashActionLog(state.actionLog),
    eventLogHash: hashEventLog(state.eventLog),
  };

  return state.scenarioId
    ? {
        ...saveFileBase,
        scenarioId: state.scenarioId,
      }
    : saveFileBase;
}

export function serializeSaveFile(stateOrSaveFile: GameState | SaveFile): string {
  const saveFile = isSaveFileLike(stateOrSaveFile)
    ? stateOrSaveFile
    : createSaveFile(stateOrSaveFile);

  return stableStringify(saveFile);
}

export function deserializeSaveFile(serialized: string): DeserializeSaveFileResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [{ code: 'ERR_SAVE_FILE_INVALID', reason: 'invalid_json' }],
    };
  }

  return validateSaveFile(parsed);
}

export function validateSaveFile(input: unknown): DeserializeSaveFileResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ code: 'ERR_SAVE_FILE_INVALID', reason: 'save_file_not_object' }],
    };
  }

  if (input.saveVersion !== SAVE_VERSION) {
    return {
      ok: false,
      errors: [
        {
          code: 'ERR_SAVE_VERSION_UNSUPPORTED',
          reason: 'unsupported_save_version',
        },
      ],
    };
  }

  if (!isRecord(input.state)) {
    return {
      ok: false,
      errors: [{ code: 'ERR_SAVE_FILE_INVALID', reason: 'state_not_object' }],
    };
  }

  const saveFile = input as unknown as SaveFile;
  const actualHash = hashGameState(saveFile.state);

  if (saveFile.stateHash !== actualHash) {
    return {
      ok: false,
      errors: [
        {
          code: 'ERR_SAVE_HASH_MISMATCH',
          reason: 'save_state_hash_mismatch',
          expectedHash: saveFile.stateHash,
          actualHash,
        },
      ],
    };
  }

  return {
    ok: true,
    saveFile,
  };
}

function isSaveFileLike(value: GameState | SaveFile): value is SaveFile {
  return 'saveVersion' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
