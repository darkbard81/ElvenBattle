import { describe, expect, it } from 'vitest';
import { createUnitSummonedEvent } from '../src/events';
import {
  collectTriggeredAbilities,
  pushTriggeredEffects,
  registerPendingTriggers,
  resolveEffectStack,
} from '../src/effects';
import { createEffectState, withAbility } from './phase8-helpers';

describe('effect stack', () => {
  it('moves pending triggers to effect stack and resolves them', () => {
    const definitions = withAbility('unit_basic_vanguard', {
      id: 'on-summon-player-damage',
      trigger: 'ON_SUMMON',
      effect: { type: 'DAMAGE', amount: 1, target: 'ENEMY_PLAYER' },
    });
    const state = createEffectState(definitions);
    const event = createUnitSummonedEvent(state, 'P1', 'effect-source', 'P1:FRONT:0');
    const triggers = collectTriggeredAbilities(state, event);
    const withTriggers = registerPendingTriggers(state, triggers);
    const withStack = pushTriggeredEffects(withTriggers, triggers);

    expect(withStack.pendingTriggers).toEqual([]);
    expect(withStack.effectStack).toHaveLength(1);

    const result = resolveEffectStack(withStack);

    expect(result.ok).toBe(true);
    expect(result.state.players.P2?.hp).toBe(29);
    expect(result.events.map((effectEvent) => effectEvent.type)).toContain('EFFECT_RESOLVED');
  });
});
