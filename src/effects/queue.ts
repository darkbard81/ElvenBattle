import type { GameState } from '../core';
import type { GameEvent } from '../events';
import { finalizeIfWinConditionMet, hasGameEnded } from '../game/end';
import { validationError } from '../rules';
import type { ProcessEffectsOptions, ProcessEffectsResult } from './result';
import { resolveEffectStack, pushTriggeredEffects } from './stack';
import { collectTriggeredAbilities, registerPendingTriggers } from './triggers';

export function enqueueEvents(state: GameState, events: readonly GameEvent[]): GameState {
  if (events.length === 0) {
    return state;
  }

  return {
    ...state,
    eventQueue: [...state.eventQueue, ...events],
  };
}

export function processSingleEvent(
  state: GameState,
  event: GameEvent,
  options: ProcessEffectsOptions = {},
): ProcessEffectsResult {
  const triggers = collectTriggeredAbilities(state, event);
  const stateWithTriggers = registerPendingTriggers(state, triggers);
  const stateWithStack = pushTriggeredEffects(stateWithTriggers, triggers);

  return resolveEffectStack(stateWithStack, options);
}

export function processEventQueue(
  state: GameState,
  options: ProcessEffectsOptions = {},
): ProcessEffectsResult {
  return flushEventQueue(state, options);
}

export function flushEventQueue(
  state: GameState,
  options: ProcessEffectsOptions = {},
): ProcessEffectsResult {
  const maxIterations = options.maxIterations ?? 32;
  let nextState = state;
  let iterations = 0;

  while (nextState.eventQueue.length > 0 || nextState.effectStack.length > 0) {
    if (hasGameEnded(nextState)) {
      break;
    }

    if (iterations >= maxIterations) {
      return {
        ok: false,
        state: {
          ...nextState,
          eventQueue: [],
        },
        events: nextState.eventLog.slice(state.eventLog.length),
        validation: validationError('ERR_EFFECT_LOOP_LIMIT', 'error.effect_loop_limit', {
          maxIterations,
        }),
      };
    }

    if (nextState.effectStack.length > 0) {
      const stackResult = resolveEffectStack(nextState, {
        maxIterations: maxIterations - iterations,
      });
      nextState = stackResult.state;
      iterations += 1;
      continue;
    }

    const [event, ...remainingQueue] = nextState.eventQueue;

    if (!event) {
      break;
    }

    const stateWithoutEvent = {
      ...nextState,
      eventQueue: remainingQueue,
    };
    const eventResult = processSingleEvent(stateWithoutEvent, event, options);
    nextState = eventResult.state;
    iterations += 1;
  }

  const stateAfterWinCheck = finalizeIfWinConditionMet(nextState);

  return {
    ok: true,
    state: {
      ...stateAfterWinCheck,
      eventQueue: [],
    },
    events: stateAfterWinCheck.eventLog.slice(state.eventLog.length),
  };
}
