import { describe, expect, it } from 'vitest';

import { playAiTurn } from '../src/ai';
import { addHandCard, createPhase6State } from './phase6-helpers';

describe('AI turn runner', () => {
  it('plays an AI-controlled turn within the action limit', () => {
    const state = addHandCard(createPhase6State(), 'hand-unit', 'unit_basic_vanguard');
    const result = playAiTurn(state, 'P1', { maxActionsPerTurn: 10 });

    expect(result.ok).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.finalState.priorityPlayerId).toBe('P2');
  });
});
