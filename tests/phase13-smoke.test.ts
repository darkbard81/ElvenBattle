import { describe, expect, it } from 'vitest';

import { createPveGame } from '../src/game';
import { createGameLayout, createGameViewModel } from '../src/ui';

describe('Phase13 playable MVP smoke', () => {
  it('creates layout and view model for the default PvE game', () => {
    const state = createPveGame();
    const viewModel = createGameViewModel(state, { viewerId: 'P1' });
    const layout = createGameLayout(['P1', 'P2']);

    expect(layout.width).toBe(1280);
    expect(Object.keys(layout.boardSlots)).toHaveLength(12);
    expect(viewModel.hand.length).toBeGreaterThan(0);
    expect(viewModel.result).toBeNull();
  });
});
