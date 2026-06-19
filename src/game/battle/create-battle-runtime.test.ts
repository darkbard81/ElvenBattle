import { describe, expect, it } from 'vitest';
import { createInitialSaveState } from '../save/create-initial-save';
import { createGameSession } from '../save/session';
import { createInitialBattleRuntime } from './create-battle-runtime';
import { BATTLEFIELD_SLOT_ROWS, INITIAL_HAND_SIZE } from './types';

describe('createInitialBattleRuntime', () => {
  it('places the saved leader on the battlefield center back slot', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session);

    expect(runtime.leader.card.instance.instanceId).toBe(session.deck.leader.instance.instanceId);
    expect(runtime.leader.zone).toBe('BATTLEFIELD');
    expect(runtime.leader.battlefieldSlot).toBe('BC');
    expect(runtime.battlefield).toEqual([runtime.leader]);
  });

  it('does not use the save-only LEADER zone in battle runtime state', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session);
    const zones = [
      runtime.leader.zone,
      ...runtime.deck.map((card) => card.zone),
      ...runtime.hand.map((card) => card.zone),
      ...runtime.battlefield.map((card) => card.zone),
      ...runtime.drop.map((card) => card.zone),
    ];

    expect(zones).not.toContain('LEADER');
  });

  it('draws the initial hand from the top of the saved deck', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session);

    expect(runtime.hand).toHaveLength(INITIAL_HAND_SIZE);
    expect(runtime.deck).toHaveLength(session.deck.cards.length - INITIAL_HAND_SIZE);
    expect(runtime.hand.map((card) => card.card.instance.instanceId)).toEqual(
      session.deck.cards.slice(0, INITIAL_HAND_SIZE).map((card) => card.instance.instanceId),
    );
    expect(runtime.deck.map((card) => card.card.instance.instanceId)).toEqual(
      session.deck.cards.slice(INITIAL_HAND_SIZE).map((card) => card.instance.instanceId),
    );
  });

  it('keeps battlefield slot data only on battlefield cards', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session);

    expect(runtime.battlefield.every((card) => card.battlefieldSlot !== null)).toBe(true);
    expect(runtime.deck.every((card) => card.battlefieldSlot === null)).toBe(true);
    expect(runtime.hand.every((card) => card.battlefieldSlot === null)).toBe(true);
    expect(runtime.drop.every((card) => card.battlefieldSlot === null)).toBe(true);
  });

  it('defines the battlefield slot rows in front-then-back order', () => {
    expect(BATTLEFIELD_SLOT_ROWS).toEqual([
      ['FR', 'FC', 'FL'],
      ['BR', 'BC', 'BL'],
    ]);
  });
});
