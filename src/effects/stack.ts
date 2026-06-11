import type { GameState } from '../core';
import { createEffectResolvedEvent, createEffectTriggeredEvent } from '../events';
import { validationError } from '../rules';
import { executeEffectScript } from './dsl';
import type { ProcessEffectsOptions, ProcessEffectsResult, ResolveEffectResult } from './result';
import type { EffectScript, PendingEffect, PendingTrigger } from './types';

export function pushTriggeredEffects(
  state: GameState,
  triggers: readonly PendingTrigger[],
): GameState {
  let nextState = state;
  const effects: PendingEffect[] = [];

  for (const trigger of triggers) {
    const event = createEffectTriggeredEvent(nextState, trigger);
    const script = trigger.payload.effectScript as EffectScript | undefined;

    nextState = {
      ...nextState,
      eventLog: [...nextState.eventLog, event],
    };

    if (!script) {
      continue;
    }

    effects.push({
      effectId: trigger.effectId,
      ...(trigger.sourceId ? { sourceId: trigger.sourceId } : {}),
      controllerId: trigger.controllerId,
      payload: {
        effectScript: script,
        event: trigger.payload.event,
        triggerId: trigger.triggerId,
      },
    });
  }

  return {
    ...nextState,
    pendingTriggers: nextState.pendingTriggers.filter(
      (pendingTrigger) =>
        !triggers.some((trigger) => trigger.triggerId === pendingTrigger.triggerId),
    ),
    effectStack: [...nextState.effectStack, ...effects],
  };
}

export function resolveNextEffect(state: GameState): ResolveEffectResult {
  const [effect, ...remainingEffects] = state.effectStack;

  if (!effect) {
    return {
      ok: true,
      state,
      events: [],
      status: 'SKIPPED',
    };
  }

  const script = effect.payload.effectScript as EffectScript | undefined;

  if (!script) {
    const stateWithoutEffect = {
      ...state,
      effectStack: remainingEffects,
    };
    const event = createEffectResolvedEvent(stateWithoutEffect, effect, {
      status: 'SKIPPED',
      reason: 'missing_effect_script',
    });

    return {
      ok: true,
      state: {
        ...stateWithoutEffect,
        eventLog: [...stateWithoutEffect.eventLog, event],
      },
      events: [event],
      status: 'SKIPPED',
    };
  }

  const stateWithoutEffect: GameState = {
    ...state,
    effectStack: remainingEffects,
  };
  const execution = executeEffectScript(stateWithoutEffect, script, {
    ...(effect.sourceId ? { sourceId: effect.sourceId } : {}),
    controllerId: effect.controllerId,
    ...(effect.payload.event
      ? { event: effect.payload.event as (typeof state.eventLog)[number] }
      : {}),
  });
  const resolvedEvent = createEffectResolvedEvent(execution.state, effect, {
    status: execution.status,
    ...execution.result,
  });
  const nextState = {
    ...execution.state,
    eventLog: [...execution.state.eventLog, resolvedEvent],
  };

  return {
    ok: execution.status !== 'FAILED',
    state: nextState,
    events: nextState.eventLog.slice(state.eventLog.length),
    status: execution.status,
  };
}

export function resolveEffectStack(
  state: GameState,
  options: ProcessEffectsOptions = {},
): ProcessEffectsResult {
  const maxIterations = options.maxIterations ?? 32;
  let nextState = state;
  let iterations = 0;

  while (nextState.effectStack.length > 0) {
    if (iterations >= maxIterations) {
      return {
        ok: false,
        state: nextState,
        events: nextState.eventLog.slice(state.eventLog.length),
        validation: validationError('ERR_EFFECT_LOOP_LIMIT', 'error.effect_loop_limit', {
          maxIterations,
        }),
      };
    }

    const result = resolveNextEffect(nextState);
    nextState = result.state;
    iterations += 1;
  }

  return {
    ok: true,
    state: nextState,
    events: nextState.eventLog.slice(state.eventLog.length),
  };
}
