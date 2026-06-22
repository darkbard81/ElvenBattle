import { describe, expect, it } from 'vitest';
import { createInitialSaveState } from '../save/create-initial-save';
import { createGameSession } from '../save/session';
import {
  applyAttackAction,
  applyAutoTurnEndIfStalled,
  applyMoveAction,
  applyPlaceAction,
  applyTurnStart,
  applyTurnEnd,
  calculateSlotDominance,
  chooseAutomatedBattleAction,
  findBattlefieldCardAtSlot,
  listActiveSkillActions,
  listAttackActions,
  listMoveActions,
  listPlaceActions,
  MAX_AUTOMATED_ACTIONS_PER_TURN,
  runAutomatedTurn,
} from './battle-engine';
import { createInitialBattleRuntime } from './create-battle-runtime';
import {
  INITIAL_HAND_SIZE,
  type BattleCardRuntimeState,
  type BattleRuntimeState,
  type BattleSide,
  type BattleSlotId,
} from './types';

describe('battle engine', () => {
  it('calculates dominance from only orthogonally adjacent allied cards on empty slots', async () => {
    const runtime = await createRuntime();

    expect(calculateSlotDominance(runtime, 'player:FC')).toBe(1);
    expect(calculateSlotDominance(runtime, 'player:BR')).toBe(1);
    expect(calculateSlotDominance(runtime, 'player:FR')).toBe(0);
    expect(calculateSlotDominance(runtime, 'player:BC')).toBe(0);
  });

  it('lists place actions when hand card cost is within target slot dominance', async () => {
    const runtime = await createRuntime();
    const actions = listPlaceActions(runtime);
    const archerToCenterFront = actions.find(
      (action) => action.fromHandIndex === 1 && action.toSlotId === 'player:FC',
    );

    expect(archerToCenterFront).toMatchObject({
      type: 'PLACE',
      fromHandIndex: 1,
      toSlotId: 'player:FC',
      dominance: 1,
      cost: 1,
    });
    expect(actions.some((action) => action.fromHandIndex === 0)).toBe(false);
    expect(actions.some((action) => action.toSlotId === 'player:BC')).toBe(false);
  });

  it('applies place actions by moving a card from hand to battlefield and reindexing hand', async () => {
    const runtime = await createRuntime();
    const action = listPlaceActions(runtime).find(
      (candidate) => candidate.fromHandIndex === 1 && candidate.toSlotId === 'player:FC',
    );
    if (!action) {
      throw new Error('Expected a legal place action');
    }
    const placedCardId = action.cardInstanceId;

    applyPlaceAction(runtime, action);

    const placedCard = findBattlefieldCardAtSlot(runtime, 'player:FC');
    expect(placedCard?.card.instance.instanceId).toBe(placedCardId);
    expect(placedCard?.zone).toBe('BATTLEFIELD');
    expect(placedCard?.handIndex).toBeNull();
    expect(runtime.player.hand).toHaveLength(4);
    expect(runtime.player.hand.map((card) => card.handIndex)).toEqual([0, 1, 2, 3]);
  });

  it('allows each current-side battlefield card to move once to orthogonally adjacent empty slots before attacking', async () => {
    const runtime = await createRuntime();
    const moveAction = listMoveActions(runtime).find(
      (candidate) =>
        candidate.cardInstanceId === runtime.player.leader.card.instance.instanceId &&
        candidate.toSlotId === 'player:FC',
    );
    if (!moveAction) {
      throw new Error('Expected a legal move action');
    }
    const leaderMoveSlots = listMoveActions(runtime)
      .filter(
        (candidate) =>
          candidate.cardInstanceId === runtime.player.leader.card.instance.instanceId,
      )
      .map((candidate) => candidate.toSlotId);

    applyMoveAction(runtime, moveAction);

    expect(leaderMoveSlots).toEqual(['player:FC', 'player:BR', 'player:BL']);
    expect(leaderMoveSlots).not.toContain('player:FR');
    expect(runtime.player.leader.battlefieldSlot).toBe('player:FC');
    expect(runtime.player.leader.hasMovedThisTurn).toBe(true);
    expect(
      listMoveActions(runtime).some(
        (candidate) => candidate.cardInstanceId === runtime.player.leader.card.instance.instanceId,
      ),
    ).toBe(false);
    expect(listMoveActions(runtime).some((candidate) => candidate.toSlotId.startsWith('enemy:'))).toBe(
      false,
    );

    runtime.phase = 'ATTACK';
    expect(listMoveActions(runtime)).toEqual([]);
  });

  it('applies attacks and moves defeated non-leader cards to drop piles', async () => {
    const runtime = await createRuntime();
    const moveAction = listMoveActions(runtime).find(
      (candidate) =>
        candidate.cardInstanceId === runtime.player.leader.card.instance.instanceId &&
        candidate.toSlotId === 'player:FC',
    );
    if (!moveAction) {
      throw new Error('Expected a legal leader move action');
    }
    applyMoveAction(runtime, moveAction);
    const target = placeHandCardOnBattlefield(runtime, 'enemy', 0, 'enemy:FC');
    target.card.instance.hp = runtime.player.leader.card.instance.attack ?? 0;
    const attackAction = listAttackActions(runtime).find(
      (candidate) => candidate.targetInstanceId === target.card.instance.instanceId,
    );
    if (!attackAction) {
      throw new Error('Expected a legal attack action');
    }

    applyAttackAction(runtime, attackAction);

    expect(runtime.phase).toBe('ATTACK');
    expect(runtime.player.leader.hasAttackedThisTurn).toBe(true);
    expect(findBattlefieldCardAtSlot(runtime, 'enemy:FC')).toBeNull();
    expect(target.zone).toBe('DROP');
    expect(target.battlefieldSlot).toBeNull();
    expect(runtime.drop).toContain(target);
    expect(runtime.enemy.drop).toContain(target);
    expect(listMoveActions(runtime)).toEqual([]);
  });

  it('records a game-over outcome when a leader is defeated', async () => {
    const runtime = await createRuntime();
    const moveAction = listMoveActions(runtime).find(
      (candidate) =>
        candidate.cardInstanceId === runtime.player.leader.card.instance.instanceId &&
        candidate.toSlotId === 'player:FC',
    );
    if (!moveAction) {
      throw new Error('Expected a legal leader move action');
    }
    applyMoveAction(runtime, moveAction);
    runtime.enemy.leader.card.instance.hp = runtime.player.leader.card.instance.attack ?? 0;
    const attackAction = listAttackActions(runtime).find(
      (candidate) =>
        candidate.targetInstanceId === runtime.enemy.leader.card.instance.instanceId,
    );
    if (!attackAction) {
      throw new Error('Expected a legal leader attack action');
    }

    applyAttackAction(runtime, attackAction);

    expect(runtime.phase).toBe('GAME_OVER');
    expect(runtime.outcome).toEqual({
      winner: 'player',
      loser: 'enemy',
      reason: 'LEADER_DEFEATED',
    });
    expect(findBattlefieldCardAtSlot(runtime, 'enemy:BC')).toBe(runtime.enemy.leader);
  });

  it('limits basic attacks by front and back row positioning', async () => {
    const runtime = await createRuntime();
    expect(
      listAttackActions(runtime).some(
        (candidate) =>
          candidate.attackerInstanceId === runtime.player.leader.card.instance.instanceId,
      ),
    ).toBe(false);

    const moveAction = listMoveActions(runtime).find(
      (candidate) =>
        candidate.cardInstanceId === runtime.player.leader.card.instance.instanceId &&
        candidate.toSlotId === 'player:FC',
    );
    if (!moveAction) {
      throw new Error('Expected a legal leader move action');
    }
    applyMoveAction(runtime, moveAction);

    expect(
      listAttackActions(runtime).some(
        (candidate) => candidate.targetInstanceId === runtime.enemy.leader.card.instance.instanceId,
      ),
    ).toBe(true);

    placeHandCardOnBattlefield(runtime, 'enemy', 0, 'enemy:FC');

    expect(
      listAttackActions(runtime).some(
        (candidate) => candidate.targetInstanceId === runtime.enemy.leader.card.instance.instanceId,
      ),
    ).toBe(false);
  });

  it('starts turns by resetting flags and drawing one card from the current side deck', async () => {
    const runtime = await createRuntime();
    const firstDeckCard = runtime.player.deck[0];
    if (!firstDeckCard) {
      throw new Error('Expected a player deck card to draw');
    }
    runtime.player.leader.hasMovedThisTurn = true;
    runtime.player.leader.hasAttackedThisTurn = true;
    firstDeckCard.hasUsedActiveSkillThisTurn = true;
    const deckSizeBefore = runtime.player.deck.length;

    const event = applyTurnStart(runtime);

    expect(event).toEqual({
      type: 'TURN_START',
      side: 'player',
      drewCardInstanceId: firstDeckCard.card.instance.instanceId,
      deckRemaining: deckSizeBefore - 1,
    });
    expect(runtime.player.hand.at(-1)).toBe(firstDeckCard);
    expect(firstDeckCard.zone).toBe('HAND');
    expect(firstDeckCard.handIndex).toBe(INITIAL_HAND_SIZE);
    expect(firstDeckCard.deckIndex).toBeNull();
    expect(runtime.player.deck.map((card) => card.deckIndex)).toEqual(
      runtime.player.deck.map((_, index) => index),
    );
    expect(runtime.player.leader.hasMovedThisTurn).toBe(false);
    expect(runtime.player.leader.hasAttackedThisTurn).toBe(false);
    expect(firstDeckCard.hasUsedActiveSkillThisTurn).toBe(false);
  });

  it('reports an empty deck without changing hand indexes during turn start', async () => {
    const runtime = await createRuntime();
    runtime.player.deck = [];
    const handIndexesBefore = runtime.player.hand.map((card) => card.handIndex);

    const event = applyTurnStart(runtime);

    expect(event).toEqual({
      type: 'TURN_START',
      side: 'player',
      drewCardInstanceId: null,
      deckRemaining: 0,
    });
    expect(runtime.player.hand.map((card) => card.handIndex)).toEqual(handIndexesBefore);
  });

  it('returns no active skill actions and auto-ends stalled turns once', async () => {
    const runtime = await createRuntime();
    runtime.player.hand = [];
    runtime.player.leader.card.instance.attack = 0;
    runtime.player.leader.hasMovedThisTurn = true;
    runtime.player.leader.hasAttackedThisTurn = true;
    const enemyHandSizeBefore = runtime.enemy.hand.length;
    const enemyDeckSizeBefore = runtime.enemy.deck.length;

    expect(listActiveSkillActions(runtime)).toEqual([]);
    expect(applyAutoTurnEndIfStalled(runtime)).toBe(true);
    expect(runtime.currentSide).toBe('enemy');
    expect(runtime.turnNumber).toBe(1);
    expect(runtime.enemy.hand).toHaveLength(enemyHandSizeBefore + 1);
    expect(runtime.enemy.deck).toHaveLength(enemyDeckSizeBefore - 1);
  });

  it('advances turn number when enemy turn ends, starts the next turn, and resets flags', async () => {
    const runtime = await createRuntime();
    runtime.enemy.leader.hasMovedThisTurn = true;
    runtime.enemy.leader.hasAttackedThisTurn = true;
    runtime.enemy.leader.hasUsedActiveSkillThisTurn = true;
    const enemyHandSizeBefore = runtime.enemy.hand.length;
    const enemyDeckSizeBefore = runtime.enemy.deck.length;
    const playerHandSizeBefore = runtime.player.hand.length;
    const playerDeckSizeBefore = runtime.player.deck.length;

    applyTurnEnd(runtime);
    expect(runtime.currentSide).toBe('enemy');
    expect(runtime.turnNumber).toBe(1);
    expect(runtime.enemy.hand).toHaveLength(enemyHandSizeBefore + 1);
    expect(runtime.enemy.deck).toHaveLength(enemyDeckSizeBefore - 1);

    applyTurnEnd(runtime);
    expect(runtime.currentSide).toBe('player');
    expect(runtime.turnNumber).toBe(2);
    expect(runtime.player.hand).toHaveLength(playerHandSizeBefore + 1);
    expect(runtime.player.deck).toHaveLength(playerDeckSizeBefore - 1);
    expect(runtime.player.leader.hasMovedThisTurn).toBe(false);
    expect(runtime.player.leader.hasAttackedThisTurn).toBe(false);
    expect(runtime.player.leader.hasUsedActiveSkillThisTurn).toBe(false);
  });

  it('chooses dominance-increasing place before attacks and prefers higher cost place ties', async () => {
    const runtime = await createRuntime();
    runtime.currentSide = 'enemy';

    const firstAction = chooseAutomatedBattleAction(runtime, 'enemy');
    expect(firstAction?.type).toBe('PLACE');

    const tieRuntime = await createRuntime();
    tieRuntime.currentSide = 'enemy';
    const anchorCard = placeHandCardOnBattlefield(tieRuntime, 'enemy', 2, 'enemy:FR');
    const highCostCard = tieRuntime.enemy.hand[0];
    const lowCostCard = tieRuntime.enemy.hand[1];
    if (!highCostCard || !lowCostCard) {
      throw new Error('Expected enemy hand cards for cost tie');
    }
    highCostCard.card.instance.cost = 2;
    highCostCard.card.instance.dominance = 3;
    lowCostCard.card.instance.cost = 1;
    lowCostCard.card.instance.dominance = 2;
    tieRuntime.enemy.leader.hasMovedThisTurn = true;
    anchorCard.hasMovedThisTurn = true;
    const highCostAction = chooseAutomatedBattleAction(tieRuntime, 'enemy');

    expect(highCostAction).toMatchObject({
      type: 'PLACE',
      cardInstanceId: highCostCard.card.instance.instanceId,
      cost: 2,
    });
  });

  it('falls back to highest-cost legal place when dominance cannot increase further', async () => {
    const runtime = await createRuntime();
    runtime.currentSide = 'enemy';
    const placedCard = placeHandCardOnBattlefield(runtime, 'enemy', 1, 'enemy:FC');
    applyMoveAction(runtime, {
      type: 'MOVE',
      cardInstanceId: runtime.enemy.leader.card.instance.instanceId,
      fromSlotId: 'enemy:BC',
      toSlotId: 'enemy:BR',
    });

    const action = chooseAutomatedBattleAction(runtime, 'enemy');

    expect(placedCard.hasMovedThisTurn).toBe(false);
    expect(action).toMatchObject({
      type: 'PLACE',
      cost: 2,
    });
  });

  it('does not choose a move that fails to increase dominance and falls back to attack without legal place', async () => {
    const runtime = await createRuntime();
    runtime.currentSide = 'enemy';
    runtime.enemy.hand = [];
    runtime.enemy.leader.battlefieldSlot = 'enemy:FC';

    const action = chooseAutomatedBattleAction(runtime, 'enemy');

    expect(action?.type).toBe('ATTACK');
  });

  it('chooses dominance-increasing moves when place is unavailable', async () => {
    const runtime = await createRuntime();
    runtime.currentSide = 'enemy';
    placeHandCardOnBattlefield(runtime, 'enemy', 1, 'enemy:FC');
    runtime.enemy.hand = [];

    const action = chooseAutomatedBattleAction(runtime, 'enemy');

    expect(action).toMatchObject({
      type: 'MOVE',
      cardInstanceId: runtime.enemy.leader.card.instance.instanceId,
      fromSlotId: 'enemy:BC',
      toSlotId: 'enemy:BR',
    });
  });

  it('chooses leader attacks first, then the lowest HP battlefield card', async () => {
    const runtime = await createRuntime();
    runtime.currentSide = 'enemy';
    runtime.phase = 'ATTACK';
    placeHandCardOnBattlefield(runtime, 'enemy', 1, 'enemy:FC');
    const highHpTarget = placeHandCardOnBattlefield(runtime, 'player', 1, 'player:FR');
    const lowHpTarget = placeHandCardOnBattlefield(runtime, 'player', 1, 'player:FL');
    highHpTarget.card.instance.hp = 5;
    lowHpTarget.card.instance.hp = 2;

    const leaderAction = chooseAutomatedBattleAction(runtime, 'enemy');
    expect(leaderAction).toMatchObject({
      type: 'ATTACK',
      targetInstanceId: runtime.player.leader.card.instance.instanceId,
    });

    runtime.player.leader.card.instance.hp = 0;
    const lowHpAction = chooseAutomatedBattleAction(runtime, 'enemy');
    expect(lowHpAction).toMatchObject({
      type: 'ATTACK',
      targetInstanceId: lowHpTarget.card.instance.instanceId,
    });
  });

  it('runs automated enemy turns through existing actions and returns control to player', async () => {
    const runtime = await createRuntime();
    applyTurnEnd(runtime);
    const playerLeaderHpBefore = runtime.player.leader.card.instance.hp ?? 0;
    const enemyHandSizeBefore = runtime.enemy.hand.length;

    const events = runAutomatedTurn(runtime, 'enemy');
    const placeEvents = events.filter(
      (event) => event.type === 'ACTION' && event.action.type === 'PLACE',
    );

    expect(events.some((event) => event.type === 'ACTION')).toBe(true);
    expect(placeEvents.length).toBeGreaterThan(1);
    expect(runtime.enemy.hand.length).toBeLessThan(enemyHandSizeBefore - 1);
    expect(
      events.some((event) => event.type === 'ACTION' && event.action.type === 'ATTACK'),
    ).toBe(true);
    expect(runtime.currentSide).toBe('player');
    expect(runtime.player.leader.card.instance.hp).toBeLessThan(playerLeaderHpBefore);
  });

  it('stops automated turns immediately when a leader is defeated', async () => {
    const runtime = await createRuntime();
    runtime.currentSide = 'enemy';
    runtime.phase = 'ATTACK';
    const attacker = placeHandCardOnBattlefield(runtime, 'enemy', 1, 'enemy:FC');
    runtime.player.leader.card.instance.hp = attacker.card.instance.attack ?? 0;

    const events = runAutomatedTurn(runtime, 'enemy');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'ACTION',
      side: 'enemy',
    });
    expect(runtime.phase).toBe('GAME_OVER');
    expect(runtime.outcome).toEqual({
      winner: 'enemy',
      loser: 'player',
      reason: 'LEADER_DEFEATED',
    });
  });

  it('ends automated turns at the action limit', async () => {
    const runtime = await createRuntime();
    runtime.currentSide = 'enemy';
    runtime.phase = 'ATTACK';
    runtime.player.leader.card.instance.hp = 1000;
    moveEnemyDeckCardsToBattlefield(runtime, MAX_AUTOMATED_ACTIONS_PER_TURN + 1, 'enemy:FC');

    const events = runAutomatedTurn(runtime, 'enemy');

    expect(
      events.filter((event) => event.type === 'ACTION' && event.action.type === 'ATTACK'),
    ).toHaveLength(MAX_AUTOMATED_ACTIONS_PER_TURN);
    expect(events).toContainEqual({
      type: 'ACTION_LIMIT',
      side: 'enemy',
      actionCount: MAX_AUTOMATED_ACTIONS_PER_TURN,
    });
    expect(runtime.currentSide).toBe('player');
  });
});

