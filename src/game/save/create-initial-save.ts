import {
  SAVE_SLOT_SCHEMA_VERSION,
  type CardInstance,
  type SaveSlotId,
  type SaveSlotState,
} from './types';
import { CARD_DEFINITIONS, type CardDefinition } from './card-catalog';
import crypto from 'node:crypto';

type CreateInitialSaveStateOptions = {
  slotId: SaveSlotId;
  projectRoot?: string;
  now?: Date;
};

/**
 * `deck_test.json`을 바탕으로 초기 저장 슬롯 상태를 생성한다.
 * 리더 1장과 전투 카드 29장을 JSON으로 직렬화 가능한 형태로 만든다.
 */
export async function createInitialSaveState(
  options: CreateInitialSaveStateOptions,
): Promise<SaveSlotState> {
  const leaderDefinitions = CARD_DEFINITIONS.filter((card) => card.type === 'LEADER');

  if (leaderDefinitions.length !== 1) {
    throw new Error(`Expected exactly one LEADER card in deck_test.json, got ${leaderDefinitions.length}`);
  }

  const unitDefinitions = CARD_DEFINITIONS.filter((card) => card.type === 'UNIT');
  if (unitDefinitions.length === 0) {
    throw new Error('Expected at least one UNIT card in deck_test.json');
  }

  const now = options.now ?? new Date();
  const timestamp = now.toISOString();
  const leaderDefinition = leaderDefinitions[0]!;
  const cards = takeRepeated(unitDefinitions, 29).map((definition) =>
    createCardInstance(definition, 'DECK'),
  );

  return {
    schemaVersion: SAVE_SLOT_SCHEMA_VERSION,
    slotId: options.slotId,
    createdAt: timestamp,
    updatedAt: timestamp,
    saveName: `Slot ${options.slotId}`,
    deck: {
      id: `deck-${options.slotId}-${crypto.randomUUID()}`,
      leader: createCardInstance(leaderDefinition, 'LEADER'),
      cards,
    },
  };
}

function createCardInstance(definition: CardDefinition, zone: 'LEADER' | 'DECK'): CardInstance {
  const level = readRequiredInteger(definition.level ?? 1, definition.id, 'level');
  const exp = readRequiredInteger(definition.exp ?? 0, definition.id, 'exp');
  const baseHp = readRequiredInteger(definition.hp ?? 0, definition.id, 'hp');
  const baseAttack = readRequiredInteger(definition.attack ?? 0, definition.id, 'attack');

  return {
    instanceId: crypto.randomUUID(),
    definitionId: definition.id,
    owner: 'PLAYER',
    zone,
    level,
    exp,
    currentHp: baseHp,
    currentAttack: baseAttack,
  };
}

function readRequiredInteger(value: number, cardId: string, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${fieldName} value for ${cardId}: ${value}`);
  }

  return value;
}

function takeRepeated<T>(items: T[], count: number): T[] {
  const selected: T[] = [];
  for (let index = 0; index < count; index += 1) {
    selected.push(items[index % items.length]!);
  }

  return selected;
}
