import type { BattleCardRuntimeState, BattleRuntimeState } from '../battle/types';
import type { GameSession } from '../save/session';
import type { StageBattleResult, StageDefinition, StageRewardResult } from './types';

type StageRewardOptions = {
  random?: () => number;
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
      : { rewardCardInstanceIds: [], rewardCardNames: [] };

  return {
    stageId: stageDefinition.id,
    outcome,
    reason: runtime.outcome.loser === 'enemy' ? 'ENEMY_LEADER_DEFEATED' : 'PLAYER_LEADER_DEFEATED',
    rewardCardInstanceIds: rewardResult.rewardCardInstanceIds,
    rewardCardNames: rewardResult.rewardCardNames,
    turnNumber: runtime.turnNumber,
  };
}

/**
 * Stage 보상 정의와 전투 중 격파된 적 카드 상태를 바탕으로 표시용 보상 결과를 만든다.
 * 현재 MVP는 적 DROP에 들어간 UNIT 카드 중 설정된 확률과 최대 수량만큼만 선택한다.
 */
export function calculateStageRewards(
  runtime: BattleRuntimeState,
  stageDefinition: StageDefinition,
  options: StageRewardOptions = {},
): StageRewardResult {
  const dropDefinition = stageDefinition.rewards.enemyCardDrop;
  if (!dropDefinition || dropDefinition.maxCards <= 0 || dropDefinition.chancePercent <= 0) {
    return {
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

  return {
    rewardCardInstanceIds: rewardCards.map((card) => card.card.instance.instanceId),
    rewardCardNames: rewardCards.map((card) => card.card.instance.name),
  };
}

/**
 * Stage 전투 결과를 세션 진행도에 반영한다.
 * 승리한 Stage는 중복 없이 클리어 목록에 넣고, 승패와 관계없이 마지막 선택 Stage를 갱신한다.
 */
export function applyStageBattleResultToSession(
  session: GameSession,
  result: StageBattleResult,
): GameSession {
  const clearedStageIds =
    result.outcome === 'WIN' && !session.stageProgress.clearedStageIds.includes(result.stageId)
      ? [...session.stageProgress.clearedStageIds, result.stageId]
      : [...session.stageProgress.clearedStageIds];

  return {
    ...session,
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
