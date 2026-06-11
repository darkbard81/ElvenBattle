import { createSlotId } from '../src/board';
import type { CardDefinition } from '../src/cards';
import type { GameState } from '../src/core';
import type { EffectScript } from '../src/effects';
import { addBoardUnit, createPhase6State, phase6Registry } from './phase6-helpers';

export function withAbility(cardId: string, script: EffectScript): Record<string, CardDefinition> {
  const definition = phase6Registry.definitions[cardId];

  if (!definition) {
    throw new Error(`Missing test card definition: ${cardId}`);
  }

  return {
    ...phase6Registry.definitions,
    [cardId]: {
      ...definition,
      abilities: [
        {
          abilityId: `${script.id}-ability`,
          ...(script.trigger ? { trigger: script.trigger } : {}),
          effectScript: script,
        },
      ],
    },
  };
}

export function createEffectState(cardDefinitions = phase6Registry.definitions): GameState {
  return addBoardUnit(
    addBoardUnit(
      createPhase6State({
        phase: 'COMBAT',
        cardDefinitions,
      }),
      'effect-source',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 0),
      'P1',
    ),
    'effect-target',
    'unit_back_support',
    createSlotId('P2', 'FRONT', 0),
    'P2',
  );
}
