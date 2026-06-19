import type { RuntimeCardInstance } from '../save/session';

export type BattleRuntimeZone = 'DECK' | 'HAND' | 'BATTLEFIELD' | 'DROP';

export type BattlefieldSlot = 'FR' | 'FC' | 'FL' | 'BR' | 'BC' | 'BL';

export const BATTLEFIELD_SLOT_ROWS = [
  ['FR', 'FC', 'FL'],
  ['BR', 'BC', 'BL'],
] as const satisfies readonly (readonly BattlefieldSlot[])[];

export const INITIAL_HAND_SIZE = 5 as const;

export type BattleCardRuntimeState = {
  card: RuntimeCardInstance;
  zone: BattleRuntimeZone;
  battlefieldSlot: BattlefieldSlot | null;
  handIndex: number | null;
  deckIndex: number | null;
};

export type BattleRuntimeState = {
  leader: BattleCardRuntimeState;
  deck: BattleCardRuntimeState[];
  hand: BattleCardRuntimeState[];
  battlefield: BattleCardRuntimeState[];
  drop: BattleCardRuntimeState[];
};
