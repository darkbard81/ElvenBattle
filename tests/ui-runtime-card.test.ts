import { describe, expect, it } from 'vitest';

import { getCardRuntimeNumberValues } from '../src/assets/cards';
import { createPveGame } from '../src/game';

describe('Phase13 card runtime number overlay', () => {
  it('maps card definition and instance state to runtime number values', () => {
    const state = createPveGame();
    const handCardId = state.players.P1!.hand[0]!;
    const values = getCardRuntimeNumberValues(state, handCardId);

    expect(values.find((value) => value.field === 'COST')?.value).toBeGreaterThanOrEqual(0);
    expect(values.some((value) => value.field === 'DOMINANCE_COST')).toBe(true);
    expect(values.some((value) => value.field === 'ATTACK')).toBe(true);
    expect(values.some((value) => value.field === 'HEALTH')).toBe(true);
  });
});
