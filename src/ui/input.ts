import { legalActions } from '../ai';
import type { GameState, PlayerId } from '../core';
import { applyAction } from '../game';
import type {
  ActionTarget,
  AttackPayload,
  GameAction,
  MoveUnitPayload,
  SummonUnitPayload,
} from '../rules';
import type { SlotId } from '../board';
import type { UiActionResult, UiActionSearch, UiSelection, UiTargetViewModel } from './types';

export function createLegalTargetsForSelection(
  state: GameState,
  playerId: PlayerId,
  selection: UiSelection | null,
): UiTargetViewModel[] {
  if (!selection) {
    return [];
  }

  return legalActions(state, playerId).flatMap((candidate) => {
    if (selection.type === 'HAND_CARD' && candidate.action.type === 'SUMMON_UNIT') {
      const payload = candidate.action.payload as SummonUnitPayload;

      return payload.instanceId === selection.instanceId
        ? [{ type: 'SLOT', slotId: payload.slotId, actionType: 'SUMMON_UNIT' as const }]
        : [];
    }

    if (selection.type === 'BOARD_UNIT' && candidate.action.type === 'MOVE_UNIT') {
      const payload = candidate.action.payload as MoveUnitPayload;

      return payload.unitId === selection.unitId
        ? [{ type: 'SLOT', slotId: payload.toSlotId, actionType: 'MOVE_UNIT' as const }]
        : [];
    }

    if (selection.type === 'BOARD_UNIT' && candidate.action.type === 'ATTACK') {
      const payload = candidate.action.payload as AttackPayload;

      if (payload.attackerId !== selection.unitId) {
        return [];
      }

      return [toAttackTargetViewModel(payload.target)];
    }

    return [];
  });
}

export function findUiActionForSlot(
  state: GameState,
  playerId: PlayerId,
  selection: UiSelection | null,
  slotId: SlotId,
): UiActionSearch {
  if (!selection) {
    return {
      action: null,
      target: null,
    };
  }

  const match = legalActions(state, playerId).find((candidate) => {
    if (selection.type === 'HAND_CARD' && candidate.action.type === 'SUMMON_UNIT') {
      const payload = candidate.action.payload as SummonUnitPayload;

      return payload.instanceId === selection.instanceId && payload.slotId === slotId;
    }

    if (selection.type === 'BOARD_UNIT' && candidate.action.type === 'MOVE_UNIT') {
      const payload = candidate.action.payload as MoveUnitPayload;

      return payload.unitId === selection.unitId && payload.toSlotId === slotId;
    }

    return false;
  });

  return {
    action: match?.action ?? null,
    target: match
      ? { type: 'SLOT', slotId, actionType: match.action.type as 'SUMMON_UNIT' | 'MOVE_UNIT' }
      : null,
  };
}

export function findUiActionForAttackTarget(
  state: GameState,
  playerId: PlayerId,
  selection: UiSelection | null,
  target: ActionTarget,
): UiActionSearch {
  if (selection?.type !== 'BOARD_UNIT') {
    return {
      action: null,
      target: null,
    };
  }

  const targetKey = JSON.stringify(target);
  const match = legalActions(state, playerId).find((candidate) => {
    if (candidate.action.type !== 'ATTACK') {
      return false;
    }

    const payload = candidate.action.payload as AttackPayload;

    return payload.attackerId === selection.unitId && JSON.stringify(payload.target) === targetKey;
  });

  return {
    action: match?.action ?? null,
    target: match ? toAttackTargetViewModel(target) : null,
  };
}

export function createPhaseButtonAction(
  state: GameState,
  playerId: PlayerId,
  type: 'END_PHASE' | 'END_TURN',
): GameAction | null {
  return (
    legalActions(state, playerId).find((candidate) => candidate.action.type === type)?.action ??
    null
  );
}

export function applyUiAction(state: GameState, action: GameAction | null): UiActionResult {
  if (!action) {
    return {
      ok: false,
      stateChanged: false,
      action: null,
      errorCodes: ['UI_ACTION_NOT_AVAILABLE'],
    };
  }

  const result = applyAction(state, action);

  if (!result.ok) {
    return {
      ok: false,
      stateChanged: false,
      action,
      errorCodes: result.validation.errors.map((error) => error.code),
    };
  }

  return {
    ok: true,
    stateChanged: result.state !== state,
    action,
    errorCodes: [],
  };
}

export function submitUiAction(
  state: GameState,
  action: GameAction | null,
): { state: GameState; result: UiActionResult } {
  if (!action) {
    return {
      state,
      result: applyUiAction(state, null),
    };
  }

  const result = applyAction(state, action);

  if (!result.ok) {
    return {
      state,
      result: {
        ok: false,
        stateChanged: false,
        action,
        errorCodes: result.validation.errors.map((error) => error.code),
      },
    };
  }

  return {
    state: result.state,
    result: {
      ok: true,
      stateChanged: result.state !== state,
      action,
      errorCodes: [],
    },
  };
}

function toAttackTargetViewModel(target: ActionTarget): UiTargetViewModel {
  if (target.type === 'UNIT') {
    return {
      type: 'UNIT',
      unitId: target.unitId,
      actionType: 'ATTACK',
    };
  }

  return {
    type: 'PLAYER',
    playerId: target.playerId,
    actionType: 'ATTACK',
  };
}
