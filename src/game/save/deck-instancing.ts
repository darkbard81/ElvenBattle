import {
  createCardDefinitionMap,
  type CardDefinition,
  type CardDefinitionFile,
} from './card-catalog';
import { createRuntimeId } from './runtime-id';
import type { RuntimeDeckInstance } from './session';
import type { CardInstance, CardOwner, DeckInstance } from './types';

type CreateDeckInstanceOptions = {
  deckId: string;
  cardDefinitions: CardDefinition[];
  owner: CardOwner;
  unitCount: number;
  createId?: () => string;
};

/**
 * 카드 정의 목록을 저장 슬롯과 전투 런타임이 공유할 수 있는 카드 인스턴스 덱으로 만든다.
 * 리더는 정확히 1장이어야 하며, 유닛 카드는 필요한 장수만큼 정의 순서대로 반복 배치한다.
 */
export function createDeckInstanceFromDefinitions(
  options: CreateDeckInstanceOptions,
): DeckInstance {
  const leaderDefinition = findSingleLeaderDefinition(options.cardDefinitions);
  const unitDefinitions = findUnitDefinitions(options.cardDefinitions);
  const createId = options.createId ?? createRuntimeId;

  return {
    id: options.deckId,
    leader: createCardInstance(leaderDefinition, options.owner, 'LEADER', createId),
    cards: takeRepeated(unitDefinitions, options.unitCount).map((definition) =>
      createCardInstance(definition, options.owner, 'DECK', createId),
    ),
  };
}

/**
 * 카드 정의 목록에서 전투 테스트용 런타임 덱을 만든다.
 * 저장 파일을 거치지 않는 적 덱처럼 definition 참조가 즉시 필요한 경우에 사용한다.
 */
export function createRuntimeDeckInstanceFromDefinitions(
  options: CreateDeckInstanceOptions,
): RuntimeDeckInstance {
  const deck = createDeckInstanceFromDefinitions(options);
  const definitions = createCardDefinitionMap(options.cardDefinitions);

  return {
    id: deck.id,
    leader: {
      instance: deck.leader,
      definition: requireDeckDefinition(deck.leader.definitionId, definitions),
    },
    cards: deck.cards.map((instance) => ({
      instance,
      definition: requireDeckDefinition(instance.definitionId, definitions),
    })),
  };
}

/**
 * JSON import 결과를 카드 정의 파일 타입으로 좁힌다.
 * Vite의 JSON import는 구조 검증을 하지 않으므로, 호출부가 명시적으로 데이터 경계를 표시한다.
 */
export function readCardDefinitionFile(value: CardDefinitionFile): CardDefinitionFile {
  return value;
}

function findSingleLeaderDefinition(cardDefinitions: CardDefinition[]): CardDefinition {
  const leaderDefinitions = cardDefinitions.filter((card) => card.type === 'LEADER');

  if (leaderDefinitions.length !== 1) {
    throw new Error(`Expected exactly one LEADER card, got ${leaderDefinitions.length}`);
  }

  return leaderDefinitions[0]!;
}

function findUnitDefinitions(cardDefinitions: CardDefinition[]): CardDefinition[] {
  const unitDefinitions = cardDefinitions.filter((card) => card.type === 'UNIT');
  if (unitDefinitions.length === 0) {
    throw new Error('Expected at least one UNIT card');
  }

  return unitDefinitions;
}

function createCardInstance(
  definition: CardDefinition,
  owner: CardOwner,
  zone: CardInstance['zone'],
  createId: () => string,
): CardInstance {
  const level = readRequiredInteger(definition.level ?? 1, definition.id, 'level');
  const exp = readRequiredInteger(definition.exp ?? 0, definition.id, 'exp');
  const baseHp = readRequiredInteger(definition.hp ?? 0, definition.id, 'hp');
  const baseAttack = readRequiredInteger(definition.attack ?? 0, definition.id, 'attack');

  return {
    instanceId: createId(),
    definitionId: definition.id,
    owner,
    zone,
    level,
    exp,
    currentHp: baseHp,
    currentAttack: baseAttack,
  };
}

function requireDeckDefinition(
  definitionId: string,
  cardDefinitions: Map<string, CardDefinition>,
): CardDefinition {
  const definition = cardDefinitions.get(definitionId);
  if (!definition) {
    throw new Error(`Unknown card definitionId: ${definitionId}`);
  }

  return definition;
}

function readRequiredInteger(value: number, cardId: string, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${fieldName} value for ${cardId}: ${value}`);
  }

  return value;
}

function takeRepeated<T>(items: T[], count: number): T[] {
  const selected: T[] = [];
  for (let index = 0; index < count; index += 1) {
    selected.push(items[index % items.length]!);
  }

  return selected;
}
