import type { CardId, PlayerId } from '../core';
import type { WinCondition } from './types';
import {
  PVE_AI_ID,
  PVE_PLAYER_ID,
  PVE_AI_STARTER_DECK,
  PVE_PLAYER_STARTER_DECK,
} from './pve-decks';

export type PveScenarioId = 'pve_intro_duel' | 'pve_boss_trial';

export interface PveScenarioDefinition {
  scenarioId: PveScenarioId;
  version: string;
  titleKey: string;
  playerId: PlayerId;
  aiPlayerId: PlayerId;
  startingPlayerId: PlayerId;
  startingHp: number;
  startingHandSize: number;
  maxHandSize: number;
  rngSeed: string;
  playerDeck: readonly { cardId: CardId; count: number }[];
  aiDeck: readonly { cardId: CardId; count: number }[];
  boss?: {
    unitId: string;
    cardId: CardId;
    slotId: `${PlayerId}:${'FRONT' | 'BACK'}:${0 | 1 | 2}`;
    winnerId: PlayerId;
  };
  winConditions: WinCondition[];
}

export const PVE_SCENARIOS: Record<PveScenarioId, PveScenarioDefinition> = {
  pve_intro_duel: {
    scenarioId: 'pve_intro_duel',
    version: 'phase13-mvp',
    titleKey: 'scenario.pve_intro_duel.title',
    playerId: PVE_PLAYER_ID,
    aiPlayerId: PVE_AI_ID,
    startingPlayerId: PVE_PLAYER_ID,
    startingHp: 20,
    startingHandSize: 3,
    maxHandSize: 10,
    rngSeed: 'phase13-intro-duel',
    playerDeck: PVE_PLAYER_STARTER_DECK,
    aiDeck: PVE_AI_STARTER_DECK,
    winConditions: [{ type: 'OPPONENT_HP_ZERO' }, { type: 'DECK_OUT_LOSS' }],
  },
  pve_boss_trial: {
    scenarioId: 'pve_boss_trial',
    version: 'phase13-mvp',
    titleKey: 'scenario.pve_boss_trial.title',
    playerId: PVE_PLAYER_ID,
    aiPlayerId: PVE_AI_ID,
    startingPlayerId: PVE_PLAYER_ID,
    startingHp: 24,
    startingHandSize: 3,
    maxHandSize: 10,
    rngSeed: 'phase13-boss-trial',
    playerDeck: PVE_PLAYER_STARTER_DECK,
    aiDeck: PVE_AI_STARTER_DECK,
    boss: {
      unitId: 'boss-trial-vanguard',
      cardId: 'unit_basic_vanguard',
      slotId: `${PVE_AI_ID}:FRONT:1`,
      winnerId: PVE_PLAYER_ID,
    },
    winConditions: [
      {
        type: 'BOSS_DEFEATED',
        bossUnitId: 'boss-trial-vanguard',
        winnerId: PVE_PLAYER_ID,
      },
      { type: 'OPPONENT_HP_ZERO' },
      { type: 'DECK_OUT_LOSS' },
    ],
  },
};

export function getPveScenario(scenarioId: PveScenarioId): PveScenarioDefinition {
  return PVE_SCENARIOS[scenarioId];
}

export function listPveScenarios(): PveScenarioDefinition[] {
  return Object.values(PVE_SCENARIOS);
}
