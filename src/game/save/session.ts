import {
  SAVE_SLOT_SCHEMA_VERSION,
  type CardInstance,
  type DeckInstance,
  type SaveSlotState,
  type SaveSlotId,
} from './types';
import { CARD_DEFINITIONS, createCardDefinitionMap, type CardDefinition } from './card-catalog';

export type RuntimeCardInstance = {
  instance: CardInstance;
  definition: CardDefinition;
};

export type RuntimeDeckInstance = {
  id: string;
  leader: RuntimeCardInstance;
  cards: RuntimeCardInstance[];
};

export type GameSession = {
  schemaVersion: typeof SAVE_SLOT_SCHEMA_VERSION;
  slotId: SaveSlotId;
  createdAt: string;
  updatedAt: string;
  saveName: string;
  deck: RuntimeDeckInstance;
};

export function createGameSession(
  state: SaveSlotState,
  cardDefinitions: CardDefinition[] = CARD_DEFINITIONS,
): GameSession {
  const cardDefinitionMap = createCardDefinitionMap(cardDefinitions);

  return {
    schemaVersion: state.schemaVersion,
    slotId: state.slotId,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    saveName: state.saveName,
    deck: {
      id: state.deck.id,
      leader: createRuntimeCardInstance(state.deck.leader, cardDefinitionMap),
      cards: state.deck.cards.map((instance) =>
        createRuntimeCardInstance(instance, cardDefinitionMap),
      ),
    },
  };
}

/**
 * 전투 런타임이 들고 있는 카드 definition을 제거하고 저장 슬롯 스키마로 되돌린다.
 * 현재 저장 스키마는 덱 구성과 카드 인스턴스만 보존하므로 손패, 전장 배치, 드롭존 같은 전투 Zone은 포함하지 않는다.
 */
export function createSaveSlotStateFromGameSession(
  session: GameSession,
  options: { now?: Date } = {},
): SaveSlotState {
  return {
    schemaVersion: session.schemaVersion,
    slotId: session.slotId,
    createdAt: session.createdAt,
    updatedAt: (options.now ?? new Date()).toISOString(),
    saveName: session.saveName,
    deck: {
      id: session.deck.id,
      leader: createSavedCardInstance(session.deck.leader.instance, 'LEADER'),
      cards: session.deck.cards.map((card) => createSavedCardInstance(card.instance, 'DECK')),
    },
  };
}

function createRuntimeCardInstance(
  instance: CardInstance,
  cardDefinitions: Map<string, CardDefinition>,
): RuntimeCardInstance {
  const definition = cardDefinitions.get(instance.definitionId);
  if (!definition) {
    throw new Error(`Unknown card definitionId: ${instance.definitionId}`);
  }

  return {
    instance,
    definition,
  };
}

function createSavedCardInstance(instance: CardInstance, zone: CardInstance['zone']): CardInstance {
  return {
    instanceId: instance.instanceId,
    definitionId: instance.definitionId,
    owner: instance.owner,
    zone,
    level: instance.level,
    exp: instance.exp,
    currentHp: instance.currentHp,
    currentAttack: instance.currentAttack,
  };
}

export type { CardDefinition, SaveSlotState, DeckInstance };
