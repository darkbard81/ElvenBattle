import { describe, expect, it } from 'vitest';
import { applyStatusEffect, hasStatusEffect, removeExpiredStatusEffects } from '../src/effects';
import { validateAttack } from '../src/battle';
import type { AttackPayload, GameAction } from '../src/rules';
import { createEffectState } from './phase8-helpers';

describe('status effect', () => {
  it('applies, reads, expires, and affects attack validation', () => {
    const state = applyStatusEffect(createEffectState(), 'effect-source', {
      statusId: 'cannot-attack',
      type: 'CANNOT_ATTACK',
      stacks: 1,
      expiresAt: { type: 'END_OF_TURN' },
      visible: true,
    });

    expect(hasStatusEffect(state, 'effect-source', 'CANNOT_ATTACK')).toBe(true);

    const action = {
      actionId: 'attack-status',
      playerId: 'P1',
      type: 'ATTACK',
      payload: {
        attackerId: 'effect-source',
        target: { type: 'UNIT', unitId: 'effect-target' },
      },
    } satisfies GameAction<AttackPayload>;

    expect(validateAttack(state, action).errors[0]?.code).toBe('ERR_ATTACKER_CANNOT_ATTACK');
    expect(
      hasStatusEffect(
        removeExpiredStatusEffects(state, 'END_OF_TURN'),
        'effect-source',
        'CANNOT_ATTACK',
      ),
    ).toBe(false);
  });
});
