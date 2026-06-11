import { describe, expect, it } from 'vitest';

import { simulateGame } from '../src/ai';
import {
  createPveGame,
  createPveInitialDecks,
  getPveScenario,
  PVE_AI_ID,
  PVE_PLAYER_ID,
} from '../src/game';

describe('Phase13 PvE scenario setup', () => {
  it('creates a playable intro duel initial state', () => {
    const state = createPveGame({ scenarioId: 'pve_intro_duel' });

    expect(state.gameStatus).toBe('RUNNING');
    expect(state.phase).toBe('MAIN');
    expect(state.players[PVE_PLAYER_ID]?.hand.length).toBe(3);
    expect(state.players[PVE_AI_ID]?.kind).toBe('AI');
    expect(Object.keys(state.cardDefinitions ?? {})).toContain('unit_basic_vanguard');
  });

  it('creates a boss scenario with BOSS_DEFEATED condition', () => {
    const state = createPveGame({ scenarioId: 'pve_boss_trial' });

    expect(state.scenarioState?.bossUnitIds).toEqual(['boss-trial-vanguard']);
    expect(state.scenarioState?.winConditions).toContainEqual({
      type: 'BOSS_DEFEATED',
      bossUnitId: 'boss-trial-vanguard',
      winnerId: PVE_PLAYER_ID,
    });
    expect(state.board.slots[`${PVE_AI_ID}:FRONT:1`]?.unit).toBe('boss-trial-vanguard');
  });

  it('expands starter decks for replay metadata', () => {
    const scenario = getPveScenario('pve_intro_duel');
    const decks = createPveInitialDecks(scenario);

    expect(decks[PVE_PLAYER_ID]!.length).toBeGreaterThan(0);
    expect(decks[PVE_AI_ID]!.length).toBeGreaterThan(0);
  });

  it('can drive the intro duel and boss trial to a finished or bounded simulation result', () => {
    const intro = simulateGame(createPveGame({ scenarioId: 'pve_intro_duel' }), {
      maxTurns: 30,
      maxActions: 300,
    });
    const boss = simulateGame(createPveGame({ scenarioId: 'pve_boss_trial' }), {
      maxTurns: 30,
      maxActions: 300,
    });

    expect(intro.finalState.phase).toBe('GAME_OVER');
    expect(intro.finalState.gameStatus).toBe('FINISHED');
    expect(boss.finalState.phase).toBe('GAME_OVER');
    expect(boss.finalState.gameStatus).toBe('FINISHED');
  });
});
