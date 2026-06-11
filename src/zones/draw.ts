import type { GameState, PlayerId } from '../core';
import { createCardDrawnEvent } from '../events';
import type { GameEvent } from '../events';
import { validationError } from '../rules';
import type { ValidationResult } from '../rules';
import { moveCard, type ZoneMoveResult } from './move';

export type DrawCardResult =
  | {
      ok: true;
      state: GameState;
      events: GameEvent[];
      instanceId: string;
    }
  | {
      ok: false;
      state: GameState;
      validation: ValidationResult;
    };

export type DrawCardsResult =
  | {
      ok: true;
      state: GameState;
      events: GameEvent[];
      instanceIds: string[];
    }
  | {
      ok: false;
      state: GameState;
      validation: ValidationResult;
    };

export function drawCard(state: GameState, playerId: PlayerId): DrawCardResult {
  const player = state.players[playerId];

  if (!player) {
    return {
      ok: false,
      state,
      validation: validationError('ERR_ZONE_MOVE_INVALID', 'error.zone_move_invalid', {
        playerId,
        reason: 'player_not_found',
      }),
    };
  }

  const instanceId = player.deck[0];

  if (!instanceId) {
    return {
      ok: false,
      state,
      validation: validationError('ERR_EMPTY_DECK', 'error.empty_deck', { playerId }),
    };
  }

  const moveResult: ZoneMoveResult = moveCard(
    state,
    instanceId,
    {
      type: 'HAND',
      ownerId: playerId,
    },
    'DRAW',
  );

  if (!moveResult.ok) {
    return moveResult;
  }

  const drawnEvent = createCardDrawnEvent(moveResult.state, playerId, instanceId);

  return {
    ok: true,
    state: {
      ...moveResult.state,
      eventLog: [...moveResult.state.eventLog, drawnEvent],
    },
    events: [moveResult.event, drawnEvent],
    instanceId,
  };
}

export function drawCards(state: GameState, playerId: PlayerId, count: number): DrawCardsResult {
  let nextState = state;
  const events: GameEvent[] = [];
  const instanceIds: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const result = drawCard(nextState, playerId);

    if (!result.ok) {
      return result;
    }

    nextState = result.state;
    events.push(...result.events);
    instanceIds.push(result.instanceId);
  }

  return {
    ok: true,
    state: nextState,
    events,
    instanceIds,
  };
}
