import type { CardId } from '../core';
import type { DeckEntry } from '../cards';

export const PVE_PLAYER_ID = 'P1';
export const PVE_AI_ID = 'P2';

export const PVE_PLAYER_STARTER_DECK: readonly DeckEntry[] = [
  { cardId: 'unit_basic_vanguard', count: 12 },
  { cardId: 'unit_back_support', count: 10 },
  { cardId: 'tactic_basic_focus', count: 4 },
  { cardId: 'ongoing_basic_banner', count: 4 },
];

export const PVE_AI_STARTER_DECK: readonly DeckEntry[] = [
  { cardId: 'unit_basic_vanguard', count: 12 },
  { cardId: 'unit_back_support', count: 10 },
  { cardId: 'tactic_basic_focus', count: 4 },
  { cardId: 'ongoing_basic_banner', count: 4 },
];

export function getPveStarterDeck(playerId: string): readonly DeckEntry[] {
  return playerId === PVE_AI_ID ? PVE_AI_STARTER_DECK : PVE_PLAYER_STARTER_DECK;
}

export function expandPveDeck(deck: readonly DeckEntry[]): CardId[] {
  return deck.flatMap((entry) => Array.from({ length: entry.count }, () => entry.cardId));
}
