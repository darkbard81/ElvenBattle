import { describe, expect, it } from 'vitest';
import { requireCardDefinition } from '../save/card-catalog';
import { createInitialSaveState } from '../save/create-initial-save';
import { createCardInstanceFromDefinition } from '../save/deck-instancing';
import { moveCollectionCardToDeck } from '../save/deck-building';
import { createGameSession } from '../save/session';
import { requireStageDefinition } from '../stage/stage-definitions';
import { createInitialBattleRuntime } from './create-battle-runtime';
import { ENEMY_INITIAL_LEADER_SLOT, INITIAL_HAND_SIZE, PLAYER_INITIAL_LEADER_SLOT } from './types';

const TEST_STAGE_DEFINITION = requireStageDefinition('test-stage-dark');

describe('createInitialBattleRuntime', () => {
  it('places both leaders on their center back battlefield slots', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);

    expect(runtime.player.leader.card.instance.instanceId).toBe(
      session.deck.leader.instance.instanceId,
    );
    expect(runtime.player.leader.zone).toBe('BATTLEFIELD');
    expect(runtime.player.leader.battlefieldSlot).toBe(PLAYER_INITIAL_LEADER_SLOT);
    expect(runtime.enemy.leader.card.definition.id).toBe('leader_dark_empress');
    expect(runtime.enemy.leader.card.instance.owner).toBe('ENEMY');
    expect(runtime.enemy.leader.zone).toBe('BATTLEFIELD');
    expect(runtime.enemy.leader.battlefieldSlot).toBe(ENEMY_INITIAL_LEADER_SLOT);
    expect(runtime.battlefield).toEqual([runtime.enemy.leader, runtime.player.leader]);
  });

  it('does not use the save-only LEADER zone in battle runtime state', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);
    const zones = [
      runtime.player.leader.zone,
      runtime.enemy.leader.zone,
      ...runtime.player.deck.map((card) => card.zone),
      ...runtime.enemy.deck.map((card) => card.zone),
      ...runtime.player.hand.map((card) => card.zone),
      ...runtime.enemy.hand.map((card) => card.zone),
      ...runtime.battlefield.map((card) => card.zone),
      ...runtime.drop.map((card) => card.zone),
      ...runtime.exile.map((card) => card.zone),
      ...runtime.player.drop.map((card) => card.zone),
      ...runtime.enemy.drop.map((card) => card.zone),
      ...runtime.player.exile.map((card) => card.zone),
      ...runtime.enemy.exile.map((card) => card.zone),
    ];

    expect(zones).not.toContain('LEADER');
  });

  it('draws the initial hand from the top of the saved deck', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);

    expect(runtime.player.hand).toHaveLength(INITIAL_HAND_SIZE);
    expect(runtime.player.deck).toHaveLength(session.deck.cards.length - INITIAL_HAND_SIZE);
    expect(runtime.player.hand.map((card) => card.card.instance.instanceId)).toEqual(
      session.deck.cards.slice(0, INITIAL_HAND_SIZE).map((card) => card.instance.instanceId),
    );
    expect(runtime.player.deck.map((card) => card.card.instance.instanceId)).toEqual(
      session.deck.cards.slice(INITIAL_HAND_SIZE).map((card) => card.instance.instanceId),
    );
  });

  it('draws a collection card moved into the saved deck for the next battle', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    state.collection.cards.push(
      createCardInstanceFromDefinition({
        definition: requireCardDefinition('unit_elf_assassin_001'),
        owner: 'PLAYER',
        zone: 'COLLECTION',
        createId: () => 'collection-card-1',
      }),
    );
    const session = createGameSession(state);
    const collectionCard = session.collection.cards[0]!;
    const nextSession = moveCollectionCardToDeck(session, {
      collectionCardInstanceId: collectionCard.instance.instanceId,
    });

    const runtime = createInitialBattleRuntime(nextSession, TEST_STAGE_DEFINITION);

    const playerRuntimeCards = [...runtime.player.hand, ...runtime.player.deck];

    expect(playerRuntimeCards.map((card) => card.card.instance.instanceId)).toContain(
      collectionCard.instance.instanceId,
    );
    expect(
      playerRuntimeCards.find(
        (card) => card.card.instance.instanceId === collectionCard.instance.instanceId,
      )?.card.definition.id,
    ).toBe(collectionCard.definition.id);
  });

  it('allows battle runtime creation with no non-leader deck cards', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession({
      ...state,
      deck: {
        ...state.deck,
        cards: [],
      },
    });

    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);

    expect(runtime.player.hand).toHaveLength(0);
    expect(runtime.player.deck).toHaveLength(0);
    expect(runtime.player.leader.card.instance.instanceId).toBe(
      session.deck.leader.instance.instanceId,
    );
  });

  it('keeps battle stat changes isolated from the source game session', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const originalLeaderStats = {
      hp: session.deck.leader.instance.hp,
      attack: session.deck.leader.instance.attack,
      cost: session.deck.leader.instance.cost,
      dominance: session.deck.leader.instance.dominance,
    };
    const originalHandCardStats = {
      hp: session.deck.cards[0]!.instance.hp,
      attack: session.deck.cards[0]!.instance.attack,
      cost: session.deck.cards[0]!.instance.cost,
      dominance: session.deck.cards[0]!.instance.dominance,
    };
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);

    expect(runtime.player.leader.card).not.toBe(session.deck.leader);
    expect(runtime.player.leader.card.instance).not.toBe(session.deck.leader.instance);
    expect(runtime.player.hand[0]!.card).not.toBe(session.deck.cards[0]);
    expect(runtime.player.hand[0]!.card.instance).not.toBe(session.deck.cards[0]!.instance);

    runtime.player.leader.card.instance.hp = 1;
    runtime.player.leader.card.instance.attack = 1;
    runtime.player.leader.card.instance.cost = 0;
    runtime.player.leader.card.instance.dominance = 0;
    runtime.player.hand[0]!.card.instance.hp = 1;
    runtime.player.hand[0]!.card.instance.attack = 1;
    runtime.player.hand[0]!.card.instance.cost = 0;
    runtime.player.hand[0]!.card.instance.dominance = 0;

    expect({
      hp: session.deck.leader.instance.hp,
      attack: session.deck.leader.instance.attack,
      cost: session.deck.leader.instance.cost,
      dominance: session.deck.leader.instance.dominance,
    }).toEqual(originalLeaderStats);
    expect({
      hp: session.deck.cards[0]!.instance.hp,
      attack: session.deck.cards[0]!.instance.attack,
      cost: session.deck.cards[0]!.instance.cost,
      dominance: session.deck.cards[0]!.instance.dominance,
    }).toEqual(originalHandCardStats);
  });

  it('creates enemy hand and deck from deck_dark.json as runtime card instances', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);

    expect(runtime.enemy.hand).toHaveLength(INITIAL_HAND_SIZE);
    expect(runtime.enemy.deck).toHaveLength(24);
    expect(runtime.enemy.hand.every((card) => card.card.instance.owner === 'ENEMY')).toBe(true);
    expect(runtime.enemy.deck.every((card) => card.card.instance.owner === 'ENEMY')).toBe(true);
    expect(
      runtime.enemy.hand.every((card) => card.card.definition.id.startsWith('unit_dark_')),
    ).toBe(true);
  });

  it('keeps battlefield slot data only on battlefield cards', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);

    expect(runtime.battlefield.every((card) => card.battlefieldSlot !== null)).toBe(true);
    expect(runtime.player.deck.every((card) => card.battlefieldSlot === null)).toBe(true);
    expect(runtime.enemy.deck.every((card) => card.battlefieldSlot === null)).toBe(true);
    expect(runtime.player.hand.every((card) => card.battlefieldSlot === null)).toBe(true);
    expect(runtime.enemy.hand.every((card) => card.battlefieldSlot === null)).toBe(true);
    expect(runtime.drop.every((card) => card.battlefieldSlot === null)).toBe(true);
    expect(runtime.exile.every((card) => card.battlefieldSlot === null)).toBe(true);
  });

  it('initializes empty drop and exile piles for both sides and shared runtime state', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);

    expect(runtime.drop).toHaveLength(0);
    expect(runtime.exile).toHaveLength(0);
    expect(runtime.player.drop).toHaveLength(0);
    expect(runtime.player.exile).toHaveLength(0);
    expect(runtime.enemy.drop).toHaveLength(0);
    expect(runtime.enemy.exile).toHaveLength(0);
  });

  it('initializes turn state and per-card action flags', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);
    const cards = [
      runtime.player.leader,
      runtime.enemy.leader,
      ...runtime.player.hand,
      ...runtime.player.deck,
      ...runtime.enemy.hand,
      ...runtime.enemy.deck,
    ];

    expect(runtime.currentSide).toBe('player');
    expect(runtime.turnNumber).toBe(1);
    expect(runtime.phase).toBe('MAIN');
    expect(runtime.outcome).toBeNull();
    expect(cards.every((card) => !card.hasMovedThisTurn)).toBe(true);
    expect(cards.every((card) => !card.hasAttackedThisTurn)).toBe(true);
    expect(cards.every((card) => !card.hasUsedActiveSkillThisTurn)).toBe(true);
  });

  it('initializes empty ability effect state on every battle runtime card', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);
    const cards = [
      runtime.player.leader,
      runtime.enemy.leader,
      ...runtime.player.hand,
      ...runtime.player.deck,
      ...runtime.enemy.hand,
      ...runtime.enemy.deck,
    ];

    expect(cards.every((card) => Array.isArray(card.abilityEffects))).toBe(true);
    expect(cards.every((card) => card.abilityEffects.length === 0)).toBe(true);
  });
});
