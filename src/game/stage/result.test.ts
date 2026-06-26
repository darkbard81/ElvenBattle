import { describe, expect, it } from 'vitest';
import { createInitialBattleRuntime } from '../battle/create-battle-runtime';
import type { BattleCardRuntimeState, BattleRuntimeState } from '../battle/types';
import { createInitialSaveState } from '../save/create-initial-save';
import { createGameSession, createSaveSlotStateFromGameSession } from '../save/session';
import { requireStageDefinition } from './stage-definitions';
import {
  applyStageBattleResultToSession,
  calculateStageRewards,
  createStageBattleResult,
} from './result';

const TEST_STAGE_DEFINITION = requireStageDefinition('test-stage-dark');

describe('stage battle result', () => {
  it('maps enemy leader defeat to a win result', async () => {
    const runtime = await createRuntime();
    runtime.phase = 'GAME_OVER';
    runtime.outcome = {
      winner: 'player',
      loser: 'enemy',
      reason: 'LEADER_DEFEATED',
    };

    const result = createStageBattleResult(runtime, TEST_STAGE_DEFINITION, {
      random: () => 1,
    });

    expect(result).toMatchObject({
      stageId: 'test-stage-dark',
      outcome: 'WIN',
      reason: 'ENEMY_LEADER_DEFEATED',
      turnNumber: 1,
      rewardCardInstanceIds: [],
      rewardCardNames: [],
    });
  });

  it('maps player leader defeat to a lose result without rewards', async () => {
    const runtime = await createRuntime();
    moveEnemyDeckCardToDrop(runtime, 'unit_dark_guardian_001');
    runtime.phase = 'GAME_OVER';
    runtime.outcome = {
      winner: 'enemy',
      loser: 'player',
      reason: 'LEADER_DEFEATED',
    };

    const result = createStageBattleResult(runtime, TEST_STAGE_DEFINITION, {
      random: () => 0,
    });

    expect(result).toMatchObject({
      outcome: 'LOSE',
      reason: 'PLAYER_LEADER_DEFEATED',
      rewardCardInstanceIds: [],
      rewardCardNames: [],
    });
  });

  it('selects only enemy unit cards from drop rewards', async () => {
    const runtime = await createRuntime();
    const enemyUnit = moveEnemyDeckCardToDrop(runtime, 'unit_dark_guardian_001');
    movePlayerHandCardToEnemyDrop(runtime);
    runtime.enemy.drop.push(runtime.enemy.leader);

    const rewards = calculateStageRewards(
      runtime,
      {
        ...TEST_STAGE_DEFINITION,
        rewards: {
          ...TEST_STAGE_DEFINITION.rewards,
          enemyCardDrop: {
            source: 'ENEMY_DROP',
            chancePercent: 100,
            maxCards: 3,
            excludeLeader: true,
          },
        },
      },
      { random: () => 0 },
    );

    expect(rewards).toEqual({
      rewardCardInstanceIds: [enemyUnit.card.instance.instanceId],
      rewardCardNames: [enemyUnit.card.instance.name],
    });
  });

  it('honors reward chance and maximum count', async () => {
    const runtime = await createRuntime();
    const firstUnit = moveEnemyDeckCardToDrop(runtime, 'unit_dark_guardian_001');
    moveEnemyDeckCardToDrop(runtime, 'unit_dark_archer_001');

    const rewards = calculateStageRewards(
      runtime,
      {
        ...TEST_STAGE_DEFINITION,
        rewards: {
          ...TEST_STAGE_DEFINITION.rewards,
          enemyCardDrop: {
            source: 'ENEMY_DROP',
            chancePercent: 50,
            maxCards: 1,
            excludeLeader: true,
          },
        },
      },
      { random: () => 0.49 },
    );

    expect(rewards.rewardCardInstanceIds).toEqual([firstUnit.card.instance.instanceId]);
    expect(rewards.rewardCardNames).toEqual([firstUnit.card.instance.name]);
  });

  it('updates stage progress for wins without duplicating cleared stage ids', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession({
      ...state,
      stageProgress: {
        clearedStageIds: ['test-stage-dark'],
        lastSelectedStageId: null,
      },
    });

    const nextSession = applyStageBattleResultToSession(session, {
      stageId: 'test-stage-dark',
      outcome: 'WIN',
      reason: 'ENEMY_LEADER_DEFEATED',
      rewardCardInstanceIds: [],
      rewardCardNames: [],
      turnNumber: 1,
    });

    expect(nextSession.stageProgress).toEqual({
      clearedStageIds: ['test-stage-dark'],
      lastSelectedStageId: 'test-stage-dark',
    });
  });

  it('preserves cleared stage ids for losses', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession({
      ...state,
      stageProgress: {
        clearedStageIds: [],
        lastSelectedStageId: null,
      },
    });

    const nextSession = applyStageBattleResultToSession(session, {
      stageId: 'test-stage-dark',
      outcome: 'LOSE',
      reason: 'PLAYER_LEADER_DEFEATED',
      rewardCardInstanceIds: [],
      rewardCardNames: [],
      turnNumber: 1,
    });

    expect(nextSession.stageProgress).toEqual({
      clearedStageIds: [],
      lastSelectedStageId: 'test-stage-dark',
    });
  });

  it('does not persist battle-time player stat changes after applying a stage result', async () => {
    const state = await createInitialSaveState({ slotId: 1 });
    const session = createGameSession(state);
    const originalLeaderStats = {
      hp: session.deck.leader.instance.hp,
      attack: session.deck.leader.instance.attack,
      cost: session.deck.leader.instance.cost,
      dominance: session.deck.leader.instance.dominance,
    };
    const originalFirstCardStats = {
      hp: session.deck.cards[0]!.instance.hp,
      attack: session.deck.cards[0]!.instance.attack,
      cost: session.deck.cards[0]!.instance.cost,
      dominance: session.deck.cards[0]!.instance.dominance,
    };
    const runtime = createInitialBattleRuntime(session, TEST_STAGE_DEFINITION);

    runtime.player.leader.card.instance.hp = 1;
    runtime.player.leader.card.instance.attack = 1;
    runtime.player.leader.card.instance.cost = 0;
    runtime.player.leader.card.instance.dominance = 0;
    runtime.player.hand[0]!.card.instance.hp = 1;
    runtime.player.hand[0]!.card.instance.attack = 1;
    runtime.player.hand[0]!.card.instance.cost = 0;
    runtime.player.hand[0]!.card.instance.dominance = 0;
    runtime.phase = 'GAME_OVER';
    runtime.outcome = {
      winner: 'player',
      loser: 'enemy',
      reason: 'LEADER_DEFEATED',
    };

    const result = createStageBattleResult(runtime, TEST_STAGE_DEFINITION, {
      random: () => 1,
    });
    const nextSession = applyStageBattleResultToSession(session, result);
    const savedState = createSaveSlotStateFromGameSession(nextSession, {
      now: new Date('2024-01-02T00:00:00.000Z'),
    });

    expect({
      hp: savedState.deck.leader.hp,
      attack: savedState.deck.leader.attack,
      cost: savedState.deck.leader.cost,
      dominance: savedState.deck.leader.dominance,
    }).toEqual(originalLeaderStats);
    expect({
      hp: savedState.deck.cards[0]!.hp,
      attack: savedState.deck.cards[0]!.attack,
      cost: savedState.deck.cards[0]!.cost,
      dominance: savedState.deck.cards[0]!.dominance,
    }).toEqual(originalFirstCardStats);
  });
});

async function createRuntime(): Promise<BattleRuntimeState> {
  const state = await createInitialSaveState({ slotId: 1 });
  return createInitialBattleRuntime(createGameSession(state), TEST_STAGE_DEFINITION);
}

function moveEnemyDeckCardToDrop(
  runtime: BattleRuntimeState,
  definitionId: string,
): BattleCardRuntimeState {
  const card = runtime.enemy.deck.find(
    (candidate) => candidate.card.definition.id === definitionId,
  );
  if (!card) {
    throw new Error(`Missing enemy deck card: ${definitionId}`);
  }

  runtime.enemy.deck = runtime.enemy.deck.filter((candidate) => candidate !== card);
  card.zone = 'DROP';
  card.deckIndex = null;
  runtime.enemy.drop.push(card);
  runtime.drop.push(card);
  return card;
}

function movePlayerHandCardToEnemyDrop(runtime: BattleRuntimeState): void {
  const card = runtime.player.hand[0];
  if (!card) {
    throw new Error('Missing player hand card');
  }

  runtime.player.hand = runtime.player.hand.filter((candidate) => candidate !== card);
  card.side = 'enemy';
  card.zone = 'DROP';
  runtime.enemy.drop.push(card);
  runtime.drop.push(card);
}
