export const SAVE_SLOT_SCHEMA_VERSION = 1 as const;

export type SaveSlotId = 1 | 2 | 3;

export const SAVE_SLOT_IDS: SaveSlotId[] = [1, 2, 3];

export type CardInstanceZone = 'LEADER' | 'DECK';

export type CardInstance = {
  instanceId: string;
  definitionId: string;
  definitionName: string;
  owner: 'PLAYER';
  zone: CardInstanceZone;
  level: number;
  exp: number;
  baseHp: number;
  currentHp: number;
  baseAttack: number;
  currentAttack: number;
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
