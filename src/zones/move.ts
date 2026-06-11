import type { GameState } from '../core';
import { createCardMovedEvent } from '../events';
import type { GameEvent } from '../events';
import { validationError } from '../rules';
import type { ValidationResult } from '../rules';
import type { CardMoveRecord, ZoneMoveReason, ZoneRef } from './types';

export type ZoneMoveResult =
  | {
      ok: true;
      state: GameState;
      event: GameEvent<CardMoveRecord>;
      record: CardMoveRecord;
    }
  | {
      ok: false;
      state: GameState;
      validation: ValidationResult;
    };

export function moveCard(
  state: GameState,
  instanceId: string,
  to: ZoneRef,
  reason: ZoneMoveReason,
): ZoneMoveResult {
  const instance = state.zones.cardInstances[instanceId];

  if (!instance) {
    return {
      ok: false,
      state,
      validation: validationError('ERR_CARD_INSTANCE_NOT_FOUND', 'error.card_instance_not_found', {
        instanceId,
      }),
    };
  }

  const from = instance.currentZone;
  const record: CardMoveRecord = {
    instanceId,
    from,
    to,
    reason,
  };
  const updatedInstance = {
    ...instance,
    currentZone: to,
  };
  const nextStateBeforeEvent = applyZoneMembership(
    {
      ...state,
      zones: {
        ...state.zones,
        cardInstances: {
          ...state.zones.cardInstances,
          [instanceId]: updatedInstance,
        },
      },
    },
    instanceId,
    from,
    to,
  );
  const event = createCardMovedEvent(nextStateBeforeEvent, record);

  return {
    ok: true,
    state: {
      ...nextStateBeforeEvent,
      eventLog: [...nextStateBeforeEvent.eventLog, event],
    },
    event,
    record,
  };
}

function applyZoneMembership(
  state: GameState,
  instanceId: string,
  from: ZoneRef,
  to: ZoneRef,
): GameState {
  const withoutFrom = removeFromZone(state, instanceId, from);

  return addToZone(withoutFrom, instanceId, to);
}

function removeFromZone(state: GameState, instanceId: string, from: ZoneRef): GameState {
  if (!from.ownerId) {
    if (from.type === 'STACK') {
      return {
        ...state,
        zones: {
          ...state.zones,
          stack: state.zones.stack.filter((id) => id !== instanceId),
        },
      };
    }

    if (from.type === 'TEMPORARY') {
      return {
        ...state,
        zones: {
          ...state.zones,
          temporary: state.zones.temporary.filter((id) => id !== instanceId),
        },
      };
    }

    return state;
  }

  const player = state.players[from.ownerId];

  if (!player) {
    return state;
  }

  const updatedPlayer = {
    ...player,
    deck: from.type === 'DECK' ? player.deck.filter((id) => id !== instanceId) : player.deck,
    hand: from.type === 'HAND' ? player.hand.filter((id) => id !== instanceId) : player.hand,
    graveyard:
      from.type === 'GRAVEYARD'
        ? player.graveyard.filter((id) => id !== instanceId)
        : player.graveyard,
    banished:
      from.type === 'BANISHED'
        ? player.banished.filter((id) => id !== instanceId)
        : player.banished,
    revealedCards:
      from.type === 'REVEALED'
        ? player.revealedCards.filter((id) => id !== instanceId)
        : player.revealedCards,
  };
  const revealedForOwner = state.zones.revealed[from.ownerId] ?? [];

  return {
    ...state,
    players: {
      ...state.players,
      [from.ownerId]: updatedPlayer,
    },
    zones: {
      ...state.zones,
      revealed:
        from.type === 'REVEALED'
          ? {
              ...state.zones.revealed,
              [from.ownerId]: revealedForOwner.filter((id) => id !== instanceId),
            }
          : state.zones.revealed,
    },
  };
}

function addToZone(state: GameState, instanceId: string, to: ZoneRef): GameState {
  if (!to.ownerId) {
    if (to.type === 'STACK') {
      return {
        ...state,
        zones: {
          ...state.zones,
          stack: [...state.zones.stack, instanceId],
        },
      };
    }

    if (to.type === 'TEMPORARY') {
      return {
        ...state,
        zones: {
          ...state.zones,
          temporary: [...state.zones.temporary, instanceId],
        },
      };
    }

    return state;
  }

  const player = state.players[to.ownerId];

  if (!player) {
    return state;
  }

  const updatedPlayer = {
    ...player,
    deck: to.type === 'DECK' ? [...player.deck, instanceId] : player.deck,
    hand: to.type === 'HAND' ? [...player.hand, instanceId] : player.hand,
    graveyard: to.type === 'GRAVEYARD' ? [...player.graveyard, instanceId] : player.graveyard,
    banished: to.type === 'BANISHED' ? [...player.banished, instanceId] : player.banished,
    revealedCards:
      to.type === 'REVEALED' ? [...player.revealedCards, instanceId] : player.revealedCards,
  };
  const revealedForOwner = state.zones.revealed[to.ownerId] ?? [];

  return {
    ...state,
    players: {
      ...state.players,
      [to.ownerId]: updatedPlayer,
    },
    zones: {
      ...state.zones,
      revealed:
        to.type === 'REVEALED'
          ? {
              ...state.zones.revealed,
              [to.ownerId]: [...revealedForOwner, instanceId],
            }
          : state.zones.revealed,
    },
  };
}
