import { BOARD_COLUMNS, BOARD_ROWS, findUnitSlot, type SlotId } from '../board';
import type { CardDefinition } from '../cards';
import type { GameState, InstanceId, PlayerId } from '../core';
import { getDefendingBackSlot, getDefendingFrontSlot, validateAttacker } from '../battle';
import type { ActionTarget, AttackPayload, GameAction } from '../rules';
import { simulateAction } from './simulate';
import type { AiActionCandidate, AiOptions } from './types';

export function legalActions(
  state: GameState,
  playerId: PlayerId,
  options: AiOptions = {},
): AiActionCandidate[] {
  if (state.gameStatus !== 'RUNNING' || state.phase === 'GAME_OVER') {
    return [];
  }

  if (state.priorityPlayerId !== playerId) {
    return [];
  }

  const candidates = [
    ...generateSummonActions(state, playerId),
    ...generateMoveActions(state, playerId),
    ...generateAttackActions(state, playerId),
    ...generatePhaseActions(state, playerId),
  ];

  return filterLegalActions(state, withDeterministicActionIds(candidates), options);
}

export function generateSummonActions(state: GameState, playerId: PlayerId): AiActionCandidate[] {
  if (state.phase !== 'MAIN') {
    return [];
  }

  const player = state.players[playerId];

  if (!player) {
    return [];
  }

  const candidates: AiActionCandidate[] = [];
  const emptySlots = getOwnEmptySlots(state, playerId);

  for (const instanceId of player.hand) {
    const definition = getDefinition(state, instanceId);

    if (!definition || definition.type !== 'UNIT') {
      continue;
    }

    for (const slotId of emptySlots) {
      candidates.push({
        action: {
          actionId: '',
          playerId,
          type: 'SUMMON_UNIT',
          payload: {
            instanceId,
            slotId,
          },
        },
        source: 'RULES',
        reason: 'summon hand unit to empty own slot',
      });
    }
  }

  return candidates;
}

export function generateMoveActions(state: GameState, playerId: PlayerId): AiActionCandidate[] {
  if (state.phase !== 'MAIN') {
    return [];
  }

  const candidates: AiActionCandidate[] = [];
  const emptySlots = getOwnEmptySlots(state, playerId);
  const ownUnits = Object.values(state.board.slots)
    .filter((slot) => slot.ownerSide === playerId && slot.unit !== null)
    .map((slot) => slot.unit)
    .filter((unitId): unitId is InstanceId => typeof unitId === 'string')
    .sort();

  for (const unitId of ownUnits) {
    const fromSlot = findUnitSlot(state.board, unitId);

    if (!fromSlot) {
      continue;
    }

    for (const slotId of emptySlots) {
      if (slotId === fromSlot.slotId) {
        continue;
      }

      candidates.push({
        action: {
          actionId: '',
          playerId,
          type: 'MOVE_UNIT',
          payload: {
            unitId,
            toSlotId: slotId,
          },
        },
        source: 'RULES',
        reason: 'move own unit to empty own slot',
      });
    }
  }

  return candidates;
}

export function generateAttackActions(state: GameState, playerId: PlayerId): AiActionCandidate[] {
  if (state.phase !== 'COMBAT') {
    return [];
  }

  const candidates: AiActionCandidate[] = [];
  const opponentIds = Object.keys(state.players)
    .filter((id) => id !== playerId)
    .sort();
  const attackers = Object.values(state.board.slots)
    .filter((slot) => slot.ownerSide === playerId && slot.unit !== null)
    .map((slot) => slot.unit)
    .filter((unitId): unitId is InstanceId => typeof unitId === 'string')
    .sort();

  for (const attackerId of attackers) {
    const baseAction = createAttackAction(playerId, attackerId, {
      type: 'PLAYER',
      playerId: opponentIds[0] ?? playerId,
    });

    if (!validateAttacker(state, baseAction).ok) {
      continue;
    }

    for (const opponentId of opponentIds) {
      for (const target of getAttackTargetsForOpponent(state, opponentId)) {
        candidates.push({
          action: createAttackAction(playerId, attackerId, target),
          source: 'RULES',
          reason: 'attack legal target',
        });
      }
    }
  }

  return candidates;
}

export function generatePhaseActions(state: GameState, playerId: PlayerId): AiActionCandidate[] {
  if (state.phase === 'MAIN' || state.phase === 'COMBAT') {
    return [
      {
        action: {
          actionId: '',
          playerId,
          type: 'END_PHASE',
          payload: {},
        },
        source: 'FALLBACK_END_PHASE',
        reason: 'advance to next phase',
      },
    ];
  }

  if (state.phase === 'END') {
    return [
      {
        action: {
          actionId: '',
          playerId,
          type: 'END_TURN',
          payload: {},
        },
        source: 'FALLBACK_END_TURN',
        reason: 'end current turn',
      },
    ];
  }

  return [];
}

export function filterLegalActions(
  state: GameState,
  candidates: readonly AiActionCandidate[],
  options: AiOptions = {},
): AiActionCandidate[] {
  return candidates.filter((candidate) => simulateAction(state, candidate.action, options).ok);
}

function withDeterministicActionIds(candidates: readonly AiActionCandidate[]): AiActionCandidate[] {
  return candidates.map((candidate, index) => ({
    ...candidate,
    action: {
      ...candidate.action,
      actionId: `ai:${candidate.action.playerId}:${candidate.action.type}:${index
        .toString()
        .padStart(4, '0')}`,
    },
  }));
}

function getOwnEmptySlots(state: GameState, playerId: PlayerId): SlotId[] {
  return Object.values(state.board.slots)
    .filter((slot) => slot.ownerSide === playerId && slot.unit === null)
    .sort(compareSlots)
    .map((slot) => slot.slotId);
}

function getDefinition(state: GameState, instanceId: InstanceId): CardDefinition | undefined {
  const instance = state.zones.cardInstances[instanceId];

  return instance ? state.cardDefinitions?.[instance.definitionId] : undefined;
}

function getAttackTargetsForOpponent(state: GameState, opponentId: PlayerId): ActionTarget[] {
  const targets: ActionTarget[] = [];

  for (const column of BOARD_COLUMNS) {
    const frontUnit = getDefendingFrontSlot(state.board, opponentId, column)?.unit;
    const backUnit = getDefendingBackSlot(state.board, opponentId, column)?.unit;

    if (frontUnit) {
      targets.push({ type: 'UNIT', unitId: frontUnit });
    }

    if (backUnit) {
      targets.push({ type: 'UNIT', unitId: backUnit });
    }

    targets.push({ type: 'PLAYER', playerId: opponentId });
  }

  return targets.filter((target, index, allTargets) => {
    const key = JSON.stringify(target);
    const firstIndex = allTargets.findIndex((candidate) => JSON.stringify(candidate) === key);

    return firstIndex === index;
  });
}

function createAttackAction(
  playerId: PlayerId,
  attackerId: InstanceId,
  target: ActionTarget,
): GameAction<AttackPayload> {
  return {
    actionId: '',
    playerId,
    type: 'ATTACK',
    payload: {
      attackerId,
      target,
    },
  };
}

function compareSlots(
  left: { row: string; column: number; slotId: string },
  right: { row: string; column: number; slotId: string },
): number {
  const leftRow = BOARD_ROWS.indexOf(left.row as (typeof BOARD_ROWS)[number]);
  const rightRow = BOARD_ROWS.indexOf(right.row as (typeof BOARD_ROWS)[number]);

  return (
    leftRow - rightRow || left.column - right.column || left.slotId.localeCompare(right.slotId)
  );
}
