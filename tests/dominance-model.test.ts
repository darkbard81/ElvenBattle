import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOMINANCE_CONFIG,
  DEFAULT_RESOURCE_STATE,
  createInitialDominanceState,
  type DominanceConfig,
  type ResourceState,
} from '../src/dominance';

describe('dominance model', () => {
  it('defines the default dominance configuration', () => {
    expect(DEFAULT_DOMINANCE_CONFIG).toEqual({
      startLimit: 3,
      limitGainPerTurn: 1,
      cap: 10,
      overloadPolicy: 'BLOCK_NEW_SUMMON_ONLY',
    } satisfies DominanceConfig);
  });

  it('creates an initial dominance state from config', () => {
    const dominance = createInitialDominanceState();

    expect(dominance).toEqual({
      limit: 3,
      temporaryLimit: 0,
      used: 0,
      boardValue: 0,
      overloaded: false,
    });
  });

  it('keeps resource state separate from dominance state', () => {
    const resource: ResourceState = { ...DEFAULT_RESOURCE_STATE, max: 1, current: 1 };

    expect(resource).toEqual({
      current: 1,
      max: 1,
      cap: 10,
      temporary: 0,
    });
  });
});
