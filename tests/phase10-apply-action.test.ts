import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { applyAction } from '../src/game';
import { addBoardUnit, createPhase6State } from './phase6-helpers';

describe('phase10 applyAction integration', () => {
  it('finalizes the game after a direct attack reduces player HP to zero', () => {
    const state = addBoardUnit(
      createPhase6State({
        phase: 'COMBAT',
        players: {
          ...createPhase6State().players,
          P2: { ...createPhase6State().players.P2!, hp: 2 },
        },
      }),
      'attacker-1',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 0),
      'P1',
      { summonedThisTurn: false },
    );
    const result = applyAction(state, {
      actionId: 'finishing-attack',
      playerId: 'P1',
      type: 'ATTACK',
      payload: {
        attackerId: 'attacker-1',
        target: { type: 'PLAYER', playerId: 'P2' },
      },
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.state.phase).toBe('GAME_OVER');
    expect(result.state.winner).toBe('P1');
    expect(result.events.map((event) => event.type)).toContain('GAME_ENDED');
  });

  it('rejects actions after the game has already ended', () => {
    const ended = {
      ...createPhase6State(),
      phase: 'GAME_OVER' as const,
      gameStatus: 'FINISHED' as const,
      winner: 'P1',
      priorityPlayerId: null,
    };
    const result = applyAction(ended, {
      actionId: 'late-action',
      playerId: 'P1',
      type: 'END_TURN',
      payload: {},
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.validation.errors[0]?.code).toBe('ERR_GAME_ALREADY_FINISHED');
    expect(result.state).toBe(ended);
  });
});
