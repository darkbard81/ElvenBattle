import { describe, expect, it } from 'vitest';
import { createDamageDealtEvent } from '../src/events';
import { resolveEffectTarget } from '../src/effects';
import { createEffectState } from './phase8-helpers';

describe('effect target', () => {
  it('resolves event target, controller, enemy player, and same-column targets', () => {
    const state = createEffectState();
    const damageEvent = createDamageDealtEvent(
      state,
      { type: 'UNIT', unitId: 'effect-source' },
      { type: 'UNIT', unitId: 'effect-target' },
      1,
    );

    expect(resolveEffectTarget(state, 'EVENT_TARGET', 'effect-source', 'P1', damageEvent)).toEqual({
      type: 'UNIT',
      unitId: 'effect-target',
    });
    expect(resolveEffectTarget(state, 'CONTROLLER', 'effect-source', 'P1', damageEvent)).toEqual({
      type: 'PLAYER',
      playerId: 'P1',
    });
    expect(resolveEffectTarget(state, 'ENEMY_PLAYER', 'effect-source', 'P1', damageEvent)).toEqual({
      type: 'PLAYER',
      playerId: 'P2',
    });
    expect(
      resolveEffectTarget(state, 'SAME_COLUMN_ENEMY_FRONT', 'effect-source', 'P1', damageEvent),
    ).toEqual({
      type: 'UNIT',
      unitId: 'effect-target',
    });
  });
});
