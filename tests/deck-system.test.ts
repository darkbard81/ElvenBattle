import { describe, expect, it } from 'vitest';
import basicUnit from '../card-data/examples/basic-unit.example.json';
import tactic from '../card-data/examples/basic-tactic.example.json';
import {
  createCardRegistry,
  createDeckInstances,
  createInitialDeckSetup,
  expandDeckList,
  parseCardDefinitions,
  shuffleInstanceIds,
  validateDeckList,
} from '../src/cards';

const registry = createCardRegistry(parseCardDefinitions([basicUnit, tactic]));
const deckRule = {
  minSize: 1,
  maxSize: 10,
  maxCopiesPerCard: 4,
  allowTokenCards: false,
};

describe('deck system', () => {
  it('validates and expands a deck list through the card registry', () => {
    const deckList = [
      { cardId: 'unit_basic_vanguard', count: 2 },
      { cardId: 'tactic_basic_focus', count: 1 },
    ];

    expect(validateDeckList(registry, deckList, deckRule).ok).toBe(true);
    expect(expandDeckList(deckList)).toEqual([
      'unit_basic_vanguard',
      'unit_basic_vanguard',
      'tactic_basic_focus',
    ]);
  });

  it('rejects card ids that are not in the registry', () => {
    const result = validateDeckList(
      registry,
      [{ cardId: 'missing_card_definition', count: 1 }],
      deckRule,
    );

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('ERR_CARD_DEFINITION_NOT_FOUND');
  });

  it('creates stable deck instances from the same input', () => {
    const deckList = [{ cardId: 'unit_basic_vanguard', count: 2 }];

    const instances = createDeckInstances(registry, 'P1', deckList, 'P1-deck');

    expect(instances.map((instance) => instance.instanceId)).toEqual(['P1-deck-1', 'P1-deck-2']);
    expect(instances[0]?.currentZone).toEqual({ type: 'DECK', ownerId: 'P1' });
    expect(instances[0]?.currentAttack).toBe(2);
  });

  it('shuffles deterministically for the same seed', () => {
    const ids = ['c1', 'c2', 'c3', 'c4', 'c5'];

    const first = shuffleInstanceIds(ids, { seed: 'same-seed', cursor: 0 });
    const second = shuffleInstanceIds(ids, { seed: 'same-seed', cursor: 0 });
    const different = shuffleInstanceIds(ids, { seed: 'different-seed', cursor: 0 });

    expect(first).toEqual(second);
    expect(first.instanceIds).not.toEqual(ids);
    expect(different.instanceIds).not.toEqual(first.instanceIds);
  });

  it('creates an initial deck and hand setup with matching instance zones', () => {
    const setup = createInitialDeckSetup(
      registry,
      'P1',
      [
        { cardId: 'unit_basic_vanguard', count: 2 },
        { cardId: 'tactic_basic_focus', count: 2 },
      ],
      'P1-start',
      { seed: 'opening-hand', cursor: 0 },
      2,
    );

    expect(setup.hand).toHaveLength(2);
    expect(setup.deck).toHaveLength(2);
    expect(setup.rng.cursor).toBe(3);

    for (const instanceId of setup.hand) {
      expect(setup.cardInstances[instanceId]?.currentZone).toEqual({
        type: 'HAND',
        ownerId: 'P1',
      });
    }

    for (const instanceId of setup.deck) {
      expect(setup.cardInstances[instanceId]?.currentZone).toEqual({
        type: 'DECK',
        ownerId: 'P1',
      });
    }
  });
});
