import type { RuntimeCardInstance } from '../save/session';

export type BattleRuntimeZone = 'DECK' | 'HAND' | 'BATTLEFIELD' | 'DROP' | 'EXILE';

export type BattleSide = 'player' | 'enemy';

export type BattlefieldZone = 'FR' | 'FC' | 'FL' | 'BR' | 'BC' | 'BL';

export type BattleSlotId = `${BattleSide}:${BattlefieldZone}`;

export const PLAYER_INITIAL_LEADER_SLOT = 'player:BC' as const satisfies BattleSlotId;

export const ENEMY_INITIAL_LEADER_SLOT = 'enemy:BC' as const satisfies BattleSlotId;

export const INITIAL_HAND_SIZE = 5 as const;

export type BattleCardRuntimeState = {
  card: RuntimeCardInstance;
  side: BattleSide;
  zone: BattleRuntimeZone;
  battlefieldSlot: BattleSlotId | null;
  handIndex: number | null;
  deckIndex: number | null;
};

export type BattleParticipantRuntimeState = {
  side: BattleSide;
  leader: BattleCardRuntimeState;
  deck: BattleCardRuntimeState[];
  hand: BattleCardRuntimeState[];
  drop: BattleCardRuntimeState[];
  exile: BattleCardRuntimeState[];
};

export type BattleRuntimeState = {
  player: BattleParticipantRuntimeState;
  enemy: BattleParticipantRuntimeState;
  battlefield: BattleCardRuntimeState[];
  drop: BattleCardRuntimeState[];
  exile: BattleCardRuntimeState[];
};
