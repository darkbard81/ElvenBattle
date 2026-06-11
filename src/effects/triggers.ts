import type { CardDefinition } from '../cards';
import type { GameState, InstanceId } from '../core';
import type { GameEvent } from '../events';
import type { AbilityDefinition, PendingTrigger } from './types';

const TRIGGER_EVENT_MAP: Record<string, string> = {
  ON_SUMMON: 'UNIT_SUMMONED',
  ON_ATTACK_DECLARED: 'ATTACK_DECLARED',
  ON_DAMAGE_DEALT: 'DAMAGE_DEALT',
  ON_DESTROYED: 'UNIT_DESTROYED',
  ON_CARD_DRAWN: 'CARD_DRAWN',
  ON_PHASE_CHANGED: 'PHASE_CHANGED',
  ON_TURN_STARTED: 'TURN_STARTED',
  ON_TURN_ENDED: 'TURN_ENDED',
};

export function collectTriggeredAbilities(state: GameState, event: GameEvent): PendingTrigger[] {
  const triggers: PendingTrigger[] = [];

  for (const slot of Object.values(state.board.slots)) {
    if (!slot.unit) {
      continue;
    }

    const instance = state.zones.cardInstances[slot.unit];
    const definition: CardDefinition | undefined = instance
      ? state.cardDefinitions?.[instance.definitionId]
      : undefined;

    if (!instance || !definition || instance.currentZone.type !== 'BATTLEFIELD') {
      continue;
    }

    for (const ability of definition.abilities) {
      if (!ability.effectScript || !matchesTrigger(ability, event)) {
        continue;
      }

      triggers.push({
        triggerId: `${event.eventId}:${slot.unit}:${ability.abilityId}`,
        effectId: ability.effectScript.id,
        sourceId: slot.unit,
        controllerId: instance.controllerId,
        eventId: event.eventId,
        payload: {
          abilityId: ability.abilityId,
          effectScript: ability.effectScript,
          event,
        },
      });
    }
  }

  return sortPendingTriggers(state, triggers);
}

export function matchesTrigger(ability: AbilityDefinition, event: GameEvent): boolean {
  const trigger = ability.effectScript?.trigger ?? ability.trigger;

  if (!trigger) {
    return false;
  }

  return TRIGGER_EVENT_MAP[trigger] === event.type || trigger === event.type;
}

export function sortPendingTriggers(
  state: GameState,
  triggers: readonly PendingTrigger[],
): PendingTrigger[] {
  return [...triggers].sort((a, b) => {
    const priorityA = triggerPriority(state, a);
    const priorityB = triggerPriority(state, b);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return `${a.controllerId}:${a.sourceId ?? ''}:${a.effectId}:${a.triggerId}`.localeCompare(
      `${b.controllerId}:${b.sourceId ?? ''}:${b.effectId}:${b.triggerId}`,
    );
  });
}

export function registerPendingTriggers(
  state: GameState,
  triggers: readonly PendingTrigger[],
): GameState {
  if (triggers.length === 0) {
    return state;
  }

  return {
    ...state,
    pendingTriggers: [...state.pendingTriggers, ...triggers],
  };
}

function triggerPriority(state: GameState, trigger: PendingTrigger): number {
  if (trigger.controllerId === state.activePlayerId) {
    return 0;
  }

  return trigger.controllerId === 'SCENARIO' ? 2 : 1;
}

export function getTriggerSourceId(trigger: PendingTrigger): InstanceId | undefined {
  return trigger.sourceId;
}
