import type { BoardSlot } from '../board';
import { getCardRuntimeNumberValues } from '../assets/cards';
import type { CardDefinition, CardInstance } from '../cards';
import type { GameEvent } from '../events';
import type { GameState, InstanceId, PlayerId } from '../core';
import type { ActionLogEntry } from '../replay';
import { createLegalTargetsForSelection } from './input';
import type {
  BoardSlotViewModel,
  CardViewModel,
  GameResultViewModel,
  GameViewModel,
  LogItemViewModel,
  PlayerPanelViewModel,
  UiSelection,
  UiTargetViewModel,
} from './types';

export interface CreateGameViewModelOptions {
  viewerId: PlayerId;
  selected?: UiSelection | null;
  maxLogItems?: number;
}

export function createGameViewModel(
  state: GameState,
  options: CreateGameViewModelOptions,
): GameViewModel {
  const selected = options.selected ?? null;
  const legalTargets = createLegalTargetsForSelection(state, options.viewerId, selected);
  const maxLogItems = options.maxLogItems ?? 8;

  return {
    activePlayerId: state.activePlayerId,
    priorityPlayerId: state.priorityPlayerId,
    phase: state.phase,
    turnNumber: state.turnNumber,
    players: Object.values(state.players)
      .sort((left, right) => left.playerId.localeCompare(right.playerId))
      .map((player) => createPlayerPanelViewModel(state, player.playerId)),
    hand: createHandViewModels(state, options.viewerId),
    opponentHandCount: Object.values(state.players)
      .filter((player) => player.playerId !== options.viewerId)
      .reduce((sum, player) => sum + player.hand.length, 0),
    boardSlots: createBoardSlotViewModels(state, selected, legalTargets),
    selected,
    legalTargets,
    actionLogItems: createActionLogItems(state.actionLog, maxLogItems),
    eventLogItems: createEventLogItems(state.eventLog, maxLogItems),
    result: createGameResultViewModel(state),
  };
}

export function createCardViewModel(
  state: GameState,
  instanceId: InstanceId,
  face: 'FRONT' | 'BACK',
): CardViewModel | null {
  const instance = state.zones.cardInstances[instanceId];

  if (!instance) {
    return null;
  }

  const definition = state.cardDefinitions?.[instance.definitionId];

  if (!definition && face === 'FRONT') {
    return null;
  }

  return {
    instanceId,
    cardId: face === 'FRONT' ? instance.definitionId : 'hidden-card',
    name: face === 'FRONT' ? getCardName(definition, instance) : 'Hidden Card',
    type: definition?.type ?? 'TOKEN',
    ownerId: instance.ownerId,
    controllerId: instance.controllerId,
    face,
    zone:
      instance.currentZone.type === 'HAND' || instance.currentZone.type === 'BATTLEFIELD'
        ? instance.currentZone.type
        : 'OTHER',
    runtimeNumbers: face === 'FRONT' ? getCardRuntimeNumberValues(state, instanceId) : [],
    exhausted: instance.exhausted,
    summonedThisTurn: instance.summonedThisTurn,
  };
}

function createPlayerPanelViewModel(state: GameState, playerId: PlayerId): PlayerPanelViewModel {
  const player = state.players[playerId];

  if (!player) {
    throw new Error(`Missing player: ${playerId}`);
  }

  return {
    playerId,
    kind: player.kind,
    hp: player.hp,
    maxHp: player.maxHp,
    resource: {
      current: player.resource.current,
      max: player.resource.max,
    },
    dominance: {
      used: player.dominance.used,
      limit: player.dominance.limit,
      temporaryLimit: player.dominance.temporaryLimit,
      boardValue: player.dominance.boardValue,
      overloaded: player.dominance.overloaded,
    },
    deckCount: player.deck.length,
    handCount: player.hand.length,
    graveyardCount: player.graveyard.length,
    isActive: state.activePlayerId === playerId,
    hasPriority: state.priorityPlayerId === playerId,
  };
}

function createHandViewModels(state: GameState, viewerId: PlayerId): CardViewModel[] {
  return (
    state.players[viewerId]?.hand
      .map((instanceId) => createCardViewModel(state, instanceId, 'FRONT'))
      .filter((card): card is CardViewModel => card !== null) ?? []
  );
}

function createBoardSlotViewModels(
  state: GameState,
  selected: UiSelection | null,
  legalTargets: readonly UiTargetViewModel[],
): BoardSlotViewModel[] {
  return Object.values(state.board.slots)
    .sort(compareBoardSlots)
    .map((slot) => {
      const unit = slot.unit ? createCardViewModel(state, slot.unit, 'FRONT') : null;

      return {
        slotId: slot.slotId,
        ownerSide: slot.ownerSide,
        row: slot.row,
        column: slot.column,
        unit,
        isLegalTarget: legalTargets.some(
          (target) => target.type === 'SLOT' && target.slotId === slot.slotId,
        ),
        isSelected:
          selected?.type === 'BOARD_UNIT' && slot.unit !== null && selected.unitId === slot.unit,
      };
    });
}

function createActionLogItems(
  actionLog: readonly ActionLogEntry[],
  maxLogItems: number,
): LogItemViewModel[] {
  return actionLog.slice(-maxLogItems).map((entry) => ({
    index: entry.index,
    type: entry.action.type,
    summary: `${entry.index}: ${entry.action.type}`,
  }));
}

function createEventLogItems(
  eventLog: readonly GameEvent[],
  maxLogItems: number,
): LogItemViewModel[] {
  return eventLog.slice(-maxLogItems).map((event, index) => ({
    index: eventLog.length - eventLog.slice(-maxLogItems).length + index,
    type: event.type,
    summary: event.type,
  }));
}

function createGameResultViewModel(state: GameState): GameResultViewModel | null {
  if (state.phase !== 'GAME_OVER' && state.gameStatus === 'RUNNING') {
    return null;
  }

  const gameEndedEvent = [...state.eventLog].reverse().find((event) => event.type === 'GAME_ENDED');
  const reason =
    typeof gameEndedEvent?.payload === 'object' && gameEndedEvent.payload !== null
      ? String((gameEndedEvent.payload as { reason?: string }).reason ?? state.gameStatus)
      : state.gameStatus;

  return {
    winner: state.winner,
    status: state.gameStatus,
    reason,
  };
}

function getCardName(definition: CardDefinition | undefined, instance: CardInstance): string {
  return definition?.nameKey ?? instance.definitionId;
}

function compareBoardSlots(left: BoardSlot, right: BoardSlot): number {
  return (
    left.ownerSide.localeCompare(right.ownerSide) ||
    left.row.localeCompare(right.row) ||
    left.column - right.column
  );
}
