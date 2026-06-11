import { describe, expect, it } from 'vitest';
import * as core from '../src/core';
import basicUnit from '../card-data/examples/basic-unit.example.json';

describe('Phase 2 import boundaries', () => {
  it('imports the core module without UI dependencies', () => {
    expect(core.RULE_VERSION).toBe('core-rule-v0.1');
  });

  it('loads the independent example card data', () => {
    expect(basicUnit.cardId).toBe('unit_basic_vanguard');
    expect(basicUnit.dominanceCost).toBe(1);
  });
});
