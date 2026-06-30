import { SAVE_SLOT_SCHEMA_VERSION, type SaveSlotId, type SaveSlotState } from './types';
import { CARD_DEFINITIONS } from './card-catalog';
import { createDeckInstanceFromDefinitions } from './deck-instancing';
import { createRuntimeId } from './runtime-id';
import { createDefaultStageProgressState } from '../stage/progress';

type CreateInitialSaveStateOptions = {
  slotId: SaveSlotId;
  projectRoot?: string;
  now?: Date;
};

/**
 * `deck_test.json`을 바탕으로 초기 저장 슬롯 상태를 생성한다.
 * 리더 1장, 전투 카드 29장, 빈 컬렉션과 장착표를 JSON으로 직렬화 가능한 형태로 만든다.
 */
export async function createInitialSaveState(
  options: CreateInitialSaveStateOptions,
): Promise<SaveSlotState> {
  const now = options.now ?? new Date();
  const timestamp = now.toISOString();

  return {
    schemaVersion: SAVE_SLOT_SCHEMA_VERSION,
    slotId: options.slotId,
    createdAt: timestamp,
    updatedAt: timestamp,
    saveName: `Slot ${options.slotId}`,
    deck: createDeckInstanceFromDefinitions({
      deckId: `deck-${options.slotId}-${createRuntimeId()}`,
      cardDefinitions: CARD_DEFINITIONS,
      owner: 'PLAYER',
      unitCount: 29,
    }),
    collection: {
      cards: [],
    },
    equipment: {
      equipped: [],
    },
    stageProgress: createDefaultStageProgressState(),
  };
}
