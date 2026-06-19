import { describe, expect, it } from 'vitest';
import { createInitialSaveState } from './create-initial-save';

describe('createInitialSaveState', () => {
  it('creates a leader and 29 repeated unit cards', async () => {
    const state = await createInitialSaveState({ slotId: 1 });

    expect(state.schemaVersion).toBe(1);
    expect(state.slotId).toBe(1);
    expect(state.deck.leader.zone).toBe('LEADER');
    expect(state.deck.leader.definitionId).toBe('leader_minerva');
    expect(state.deck.leader).not.toHaveProperty('definitionName');
    expect(state.deck.leader).not.toHaveProperty('baseHp');
    expect(state.deck.leader).not.toHaveProperty('baseAttack');
    expect(state.deck.cards).toHaveLength(29);
    expect(state.deck.cards.every((card) => card.zone === 'DECK')).toBe(true);
    expect(state.deck.cards.every((card) => !Object.prototype.hasOwnProperty.call(card, 'definitionName'))).toBe(true);

    const instanceIds = new Set([
      state.deck.leader.instanceId,
      ...state.deck.cards.map((card) => card.instanceId),
    ]);
    expect(instanceIds.size).toBe(30);
  });
});
