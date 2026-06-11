import type { CardInstance } from '../cards';
import type { GameState, InstanceId, PlayerId } from '../core';
import type { AiGameView, AiOptions } from './types';

const HIDDEN_CARD_DEFINITION_ID = 'HIDDEN_CARD';

export function createAiView(
  state: GameState,
  playerId: PlayerId,
  options: AiOptions = {},
): AiGameView {
  return {
    playerId,
    state: options.omniscient ? state : maskHiddenInformation(state, playerId),
    omniscient: options.omniscient === true,
  };
}

export function maskHiddenInformation(state: GameState, playerId: PlayerId): GameState {
  const maskedInstances = { ...state.zones.cardInstances };
  const maskedPlayers = { ...state.players };

  for (const [ownerId, player] of Object.entries(state.players)) {
    if (ownerId === playerId) {
      continue;
    }

    const hiddenDeck = player.deck.map((instanceId, index) => {
      const hiddenId = createHiddenInstanceId(ownerId, 'deck', index);
      delete maskedInstances[instanceId];
      maskedInstances[hiddenId] = createHiddenInstance(hiddenId, ownerId, 'DECK');
      return hiddenId;
    });
    const hiddenHand = player.hand.map((instanceId, index) => {
      const hiddenId = createHiddenInstanceId(ownerId, 'hand', index);
      delete maskedInstances[instanceId];
      maskedInstances[hiddenId] = createHiddenInstance(hiddenId, ownerId, 'HAND');
      return hiddenId;
    });

    maskedPlayers[ownerId] = {
      ...player,
      deck: hiddenDeck,
      hand: hiddenHand,
    };
  }

  return {
    ...state,
    players: maskedPlayers,
    zones: {
      ...state.zones,
      cardInstances: maskedInstances,
    },
  };
}

export function canAiSeeCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: InstanceId,
): boolean {
  const instance = state.zones.cardInstances[instanceId];

  if (!instance) {
    return false;
  }

  if (instance.ownerId === playerId) {
    return true;
  }

  if (instance.currentZone.type === 'HAND' || instance.currentZone.type === 'DECK') {
    return state.players[instance.ownerId]?.revealedCards.includes(instanceId) ?? false;
  }

  return true;
}

function createHiddenInstanceId(ownerId: string, zone: 'deck' | 'hand', index: number): InstanceId {
  return `hidden:${ownerId}:${zone}:${index}`;
}

function createHiddenInstance(
  instanceId: InstanceId,
  ownerId: string,
  zoneType: 'DECK' | 'HAND',
): CardInstance {
  return {
    instanceId,
    definitionId: HIDDEN_CARD_DEFINITION_ID,
    ownerId,
    controllerId: ownerId,
    currentZone: {
      type: zoneType,
      ownerId,
    },
    damage: 0,
    statusEffects: [],
    exhausted: false,
    summonedThisTurn: false,
    temporaryModifiers: [],
    attachedEffects: [],
  };
}
