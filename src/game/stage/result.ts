import type { BattleCardRuntimeState, BattleRuntimeState } from '../battle/types';
import { createCardInstanceFromDefinition } from '../save/deck-instancing';
import type { GameSession } from '../save/session';
import type { CardInstance } from '../save/types';
import type { StageBattleResult, StageDefinition, StageRewardResult } from './types';

type StageRewardOptions = {
  random?: () => number;
  createRewardCardId?: () => string;
};

/**
 * 전투 런타임의 종료 상태를 StageScene에 전달할 Stage 결과로 변환한다.
 * 승패 판정은 전투 엔진이 만든 `runtime.outcome`만 신뢰하며, Scene에서 별도 규칙을 만들지 않게 한다.
 */
export function createStageBattleResult(
  runtime: BattleRuntimeState,
  stageDefinition: StageDefinition,
  options: StageRewardOptions = {},
): StageBattleResult {
  if (!runtime.outcome) {
    throw new Error('Cannot create a stage battle result before battle outcome is decided');
  }

  const outcome = runtime.outcome.winner === 'player' ? 'WIN' : 'LOSE';
  const rewardResult =
    outcome === 'WIN'
      ? calculateStageRewards(runtime, stageDefinition, options)
      : { rewardCards: [], rewardCardInstanceIds: [], rewardCardNames: [] };

  return {
    stageId: stageDefinition.id,
    outcome,
    reason: runtime.outcome.loser === 'enemy' ? 'ENEMY_LEADER_DEFEATED' : 'PLAYER_LEADER_DEFEATED',
    rewardCards: rewardResult.rewardCards,
    rewardCardInstanceIds: rewardResult.rewardCardInstanceIds,
    rewardCardNames: rewardResult.rewardCardNames,
    turnNumber: runtime.turnNumber,
  };
}

/**
 * Stage 보상 정의와 전투 중 격파된 적 카드 상태를 바탕으로 저장 가능한 보상 카드를 만든다.
 * 현재 MVP는 적 DROP에 들어간 UNIT 카드를 새 PLAYER 보유 카드 인스턴스로 복제한다.
 */
export function calculateStageRewards(
  runtime: BattleRuntimeState,
  stageDefinition: StageDefinition,
  options: StageRewardOptions = {},
): StageRewardResult {
  const dropDefinition = stageDefinition.rewards.enemyCardDrop;
  if (!dropDefinition || dropDefinition.maxCards <= 0 || dropDefinition.chancePercent <= 0) {
    return {
      rewardCards: [],
      rewardCardInstanceIds: [],
      rewardCardNames: [],
    };
  }

  const random = options.random ?? Math.random;
  const rewardCards: BattleCardRuntimeState[] = [];
  for (const card of runtime.enemy.drop) {
    if (rewardCards.length >= dropDefinition.maxCards) {
      break;
    }
    if (!isRewardCandidate(card, dropDefinition.excludeLeader)) {
      continue;
    }
    if (random() * 100 >= dropDefinition.chancePercent) {
      continue;
    }

    rewardCards.push(card);
  }

  const rewardCardInstances = rewardCards.map((card) => {
    const createOptions = {
      definition: card.card.definition,
      owner: 'PLAYER',
      zone: 'COLLECTION',
    } as const;

    return options.createRewardCardId
      ? createCardInstanceFromDefinition({
          ...createOptions,
          createId: options.createRewardCardId,
        })
      : createCardInstanceFromDefinition(createOptions);
  });

  return {
    rewardCards: rewardCardInstances,
    rewardCardInstanceIds: rewardCardInstances.map((card) => card.instanceId),
    rewardCardNames: rewardCardInstances.map((card) => card.name),
  };
}

/**
 * Stage 전투 결과를 세션 진행도에 반영한다.
 * 승리한 Stage는 중복 없이 클리어 목록에 넣고, 지급 보상은 보유 카드 컬렉션에 추가한다.
 */
export function applyStageBattleResultToSession(
  session: GameSession,
  result: StageBattleResult,
): GameSession {
  const clearedStageIds =
    result.outcome === 'WIN' && !session.stageProgress.clearedStageIds.includes(result.stageId)
      ? [...session.stageProgress.clearedStageIds, result.stageId]
      : [...session.stageProgress.clearedStageIds];

  const knownCollectionCardIds = new Set(
    session.collection.cards.map((card) => card.instance.instanceId),
  );
  const rewardCards: CardInstance[] = [];
  if (result.outcome === 'WIN') {
    for (const card of result.rewardCards) {
      if (knownCollectionCardIds.has(card.instanceId)) {
        continue;
      }

      knownCollectionCardIds.add(card.instanceId);
      rewardCards.push(card);
    }
  }

  return {
    ...session,
    collection: {
      cards: [
        ...session.collection.cards,
        ...rewardCards.map((card) => ({
          instance: structuredClone(card),
          definition: structuredClone(card),
        })),
      ],
    },
    stageProgress: {
      clearedStageIds,
      lastSelectedStageId: result.stageId,
    },
  };
}

function isRewardCandidate(card: BattleCardRuntimeState, excludeLeader: boolean): boolean {
  if (card.card.instance.owner !== 'ENEMY') {
    return false;
  }
  if (excludeLeader && card.card.definition.type === 'LEADER') {
    return false;
  }

  return card.card.definition.type === 'UNIT';
}
