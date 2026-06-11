import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, RULE_VERSION } from '../src/core';

describe('core version exports', () => {
  it('exposes the Phase 2 rule version', () => {
    expect(RULE_VERSION).toBe('core-rule-v0.1');
  });

  it('exposes a non-empty engine version', () => {
    expect(ENGINE_VERSION.length).toBeGreaterThan(0);
  });
});
