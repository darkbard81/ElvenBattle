import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/game';
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

describe('applyAction', () => {
  it('applies END_PHASE from MAIN to COMBAT with logs and events', () => {
    const state = createTestGameState({ phase: 'MAIN' });
    const result = applyAction(state, action('END_PHASE'));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected END_PHASE to succeed');
    }

    expect(result.state).not.toBe(state);
    expect(result.state.phase).toBe('COMBAT');
    expect(result.state.actionLog).toHaveLength(1);
    expect(result.state.eventLog).toHaveLength(1);
    expect(result.events[0]?.type).toBe('PHASE_CHANGED');
    expect(result.actionLogEntry.accepted).toBe(true);
    expect(state.actionLog).toHaveLength(0);
    expect(state.eventLog).toHaveLength(0);
  });

  it('applies END_PHASE from COMBAT to END', () => {
    const state = createTestGameState({ phase: 'COMBAT' });
    const result = applyAction(state, action('END_PHASE'));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected END_PHASE to succeed');
    }
    expect(result.state.phase).toBe('END');
  });

  it('applies END_TURN from END to the next player TURN_START', () => {
    const state = createTestGameState({ phase: 'END', turnNumber: 2 });
    const result = applyAction(state, action('END_TURN'));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected END_TURN to succeed');
    }

    expect(result.state.activePlayerId).toBe('P2');
    expect(result.state.priorityPlayerId).toBe('P2');
    expect(result.state.phase).toBe('TURN_START');
    expect(result.state.turnNumber).toBe(3);
    expect(result.state.actionLog).toHaveLength(1);
    expect(result.state.eventLog.map((event) => event.type)).toEqual([
      'TURN_ENDED',
      'TURN_STARTED',
    ]);
    expect(result.events.map((event) => event.type)).toEqual(['TURN_ENDED', 'TURN_STARTED']);
  });

  it('rejects non-priority actions without mutating state', () => {
    const state = createTestGameState({ phase: 'MAIN' });
    const result = applyAction(state, action('END_PHASE', 'P2'));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected END_PHASE to fail');
    }
    expect(result.state).toBe(state);
    expect(result.validation.errors[0]?.code).toBe('ERR_NOT_PRIORITY_PLAYER');
    expect(state.actionLog).toHaveLength(0);
    expect(state.eventLog).toHaveLength(0);
  });

  it('rejects actions after the game is finished', () => {
    const state = createTestGameState({ gameStatus: 'FINISHED', phase: 'GAME_OVER' });
    const result = applyAction(state, action('END_PHASE'));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected finished game action to fail');
    }
    expect(result.state).toBe(state);
    expect(result.validation.errors[0]?.code).toBe('ERR_GAME_ALREADY_FINISHED');
  });

  it('rejects unsupported actions without action log entries', () => {
    const state = createTestGameState({ phase: 'MAIN' });
    const result = applyAction(state, action('PLAY_CARD'));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected PLAY_CARD to fail');
    }
    expect(result.state).toBe(state);
    expect(result.validation.errors[0]?.code).toBe('ERR_ACTION_NOT_IMPLEMENTED');
    expect(state.actionLog).toHaveLength(0);
  });
});
