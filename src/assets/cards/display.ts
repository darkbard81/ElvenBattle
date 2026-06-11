import type { CardDefinition, CardRarity } from '../../cards';
import { DEFAULT_SKILL_TEXT_OVERLAY } from './layout';
import { createRuntimeNumberSlots } from './overlay';
import { resolveAbilityText, resolveDisplayText, type CardTextDictionary } from './text';
import type { CardDisplayModel } from './types';

export interface CreateCardDisplayModelOptions {
  textDictionary?: CardTextDictionary;
}

export function createCardDisplayModel(
  definition: CardDefinition,
  options: CreateCardDisplayModelOptions = {},
): CardDisplayModel {
  const textDictionary = options.textDictionary ?? {};

  return {
    cardId: definition.cardId,
    name: resolveDisplayText(definition.nameKey, textDictionary, definition.nameKey),
    type: definition.type,
    rarity: definition.rarity ?? ('COMMON' satisfies CardRarity),
    cost: definition.cost,
    dominanceCost: definition.dominanceCost ?? 0,
    dominanceValue: definition.dominanceValue ?? 0,
    dominanceRequirement: definition.dominanceRequirement ?? null,
    attack: definition.type === 'UNIT' ? (definition.baseAttack ?? 0) : null,
    health: definition.type === 'UNIT' ? (definition.baseHealth ?? 0) : null,
    faction: definition.faction ?? null,
    attribute: definition.attribute ?? null,
    tags: [...definition.tags],
    rulesText: createRulesText(definition, textDictionary),
    artKey: definition.cardId,
    runtimeNumberSlots: createRuntimeNumberSlots(definition),
    skillTextOverlay: { ...DEFAULT_SKILL_TEXT_OVERLAY },
  };
}

function createRulesText(definition: CardDefinition, textDictionary: CardTextDictionary): string[] {
  const abilityText = definition.abilities.map((ability) =>
    resolveAbilityText(ability, textDictionary),
  );

  if (definition.effectScript !== undefined) {
    abilityText.push(definition.effectScript.id);
  }

  return abilityText;
}
