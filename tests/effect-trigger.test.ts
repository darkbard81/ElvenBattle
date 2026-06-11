import { describe, expect, it } from 'vitest';
import { createUnitSummonedEvent } from '../src/events';
import { collectTriggeredAbilities, sortPendingTriggers } from '../src/effects';
import { createEffectState, withAbility } from './phase8-helpers';

describe('effect trigger', () => {
  it('detects ON_SUMMON abilities from battlefield cards', () => {
    const definitions = withAbility('unit_basic_vanguard', {
      id: 'on-summon-damage',
      trigger: 'ON_SUMMON',
      effect: { type: 'DAMAGE', amount: 1, target: 'ENEMY_PLAYER' },
    });
    const state = createEffectState(definitions);
    const event = createUnitSummonedEvent(state, 'P1', 'effect-source', 'P1:FRONT:0');
    const triggers = collectTriggeredAbilities(state, event);

    expect(triggers).toHaveLength(1);
    expect(triggers[0]?.effectId).toBe('on-summon-damage');
    expect(triggers[0]?.sourceId).toBe('effect-source');
  });

  it('sorts simultaneous triggers deterministically', () => {
    const state = createEffectState();
    const triggers = sortPendingTriggers(state, [
      {
        triggerId: 'b',
        effectId: 'effect-b',
        sourceId: 'unit-b',
        controllerId: 'P2',
        eventId: 'event-1',
        payload: {},
      },
      {
        triggerId: 'a',
        effectId: 'effect-a',
        sourceId: 'unit-a',
        controllerId: 'P1',
        eventId: 'event-1',
        payload: {},
      },
    ]);

    expect(triggers.map((trigger) => trigger.effectId)).toEqual(['effect-a', 'effect-b']);
  });
});
