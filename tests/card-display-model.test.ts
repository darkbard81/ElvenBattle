import { describe, expect, it } from 'vitest';
import basicOngoing from '../card-data/examples/basic-ongoing.example.json';
import basicTactic from '../card-data/examples/basic-tactic.example.json';
import basicUnit from '../card-data/examples/basic-unit.example.json';
import { parseCardDefinition, type CardDefinition } from '../src/cards';
import { createCardDisplayModel, getRuntimeNumberSlot } from '../src/assets/cards';

describe('Phase 9 card display model', () => {
  it('normalizes a unit card with runtime number slots', () => {
    const definition = parseCardDefinition(basicUnit);
    const model = createCardDisplayModel(definition);

    expect(model.cardId).toBe('unit_basic_vanguard');
    expect(model.name).toBe('card.unit_basic_vanguard.name');
    expect(model.type).toBe('UNIT');
    expect(model.rarity).toBe('COMMON');
    expect(model.cost).toBe(1);
    expect(model.dominanceCost).toBe(1);
    expect(model.dominanceValue).toBe(1);
    expect(model.dominanceRequirement).toBeNull();
    expect(model.attack).toBe(2);
    expect(model.health).toBe(3);
    expect(getRuntimeNumberSlot(model.runtimeNumberSlots, 'COST')).toBeDefined();
    expect(getRuntimeNumberSlot(model.runtimeNumberSlots, 'DOMINANCE_COST')).toBeDefined();
    expect(getRuntimeNumberSlot(model.runtimeNumberSlots, 'DOMINANCE_VALUE')).toBeDefined();
    expect(getRuntimeNumberSlot(model.runtimeNumberSlots, 'ATTACK')).toBeDefined();
    expect(getRuntimeNumberSlot(model.runtimeNumberSlots, 'HEALTH')).toBeDefined();
  });

  it('normalizes non-unit combat stats as null', () => {
    const tactic = createCardDisplayModel(parseCardDefinition(basicTactic));
    const ongoing = createCardDisplayModel(parseCardDefinition(basicOngoing));

    expect(tactic.attack).toBeNull();
    expect(tactic.health).toBeNull();
    expect(getRuntimeNumberSlot(tactic.runtimeNumberSlots, 'ATTACK')).toBeUndefined();
    expect(getRuntimeNumberSlot(tactic.runtimeNumberSlots, 'HEALTH')).toBeUndefined();
    expect(ongoing.dominanceRequirement).toBe(2);
    expect(getRuntimeNumberSlot(ongoing.runtimeNumberSlots, 'DOMINANCE_REQUIREMENT')).toBeDefined();
  });

  it('uses display text dictionaries and stable fallback values', () => {
    const definition: CardDefinition = {
      cardId: 'unit_text_probe',
      nameKey: 'card.unit_text_probe.name',
      type: 'UNIT',
      cost: 0,
      baseAttack: 0,
      baseHealth: 1,
      tags: [],
      abilities: [
        {
          abilityId: 'ability_text_probe',
          textKey: 'card.unit_text_probe.ability',
        },
        {
          abilityId: 'ability_script_probe',
          effectScript: {
            id: 'effect_text_probe',
            effect: { type: 'DRAW_CARD', count: 1, target: 'CONTROLLER' },
          },
        },
      ],
    };
    const model = createCardDisplayModel(definition, {
      textDictionary: {
        'card.unit_text_probe.name': 'Probe Vanguard',
        'card.unit_text_probe.ability': 'Draw a card.',
      },
    });

    expect(model.name).toBe('Probe Vanguard');
    expect(model.rarity).toBe('COMMON');
    expect(model.rulesText).toEqual(['Draw a card.', 'effect_text_probe']);
  });
});
