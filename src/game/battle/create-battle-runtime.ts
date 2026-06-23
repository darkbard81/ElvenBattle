import darkDeckDefinitionData from '../../../cards/deck_dark.json';
import type { GameSession, RuntimeCardInstance } from '../save/session';
import {
  createRuntimeDeckInstanceFromDefinitions,
  readCardDefinitionFile,
} from '../save/deck-instancing';
import {
  ENEMY_INITIAL_LEADER_SLOT,
  INITIAL_HAND_SIZE,
  PLAYER_INITIAL_LEADER_SLOT,
  type BattleCardRuntimeState,
  type BattleParticipantRuntimeState,
  type BattleRuntimeState,
  type BattleRuntimeZone,
  type BattleSide,
  type BattleSlotId,
} from './types';

/**
 * 저장 슬롯의 플레이어 덱과 테스트용 적 덱을 전투 중에만 쓰는 런타임 Zone 상태로 변환한다.
 * 저장 호환용 `LEADER` Zone은 사용하지 않고, 양측 리더는 각자의 `Side:BC` 전장 슬롯에 배치한다.
 */
export function createInitialBattleRuntime(session: GameSession): BattleRuntimeState {
  const player = createBattleParticipantRuntimeState(
    'player',
    session.deck,
    PLAYER_INITIAL_LEADER_SLOT,
  );
  const enemyDeck = createRuntimeDeckInstanceFromDefinitions({
    deckId: 'deck-enemy-dark-test',
    cardDefinitions: readCardDefinitionFile(darkDeckDefinitionData).cards,
    owner: 'ENEMY',
    unitCount: 29,
  });
  const enemy = createBattleParticipantRuntimeState('enemy', enemyDeck, ENEMY_INITIAL_LEADER_SLOT);

  return {
    currentSide: 'player',
    turnNumber: 1,
    phase: 'MAIN',
    outcome: null,
    player,
    enemy,
    battlefield: [enemy.leader, player.leader],
    drop: [],
    exile: [],
  };
}

function createBattleParticipantRuntimeState(
  side: BattleSide,
  deck: GameSession['deck'],
  leaderSlot: BattleSlotId,
): BattleParticipantRuntimeState {
  const leader = createBattleCardRuntimeState(side, deck.leader, 'BATTLEFIELD', {
    battlefieldSlot: leaderSlot,
  });
  const hand = deck.cards
    .slice(0, INITIAL_HAND_SIZE)
    .map((card, handIndex) => createBattleCardRuntimeState(side, card, 'HAND', { handIndex }));
  const remainingDeck = deck.cards
    .slice(INITIAL_HAND_SIZE)
    .map((card, deckIndex) => createBattleCardRuntimeState(side, card, 'DECK', { deckIndex }));

  return {
    side,
    leader,
    deck: remainingDeck,
    hand,
    drop: [],
    exile: [],
  };
}

type CreateBattleCardRuntimeStateOptions = {
  battlefieldSlot?: BattleSlotId;
  handIndex?: number;
  deckIndex?: number;
};

function createBattleCardRuntimeState(
  side: BattleSide,
  card: RuntimeCardInstance,
  zone: BattleRuntimeZone,
  options: CreateBattleCardRuntimeStateOptions,
): BattleCardRuntimeState {
  return {
    card,
    side,
    zone,
    battlefieldSlot: options.battlefieldSlot ?? null,
    handIndex: options.handIndex ?? null,
    deckIndex: options.deckIndex ?? null,
    hasMovedThisTurn: false,
    hasAttackedThisTurn: false,
    hasUsedActiveSkillThisTurn: false,
    abilityEffects: [],
  };
}
