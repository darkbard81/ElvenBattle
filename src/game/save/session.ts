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
      cards: state.deck.cards.map((instance) => createRuntimeCardInstance(instance, cardDefinitionMap)),
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

export type { CardDefinition, SaveSlotState, DeckInstance };
