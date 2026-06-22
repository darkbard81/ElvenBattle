import { describe, expect, it } from 'vitest';
import { createInitialSaveState } from '../save/create-initial-save';
import { createGameSession } from '../save/session';
import {
  applyAttackAction,
  applyAutoTurnEndIfStalled,
  applyMoveAction,
  applyPlaceAction,
  applyTurnEnd,
  calculateSlotDominance,
  findBattlefieldCardAtSlot,
  listActiveSkillActions,
  listAttackActions,
  listMoveActions,
  listPlaceActions,
} from './battle-engine';
import { createInitialBattleRuntime } from './create-battle-runtime';
import type {
  BattleCardRuntimeState,
  BattleRuntimeState,
  BattleSide,
  BattleSlotId,
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

  it('returns no active skill actions and auto-ends stalled turns once', async () => {
    const runtime = await createRuntime();
    runtime.player.hand = [];
    runtime.player.leader.card.instance.attack = 0;
    runtime.player.leader.hasMovedThisTurn = true;
    runtime.player.leader.hasAttackedThisTurn = true;

    expect(listActiveSkillActions(runtime)).toEqual([]);
    expect(applyAutoTurnEndIfStalled(runtime)).toBe(true);
    expect(runtime.currentSide).toBe('enemy');
    expect(runtime.turnNumber).toBe(1);
  });

  it('advances turn number when enemy turn ends and resets the new side action flags', async () => {
    const runtime = await createRuntime();
    runtime.enemy.leader.hasMovedThisTurn = true;
    runtime.enemy.leader.hasAttackedThisTurn = true;
    runtime.enemy.leader.hasUsedActiveSkillThisTurn = true;

    applyTurnEnd(runtime);
    expect(runtime.currentSide).toBe('enemy');
    expect(runtime.turnNumber).toBe(1);

    applyTurnEnd(runtime);
    expect(runtime.currentSide).toBe('player');
    expect(runtime.turnNumber).toBe(2);
    expect(runtime.player.leader.hasMovedThisTurn).toBe(false);
    expect(runtime.player.leader.hasAttackedThisTurn).toBe(false);
    expect(runtime.player.leader.hasUsedActiveSkillThisTurn).toBe(false);
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
