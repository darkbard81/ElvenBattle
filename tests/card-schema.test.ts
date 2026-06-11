import { describe, expect, it } from 'vitest';
import basicUnit from '../card-data/examples/basic-unit.example.json';
import { CardDefinitionError, createCardRegistry, parseCardDefinition } from '../src/cards';

describe('card schema', () => {
  it('parses an independent card JSON as a CardDefinition', () => {
    const definition = parseCardDefinition(basicUnit);

    expect(definition.cardId).toBe('unit_basic_vanguard');
    expect(definition.type).toBe('UNIT');
    expect(definition.baseAttack).toBe(2);
    expect(definition.rowRestriction).toBe('ANY');
  });

  it('rejects card JSON missing required unit stats', () => {
    expect(() =>
      parseCardDefinition({
        cardId: 'unit_missing_stats',
        nameKey: 'card.unit_missing_stats.name',
        type: 'UNIT',
        cost: 1,
        tags: [],
        abilities: [],
      }),
    ).toThrow(CardDefinitionError);
  });

  it('rejects duplicated card ids in a registry', () => {
    const definition = parseCardDefinition(basicUnit);

    expect(() => createCardRegistry([definition, definition])).toThrow(/Duplicated cardId/);
  });
});
