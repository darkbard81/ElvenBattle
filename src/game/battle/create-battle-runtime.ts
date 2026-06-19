import type { GameSession, RuntimeCardInstance } from '../save/session';
import {
  INITIAL_HAND_SIZE,
  type BattleCardRuntimeState,
  type BattleRuntimeState,
  type BattleRuntimeZone,
  type BattlefieldSlot,
} from './types';

/**
 * 저장 슬롯의 카드 인스턴스를 전투 중에만 쓰는 런타임 Zone 상태로 변환한다.
 * 저장 호환용 `LEADER` Zone은 사용하지 않고, 리더는 전장 `BC` 슬롯 카드로 배치한다.
 */
export function createInitialBattleRuntime(session: GameSession): BattleRuntimeState {
  const leader = createBattleCardRuntimeState(session.deck.leader, 'BATTLEFIELD', {
    battlefieldSlot: 'BC',
  });
  const hand = session.deck.cards
    .slice(0, INITIAL_HAND_SIZE)
    .map((card, handIndex) => createBattleCardRuntimeState(card, 'HAND', { handIndex }));
  const deck = session.deck.cards
    .slice(INITIAL_HAND_SIZE)
    .map((card, deckIndex) => createBattleCardRuntimeState(card, 'DECK', { deckIndex }));

  return {
    leader,
    deck,
    hand,
    battlefield: [leader],
    drop: [],
  };
}

type CreateBattleCardRuntimeStateOptions = {
  battlefieldSlot?: BattlefieldSlot;
  handIndex?: number;
  deckIndex?: number;
};

function createBattleCardRuntimeState(
  card: RuntimeCardInstance,
  zone: BattleRuntimeZone,
  options: CreateBattleCardRuntimeStateOptions,
): BattleCardRuntimeState {
  return {
    card,
    zone,
    battlefieldSlot: options.battlefieldSlot ?? null,
    handIndex: options.handIndex ?? null,
    deckIndex: options.deckIndex ?? null,
  };
}
