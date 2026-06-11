import { describe, expect, it } from 'vitest';
import { executeEffectScript, flushEventQueue } from '../src/effects';
import { createEffectState } from './phase8-helpers';

describe('phase10 effects integration', () => {
  it('finalizes after an effect damages a player to zero', () => {
    const state = {
      ...createEffectState(),
      players: {
        ...createEffectState().players,
        P2: { ...createEffectState().players.P2!, hp: 1 },
      },
    };
    const execution = executeEffectScript(
      state,
      {
        id: 'lethal-effect',
        effect: { type: 'DAMAGE', amount: 1, target: 'ENEMY_PLAYER' },
      },
      { sourceId: 'effect-source', controllerId: 'P1' },
    );
    const flushed = flushEventQueue(execution.state);

    expect(flushed.ok).toBe(true);
    expect(flushed.state.phase).toBe('GAME_OVER');
    expect(flushed.state.winner).toBe('P1');
    expect(flushed.state.eventLog.at(-1)?.type).toBe('GAME_ENDED');
  });

  it('finalizes after an effect draw attempts to draw from an empty deck', () => {
    const execution = executeEffectScript(
      createEffectState(),
      {
        id: 'empty-deck-draw',
        effect: { type: 'DRAW_CARD', count: 1, target: 'CONTROLLER' },
      },
      { sourceId: 'effect-source', controllerId: 'P1' },
    );
    const flushed = flushEventQueue(execution.state);

    expect(flushed.ok).toBe(true);
    expect(flushed.state.phase).toBe('GAME_OVER');
    expect(flushed.state.winner).toBe('P2');
    expect(flushed.state.eventLog.at(-1)?.payload).toMatchObject({
      loser: 'P1',
      reason: 'DECK_OUT',
    });
  });
});
