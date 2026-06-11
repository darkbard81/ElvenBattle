import { describe, expect, it } from 'vitest';
import { RULE_VERSION } from '../src/core';

describe('test environment', () => {
  it('runs a smoke test', () => {
    expect(RULE_VERSION).toContain('core-rule');
  });
});
