import type { RuntimeCardInstance } from '../save/session';

export type BattleRuntimeZone = 'DECK' | 'HAND' | 'BATTLEFIELD' | 'DROP' | 'EXILE';

export type BattleSide = 'player' | 'enemy';

export type BattlePhase = 'MAIN' | 'ATTACK' | 'GAME_OVER';

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
  hasMovedThisTurn: boolean;
  hasAttackedThisTurn: boolean;
  hasUsedActiveSkillThisTurn: boolean;
};

export type BattleParticipantRuntimeState = {
  side: BattleSide;
  leader: BattleCardRuntimeState;
  deck: BattleCardRuntimeState[];
  hand: BattleCardRuntimeState[];
  drop: BattleCardRuntimeState[];
  exile: BattleCardRuntimeState[];
};

export type BattleOutcome = {
  winner: BattleSide;
  loser: BattleSide;
  reason: 'LEADER_DEFEATED';
};

export type PlaceBattleAction = {
  type: 'PLACE';
  cardInstanceId: string;
  fromHandIndex: number;
  toSlotId: BattleSlotId;
  dominance: number;
  cost: number;
};

export type MoveBattleAction = {
  type: 'MOVE';
  cardInstanceId: string;
  fromSlotId: BattleSlotId;
  toSlotId: BattleSlotId;
};

export type AttackBattleAction = {
  type: 'ATTACK';
  attackerInstanceId: string;
  targetInstanceId: string;
  fromSlotId: BattleSlotId;
  toSlotId: BattleSlotId;
  attack: number;
};

export type ActiveSkillBattleAction = {
  type: 'ACTIVE_SKILL';
  cardInstanceId: string;
  skillId: string;
};

export type BattleAutomationAction = PlaceBattleAction | MoveBattleAction | AttackBattleAction;

export type BattleTurnEndReason =
  | 'MANUAL'
  | 'STALLED'
  | 'NO_ACTION'
  | 'ACTION_LIMIT';

export type BattleTurnEvent =
  | {
      type: 'TURN_START';
      side: BattleSide;
      drewCardInstanceId: string | null;
      deckRemaining: number;
    }
  | {
      type: 'ACTION';
      side: BattleSide;
      action: BattleAutomationAction;
    }
  | {
      type: 'TURN_END';
      side: BattleSide;
      nextSide: BattleSide;
      reason: BattleTurnEndReason;
    }
  | {
      type: 'ACTION_LIMIT';
      side: BattleSide;
      actionCount: number;
    };

export type BattleAvailableActions = {
  placeActions: PlaceBattleAction[];
  moveActions: MoveBattleAction[];
  activeSkillActions: ActiveSkillBattleAction[];
  attackActions: AttackBattleAction[];
};

export type BattleRuntimeState = {
  currentSide: BattleSide;
  turnNumber: number;
  phase: BattlePhase;
  outcome: BattleOutcome | null;
  player: BattleParticipantRuntimeState;
  enemy: BattleParticipantRuntimeState;
  battlefield: BattleCardRuntimeState[];
  drop: BattleCardRuntimeState[];
  exile: BattleCardRuntimeState[];
};
