import { describe, expect, it } from 'vitest';
import {
  validateGameRunning,
  validatePhaseAllowsAction,
  validatePriorityPlayer,
} from '../src/rules';
import type { GameAction } from '../src/rules';
import { createTestGameState } from './helpers/game-state';

function action(type: GameAction['type'], playerId = 'P1'): GameAction {
  return {
    actionId: `action-${type}`,
    playerId,
    type,
    payload: {},
  };
}

describe('action validation', () => {
  it('rejects actions while the game is not running', () => {
    const state = createTestGameState({ gameStatus: 'FINISHED' });
    const result = validateGameRunning(state);

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('ERR_GAME_ALREADY_FINISHED');
  });

  it('rejects actions from non-priority players', () => {
    const state = createTestGameState();
    const result = validatePriorityPlayer(state, 'P2');

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('ERR_NOT_PRIORITY_PLAYER');
  });

  it('rejects implemented actions in the wrong phase', () => {
    const state = createTestGameState({ phase: 'MAIN' });
    const result = validatePhaseAllowsAction(state, action('END_TURN'));

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('ERR_WRONG_PHASE');
  });

  it('rejects unsupported actions with an explicit not implemented error', () => {
    const state = createTestGameState({ phase: 'MAIN' });
    const result = validatePhaseAllowsAction(state, action('PLAY_CARD'));

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('ERR_ACTION_NOT_IMPLEMENTED');
  });
});
