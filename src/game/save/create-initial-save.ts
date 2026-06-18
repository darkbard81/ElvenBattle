import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAVE_SLOT_SCHEMA_VERSION,
  type CardInstance,
  type SaveSlotId,
  type SaveSlotState,
} from './types';

type DeckDefinitionFile = {
  version: string;
  cards: CardDefinition[];
};

type CardDefinition = {
  id: string;
  name: string;
  type: string;
  hp?: number;
  attack?: number;
  level?: number;
  exp?: number;
};

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
  const projectRoot = options.projectRoot ?? fileURLToPath(new URL('../../../', import.meta.url));
  const deckDefinition = await readDeckDefinition(projectRoot);
  const leaderDefinitions = deckDefinition.cards.filter((card) => card.type === 'LEADER');

  if (leaderDefinitions.length !== 1) {
    throw new Error(`Expected exactly one LEADER card in deck_test.json, got ${leaderDefinitions.length}`);
  }

  const unitDefinitions = deckDefinition.cards.filter((card) => card.type === 'UNIT');
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

async function readDeckDefinition(projectRoot: string): Promise<DeckDefinitionFile> {
  const deckPath = path.join(projectRoot, 'cards/deck_test.json');
  return JSON.parse(await fs.readFile(deckPath, 'utf8')) as DeckDefinitionFile;
}

function createCardInstance(definition: CardDefinition, zone: 'LEADER' | 'DECK'): CardInstance {
  const level = readRequiredInteger(definition.level ?? 1, definition.id, 'level');
  const exp = readRequiredInteger(definition.exp ?? 0, definition.id, 'exp');
  const baseHp = readRequiredInteger(definition.hp ?? 0, definition.id, 'hp');
  const baseAttack = readRequiredInteger(definition.attack ?? 0, definition.id, 'attack');

  return {
    instanceId: crypto.randomUUID(),
    definitionId: definition.id,
    definitionName: definition.name,
    owner: 'PLAYER',
    zone,
    level,
    exp,
    baseHp,
    currentHp: baseHp,
    baseAttack,
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
