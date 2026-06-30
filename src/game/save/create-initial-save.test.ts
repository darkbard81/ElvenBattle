import { describe, expect, it } from 'vitest';
import { createInitialSaveState } from './create-initial-save';

describe('createInitialSaveState', () => {
  it('creates a leader, 29 repeated unit cards, and an empty collection', async () => {
    const state = await createInitialSaveState({ slotId: 1 });

    expect(state.schemaVersion).toBe(3);
    expect(state.slotId).toBe(1);
    expect(state.deck.leader.zone).toBe('LEADER');
    expect(state.deck.leader.id).toBe('leader_minerva');
    expect(state.deck.leader.name).toBe('미네르바');
    expect(state.deck.leader.traits).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'race', text: '엘프' })]),
    );
    expect(state.deck.leader.abilities).toEqual([]);
    expect(state.deck.cards).toHaveLength(29);
    expect(state.deck.cards.every((card) => card.zone === 'DECK')).toBe(true);
    expect(state.deck.cards.every((card) => typeof card.description === 'string')).toBe(true);
    expect(state.collection.cards).toEqual([]);
    expect(state.equipment).toEqual({ equipped: [] });
    expect(state.stageProgress).toEqual({
      clearedStageIds: [],
      lastSelectedStageId: null,
    });

    const instanceIds = new Set([
      state.deck.leader.instanceId,
      ...state.deck.cards.map((card) => card.instanceId),
    ]);
    expect(instanceIds.size).toBe(30);
  });
});
