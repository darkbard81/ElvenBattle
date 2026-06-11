import type { Row, SlotId } from '../board';
import type { CardRuntimeNumberValue } from '../assets/cards';
import type { ActionTarget, GameAction } from '../rules';
import type { CardType } from '../cards';
import type { InstanceId, Phase, PlayerId } from '../core';

export type UiSelection =
  | { type: 'HAND_CARD'; instanceId: InstanceId }
  | { type: 'BOARD_UNIT'; unitId: InstanceId };

export type UiTargetViewModel =
  | { type: 'SLOT'; slotId: SlotId; actionType: 'SUMMON_UNIT' | 'MOVE_UNIT' }
  | { type: 'UNIT'; unitId: InstanceId; actionType: 'ATTACK' }
  | { type: 'PLAYER'; playerId: PlayerId; actionType: 'ATTACK' };

export interface GameViewModel {
  activePlayerId: PlayerId;
  priorityPlayerId: PlayerId | null;
  phase: Phase;
  turnNumber: number;
  players: PlayerPanelViewModel[];
  hand: CardViewModel[];
  opponentHandCount: number;
  boardSlots: BoardSlotViewModel[];
  selected: UiSelection | null;
  legalTargets: UiTargetViewModel[];
  actionLogItems: LogItemViewModel[];
  eventLogItems: LogItemViewModel[];
  result: GameResultViewModel | null;
}

export interface PlayerPanelViewModel {
  playerId: PlayerId;
  kind: string;
  hp: number;
  maxHp: number;
  resource: {
    current: number;
    max: number;
  };
  dominance: {
    used: number;
    limit: number;
    temporaryLimit: number;
    boardValue: number;
    overloaded: boolean;
  };
  deckCount: number;
  handCount: number;
  graveyardCount: number;
  isActive: boolean;
  hasPriority: boolean;
}

export interface CardViewModel {
  instanceId: InstanceId;
  cardId: string;
  name: string;
  type: CardType;
  ownerId: PlayerId;
  controllerId: PlayerId;
  face: 'FRONT' | 'BACK';
  zone: 'HAND' | 'BATTLEFIELD' | 'OTHER';
  runtimeNumbers: CardRuntimeNumberValue[];
  exhausted: boolean;
  summonedThisTurn: boolean;
}

export interface BoardSlotViewModel {
  slotId: SlotId;
  ownerSide: PlayerId;
  row: Row;
  column: number;
  unit: CardViewModel | null;
  isLegalTarget: boolean;
  isSelected: boolean;
}

export interface LogItemViewModel {
  index: number;
  type: string;
  summary: string;
}

export interface GameResultViewModel {
  winner: PlayerId | null;
  status: string;
  reason: string;
}

export interface UiActionResult {
  ok: boolean;
  stateChanged: boolean;
  action: GameAction | null;
  errorCodes: string[];
}

export interface UiActionSearch {
  action: GameAction | null;
  target: UiTargetViewModel | null;
}

export type UiCommand =
  | { type: 'SELECT_HAND_CARD'; instanceId: InstanceId }
  | { type: 'SELECT_BOARD_UNIT'; unitId: InstanceId }
  | { type: 'SELECT_SLOT'; slotId: SlotId }
  | { type: 'SELECT_ATTACK_TARGET'; target: ActionTarget }
  | { type: 'END_PHASE' }
  | { type: 'END_TURN' }
  | { type: 'CLEAR_SELECTION' };
