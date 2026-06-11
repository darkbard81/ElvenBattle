import { describe, expect, it } from 'vitest';
import {
  applyModifier,
  getModifiedAttack,
  getModifiedHealth,
  recalculateContinuousEffects,
  removeExpiredModifiers,
} from '../src/effects';
import { createEffectState } from './phase8-helpers';

describe('continuous effect', () => {
  it('applies modifier layers and removes expired modifiers', () => {
    const state = applyModifier(createEffectState(), 'effect-source', {
      modifierId: 'attack-up',
      layer: 'TEMPORARY',
      stat: 'ATTACK',
      amount: 3,
      expiresAt: { type: 'END_OF_TURN' },
    });

    expect(getModifiedAttack(state, 'effect-source')).toBe(5);
    expect(getModifiedHealth(state, 'effect-source')).toBe(3);
    expect(recalculateContinuousEffects(state)).toBe(state);
    expect(getModifiedAttack(removeExpiredModifiers(state, 'END_OF_TURN'), 'effect-source')).toBe(
      2,
    );
  });
});