async function createRuntime(): Promise<BattleRuntimeState> {
  const state = await createInitialSaveState({ slotId: 1 });
  return createInitialBattleRuntime(createGameSession(state));
}

function placeHandCardOnBattlefield(
  runtime: BattleRuntimeState,
  side: BattleSide,
  handIndex: number,
  slotId: BattleSlotId,
): BattleCardRuntimeState {
  const participant = side === 'player' ? runtime.player : runtime.enemy;
  const card = participant.hand[handIndex];
  if (!card) {
    throw new Error(`Missing ${side} hand card at index ${handIndex}`);
  }

  participant.hand.splice(handIndex, 1);
  card.zone = 'BATTLEFIELD';
  card.battlefieldSlot = slotId;
  card.handIndex = null;
  runtime.battlefield.push(card);
  participant.hand.forEach((entry, index) => {
    entry.handIndex = index;
  });

  return card;
}

function moveEnemyDeckCardsToBattlefield(
  runtime: BattleRuntimeState,
  count: number,
  slotId: BattleSlotId,
): void {
  for (let index = 0; index < count; index += 1) {
    const card = runtime.enemy.deck.shift();
    if (!card) {
      throw new Error(`Missing enemy deck card ${index}`);
    }

    card.zone = 'BATTLEFIELD';
    card.battlefieldSlot = slotId;
    card.handIndex = null;
    card.deckIndex = null;
    runtime.battlefield.push(card);
  }

  runtime.enemy.deck.forEach((card, index) => {
    card.deckIndex = index;
  });
}
