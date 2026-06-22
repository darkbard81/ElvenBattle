import type { CardDefinition } from './card-catalog';

export const SAVE_SLOT_SCHEMA_VERSION = 1 as const;

export type SaveSlotId = 1 | 2 | 3;

export const SAVE_SLOT_IDS: SaveSlotId[] = [1, 2, 3];

export type CardOwner = 'PLAYER' | 'ENEMY';

export type CardInstanceZone = 'LEADER' | 'DECK';

export type CardInstance = CardDefinition & {
  instanceId: string;
  owner: CardOwner;
  zone: CardInstanceZone;
};

export type DeckInstance = {
  id: string;
  leader: CardInstance;
  cards: CardInstance[];
};

export type SaveSlotState = {
  schemaVersion: typeof SAVE_SLOT_SCHEMA_VERSION;
  slotId: SaveSlotId;
  createdAt: string;
  updatedAt: string;
  saveName: string;
  deck: DeckInstance;
};

export type SaveSlotSummary = {
  slotId: SaveSlotId;
  saveName: string | null;
  updatedAt: string | null;
  deckCardCount: number | null;
  leaderName: string | null;
  isEmpty: boolean;
};

export type SaveSlotsResponse = {
  slots: SaveSlotSummary[];
};
