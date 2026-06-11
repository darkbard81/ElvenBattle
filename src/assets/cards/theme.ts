import type { CardRarity, CardType } from '../../cards';

export interface CardFrameTheme {
  frameFill: string;
  frameStroke: string;
  accent: string;
  gem: string;
  badgeFill: string;
}

export const CARD_TYPE_THEMES: Record<CardType, CardFrameTheme> = {
  UNIT: {
    frameFill: '#20272a',
    frameStroke: '#d1a84b',
    accent: '#0f5a42',
    gem: '#25b983',
    badgeFill: '#111313',
  },
  TACTIC: {
    frameFill: '#24232e',
    frameStroke: '#b8a060',
    accent: '#2e4f88',
    gem: '#6aa7ff',
    badgeFill: '#10121a',
  },
  ONGOING: {
    frameFill: '#25291f',
    frameStroke: '#c2a85a',
    accent: '#626f28',
    gem: '#c3d94a',
    badgeFill: '#14160f',
  },
  TOKEN: {
    frameFill: '#232323',
    frameStroke: '#a6a6a6',
    accent: '#4c4c4c',
    gem: '#d8d8d8',
    badgeFill: '#101010',
  },
};

export const CARD_RARITY_ACCENTS: Record<CardRarity, string> = {
  COMMON: '#c7b27a',
  RARE: '#4fa0ff',
  EPIC: '#b66dff',
  BOSS: '#e15040',
  TOKEN: '#b8b8b8',
};

export function getCardFrameTheme(type: CardType, rarity: CardRarity): CardFrameTheme {
  return {
    ...CARD_TYPE_THEMES[type],
    gem: CARD_RARITY_ACCENTS[rarity],
  };
}
