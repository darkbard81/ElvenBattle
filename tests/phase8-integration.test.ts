import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { createDamageDealtEvent } from '../src/events';
import { enqueueEvents, flushEventQueue } from '../src/effects';
import { applyAction } from '../src/game';
import { addHandCard, createPhase6State } from './phase6-helpers';
import { createEffectState, withAbility } from './phase8-helpers';

describe('phase8 integration', () => {
  it('processes triggered effects after a SUMMON_UNIT action', () => {
    const definitions = withAbility('unit_basic_vanguard', {
      id: 'summon-bolt',
      trigger: 'ON_SUMMON',
      effect: { type: 'DAMAGE', amount: 1, target: 'ENEMY_PLAYER' },
    });
    const state = addHandCard(
      createPhase6State({ cardDefinitions: definitions }),
      'summon-source',
      'unit_basic_vanguard',
      'P1',
    );
    const result = applyAction(
      {
        ...state,
        phase: 'MAIN',
      },
      {
        actionId: 'summon-with-effect',
        playerId: 'P1',
        type: 'SUMMON_UNIT',
        payload: {
          instanceId: 'summon-source',
          slotId: createSlotId('P1', 'BACK', 1),
        },
      },
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.state.players.P2?.hp).toBe(29);
    expect(result.events.map((event) => event.type)).toContain('EFFECT_TRIGGERED');
    expect(result.events.map((event) => event.type)).toContain('EFFECT_RESOLVED');
  });

  it('stops recursive event effects with a loop guard', () => {
    const definitions = withAbility('unit_basic_vanguard', {
      id: 'damage-loop',
      trigger: 'ON_DAMAGE_DEALT',
      effect: { type: 'DAMAGE', amount: 1, target: 'EVENT_TARGET' },
    });
    const state = createEffectState(definitions);
    const event = createDamageDealtEvent(
      state,
      { type: 'UNIT', unitId: 'effect-source' },
      { type: 'PLAYER', playerId: 'P2' },
      1,
    );
    const result = flushEventQueue(enqueueEvents(state, [event]), { maxIterations: 3 });

    expect(result.ok).toBe(false);
    expect(result.validation?.errors[0]?.code).toBe('ERR_EFFECT_LOOP_LIMIT');
  });
});
