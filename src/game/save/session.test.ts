import { describe, expect, it } from 'vitest';
import { createInitialSaveState } from './create-initial-save';
import { createGameSession } from './session';

describe('createGameSession', () => {
  it('attaches card definitions to save instances', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);

    expect(session.slotId).toBe(1);
    expect(session.deck.leader.instance.definitionId).toBe('leader_minerva');
    expect(session.deck.leader.definition.name).toBe('미네르바');
    expect(session.deck.cards).toHaveLength(29);
    expect(session.deck.cards.every((card) => card.definition.id.startsWith('unit_'))).toBe(true);
  });

  it('throws when a definitionId cannot be resolved', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const brokenState = {
      ...state,
      deck: {
        ...state.deck,
        leader: {
          ...state.deck.leader,
          definitionId: 'missing_definition',
        },
      },
    };

    expect(() => createGameSession(brokenState)).toThrow('Unknown card definitionId: missing_definition');
  });
});
