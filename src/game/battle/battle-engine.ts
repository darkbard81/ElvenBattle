import type {
  ActiveSkillBattleAction,
  AttackBattleAction,
  BattleAvailableActions,
  BattleCardRuntimeState,
  BattlefieldZone,
  BattleParticipantRuntimeState,
  BattleRuntimeState,
  BattleSide,
  BattleSlotId,
  MoveBattleAction,
  PlaceBattleAction,
} from './types';

const BATTLEFIELD_ZONES: readonly BattlefieldZone[] = ['FR', 'FC', 'FL', 'BR', 'BC', 'BL'];
const SLOT_COORDINATES: Record<BattlefieldZone, { x: number; y: number }> = {
  FR: { x: 0, y: 0 },
  FC: { x: 1, y: 0 },
  FL: { x: 2, y: 0 },
  BR: { x: 0, y: 1 },
  BC: { x: 1, y: 1 },
  BL: { x: 2, y: 1 },
};

/**
 * 지정한 전장 슬롯을 점유한 카드를 반환한다.
 * 전장 슬롯이 비어 있거나 전투에서 이탈한 카드만 남아 있으면 `null`을 반환한다.
 */
export function findBattlefieldCardAtSlot(
  runtime: BattleRuntimeState,
  slotId: BattleSlotId,
): BattleCardRuntimeState | null {
  return (
    runtime.battlefield.find(
      (card) => card.zone === 'BATTLEFIELD' && card.battlefieldSlot === slotId,
    ) ?? null
  );
}

/**
 * 빈 전장 슬롯에 인접한 같은 진영 카드의 지배력 합계를 계산한다.
 * 이미 점유된 슬롯은 배치 대상이 아니므로 항상 0으로 취급한다.
 */
export function calculateSlotDominance(
  runtime: BattleRuntimeState,
  slotId: BattleSlotId,
): number {
  if (findBattlefieldCardAtSlot(runtime, slotId)) {
    return 0;
  }

  const { side, zone } = parseBattleSlotId(slotId);
  return getAdjacentSlotIds(side, zone).reduce((total, adjacentSlotId) => {
    const card = findBattlefieldCardAtSlot(runtime, adjacentSlotId);
    if (!card || card.side !== side) {
      return total;
    }

    return total + readCardNumber(card.card.instance.dominance, 0);
  }, 0);
}

/**
 * 현재 전투 상태에서 지정 진영이 수행할 수 있는 손패 배치 후보를 계산한다.
 * 후보는 손패 카드 비용이 대상 빈 슬롯의 지배력 이하일 때만 생성된다.
 */
export function listPlaceActions(
  runtime: BattleRuntimeState,
  side: BattleSide = runtime.currentSide,
): PlaceBattleAction[] {
  if (runtime.phase !== 'MAIN' || side !== runtime.currentSide) {
    return [];
  }

  const participant = getParticipant(runtime, side);
  const actions: PlaceBattleAction[] = [];
  for (const card of participant.hand) {
    if (card.handIndex === null) {
      continue;
    }

    const cost = readCardNumber(card.card.instance.cost, 0);
    for (const toSlotId of getSideSlotIds(side)) {
      const dominance = calculateSlotDominance(runtime, toSlotId);
      if (dominance >= cost && !findBattlefieldCardAtSlot(runtime, toSlotId)) {
        actions.push({
          type: 'PLACE',
          cardInstanceId: card.card.instance.instanceId,
          fromHandIndex: card.handIndex,
          toSlotId,
          dominance,
          cost,
        });
      }
    }
  }

  return actions;
}

/**
 * 현재 전투 상태에서 지정 진영의 전장 카드가 이동할 수 있는 후보를 계산한다.
 * 이동은 공격 단계에 들어가기 전, 카드별 턴당 1회만 허용한다.
 */
export function listMoveActions(
  runtime: BattleRuntimeState,
  side: BattleSide = runtime.currentSide,
): MoveBattleAction[] {
  if (runtime.phase !== 'MAIN' || side !== runtime.currentSide) {
    return [];
  }

  const actions: MoveBattleAction[] = [];
  for (const card of listBattlefieldCards(runtime, side)) {
    if (
      card.battlefieldSlot === null ||
      card.hasMovedThisTurn ||
      card.hasAttackedThisTurn
    ) {
      continue;
    }

    const { zone } = parseBattleSlotId(card.battlefieldSlot);
    const emptyAdjacentSlots = getAdjacentSlotIds(side, zone).filter(
      (slotId) => !findBattlefieldCardAtSlot(runtime, slotId),
    );
    for (const toSlotId of emptyAdjacentSlots) {
      actions.push({
        type: 'MOVE',
        cardInstanceId: card.card.instance.instanceId,
        fromSlotId: card.battlefieldSlot,
        toSlotId,
      });
    }
  }

  return actions;
}

/**
 * 현재 전투 상태에서 지정 진영의 공격 후보를 계산한다.
 * 공격 대상은 이번 이슈 범위에서 모든 적 전장 카드와 적 리더로 단순화한다.
 */
export function listAttackActions(
  runtime: BattleRuntimeState,
  side: BattleSide = runtime.currentSide,
): AttackBattleAction[] {
  if (runtime.phase === 'GAME_OVER' || side !== runtime.currentSide) {
    return [];
  }

  const targets = listBattlefieldCards(runtime, getOpposingSide(side));
  const actions: AttackBattleAction[] = [];
  for (const attacker of listBattlefieldCards(runtime, side)) {
    if (
      attacker.battlefieldSlot === null ||
      attacker.hasAttackedThisTurn ||
      readCardNumber(attacker.card.instance.attack, 0) <= 0
    ) {
      continue;
    }

    for (const target of targets) {
      if (target.battlefieldSlot === null || readCardNumber(target.card.instance.hp, 0) <= 0) {
        continue;
      }

      actions.push({
        type: 'ATTACK',
        attackerInstanceId: attacker.card.instance.instanceId,
        targetInstanceId: target.card.instance.instanceId,
        fromSlotId: attacker.battlefieldSlot,
        toSlotId: target.battlefieldSlot,
        attack: readCardNumber(attacker.card.instance.attack, 0),
      });
    }
  }

  return actions;
}

/**
 * 현재 카드 데이터 기준으로 가능한 활성 스킬 후보를 반환한다.
 * 아직 실제 활성 스킬 데이터가 없으므로 자동 턴 종료 계산을 위한 빈 배열만 반환한다.
 */
export function listActiveSkillActions(
  runtime: BattleRuntimeState,
  side: BattleSide = runtime.currentSide,
): ActiveSkillBattleAction[] {
  void runtime;
  void side;
  return [];
}

/**
 * Place, Move, Active Skill, Attack 후보를 한 번에 계산한다.
 * Scene은 이 결과만 사용해 입력 가능 상태와 하이라이트를 구성한다.
 */
export function listAvailableActions(
  runtime: BattleRuntimeState,
  side: BattleSide = runtime.currentSide,
): BattleAvailableActions {
  return {
    placeActions: listPlaceActions(runtime, side),
    moveActions: listMoveActions(runtime, side),
    activeSkillActions: listActiveSkillActions(runtime, side),
    attackActions: listAttackActions(runtime, side),
  };
}

/**
 * 합법 배치 액션을 전투 런타임에 적용한다.
 * 손패 배열에서 카드를 제거하고 전장 슬롯에 배치한 뒤 남은 손패 index를 재정렬한다.
 */
export function applyPlaceAction(
  runtime: BattleRuntimeState,
  action: PlaceBattleAction,
): void {
  assertLegalPlaceAction(runtime, action);

  const participant = getParticipant(runtime, runtime.currentSide);
  const cardIndex = participant.hand.findIndex(
    (card) =>
      card.card.instance.instanceId === action.cardInstanceId &&
      card.handIndex === action.fromHandIndex,
  );
  const card = participant.hand[cardIndex];
  if (!card) {
    throw new Error(`Unknown hand card instanceId: ${action.cardInstanceId}`);
  }

  participant.hand.splice(cardIndex, 1);
  card.zone = 'BATTLEFIELD';
  card.battlefieldSlot = action.toSlotId;
  card.handIndex = null;
  card.deckIndex = null;
  runtime.battlefield.push(card);
  reindexHand(participant);
}

/**
 * 합법 이동 액션을 전투 런타임에 적용한다.
 * 이동한 카드는 같은 턴에 다시 이동할 수 없도록 행동 플래그를 갱신한다.
 */
export function applyMoveAction(runtime: BattleRuntimeState, action: MoveBattleAction): void {
  assertLegalMoveAction(runtime, action);

  const card = findBattlefieldCardByInstanceId(runtime, action.cardInstanceId);
  if (!card) {
    throw new Error(`Unknown battlefield card instanceId: ${action.cardInstanceId}`);
  }

  card.battlefieldSlot = action.toSlotId;
  card.hasMovedThisTurn = true;
}

/**
 * 합법 공격 액션을 전투 런타임에 적용한다.
 * 피해 결과에 따라 일반 카드는 DROP으로 보내고, 리더가 쓰러지면 전투 결과를 기록한다.
 */
export function applyAttackAction(runtime: BattleRuntimeState, action: AttackBattleAction): void {
  assertLegalAttackAction(runtime, action);

  const attacker = findBattlefieldCardByInstanceId(runtime, action.attackerInstanceId);
  const target = findBattlefieldCardByInstanceId(runtime, action.targetInstanceId);
  if (!attacker || !target) {
    throw new Error('Attack action references an unknown card');
  }

  runtime.phase = 'ATTACK';
  attacker.hasAttackedThisTurn = true;
  target.card.instance.hp = readCardNumber(target.card.instance.hp, 0) - action.attack;

  if (target.card.instance.hp > 0) {
    return;
  }

  if (isLeaderCard(runtime, target)) {
    runtime.phase = 'GAME_OVER';
    runtime.outcome = {
      winner: attacker.side,
      loser: target.side,
      reason: 'LEADER_DEFEATED',
    };
    return;
  }

  moveBattlefieldCardToDrop(runtime, target);
}

/**
 * 현재 턴을 종료하고 다음 진영의 MAIN 단계로 넘긴다.
 * 적 턴에서 플레이어 턴으로 돌아올 때만 라운드 번호를 증가시킨다.
 */
export function applyTurnEnd(runtime: BattleRuntimeState): void {
  if (runtime.phase === 'GAME_OVER') {
    return;
  }

  const nextSide = getOpposingSide(runtime.currentSide);
  if (runtime.currentSide === 'enemy' && nextSide === 'player') {
    runtime.turnNumber += 1;
  }

  runtime.currentSide = nextSide;
  runtime.phase = 'MAIN';
  resetTurnFlagsForSide(runtime, nextSide);
}

/**
 * 가능한 Place, Move, Active Skill, Attack이 모두 없으면 자동으로 턴을 한 번 종료한다.
 * 연속 자동 진행은 호출자가 적 턴 정책에 맞춰 별도로 제어한다.
 */
export function applyAutoTurnEndIfStalled(runtime: BattleRuntimeState): boolean {
  if (runtime.phase === 'GAME_OVER') {
    return false;
  }

  const actions = listAvailableActions(runtime, runtime.currentSide);
  if (
    actions.placeActions.length > 0 ||
    actions.moveActions.length > 0 ||
    actions.activeSkillActions.length > 0 ||
    actions.attackActions.length > 0
  ) {
    return false;
  }

  applyTurnEnd(runtime);
  return true;
}

function assertLegalPlaceAction(runtime: BattleRuntimeState, action: PlaceBattleAction): void {
  const isLegal = listPlaceActions(runtime).some(
    (candidate) =>
      candidate.cardInstanceId === action.cardInstanceId &&
      candidate.fromHandIndex === action.fromHandIndex &&
      candidate.toSlotId === action.toSlotId,
  );
  if (!isLegal) {
    throw new Error('Illegal place action');
  }
}

function assertLegalMoveAction(runtime: BattleRuntimeState, action: MoveBattleAction): void {
  const isLegal = listMoveActions(runtime).some(
    (candidate) =>
      candidate.cardInstanceId === action.cardInstanceId &&
      candidate.fromSlotId === action.fromSlotId &&
      candidate.toSlotId === action.toSlotId,
  );
  if (!isLegal) {
    throw new Error('Illegal move action');
  }
}

function assertLegalAttackAction(runtime: BattleRuntimeState, action: AttackBattleAction): void {
  const isLegal = listAttackActions(runtime).some(
    (candidate) =>
      candidate.attackerInstanceId === action.attackerInstanceId &&
      candidate.targetInstanceId === action.targetInstanceId,
  );
  if (!isLegal) {
    throw new Error('Illegal attack action');
  }
}

function getParticipant(
  runtime: BattleRuntimeState,
  side: BattleSide,
): BattleParticipantRuntimeState {
  return side === 'player' ? runtime.player : runtime.enemy;
}

function listBattlefieldCards(
  runtime: BattleRuntimeState,
  side: BattleSide,
): BattleCardRuntimeState[] {
  return runtime.battlefield.filter(
    (card) => card.side === side && card.zone === 'BATTLEFIELD' && card.battlefieldSlot !== null,
  );
}

function findBattlefieldCardByInstanceId(
  runtime: BattleRuntimeState,
  instanceId: string,
): BattleCardRuntimeState | null {
  return (
    runtime.battlefield.find(
      (card) => card.zone === 'BATTLEFIELD' && card.card.instance.instanceId === instanceId,
    ) ?? null
  );
}

function getOpposingSide(side: BattleSide): BattleSide {
  return side === 'player' ? 'enemy' : 'player';
}

function getSideSlotIds(side: BattleSide): BattleSlotId[] {
  return BATTLEFIELD_ZONES.map((zone) => formatBattleSlotId(side, zone));
}

function getAdjacentSlotIds(side: BattleSide, zone: BattlefieldZone): BattleSlotId[] {
  const origin = SLOT_COORDINATES[zone];
  return BATTLEFIELD_ZONES.filter((candidate) => {
    const position = SLOT_COORDINATES[candidate];
    return Math.abs(position.x - origin.x) + Math.abs(position.y - origin.y) === 1;
  }).map((candidate) => formatBattleSlotId(side, candidate));
}

function parseBattleSlotId(slotId: BattleSlotId): {
  side: BattleSide;
  zone: BattlefieldZone;
} {
  const [side, zone] = slotId.split(':') as [BattleSide, BattlefieldZone];
  return { side, zone };
}

function formatBattleSlotId(side: BattleSide, zone: BattlefieldZone): BattleSlotId {
  return `${side}:${zone}`;
}

function readCardNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function reindexHand(participant: BattleParticipantRuntimeState): void {
  participant.hand.forEach((card, index) => {
    card.handIndex = index;
  });
}

function resetTurnFlagsForSide(runtime: BattleRuntimeState, side: BattleSide): void {
  for (const card of listBattlefieldCards(runtime, side)) {
    card.hasMovedThisTurn = false;
    card.hasAttackedThisTurn = false;
    card.hasUsedActiveSkillThisTurn = false;
  }
}

function isLeaderCard(runtime: BattleRuntimeState, card: BattleCardRuntimeState): boolean {
  return getParticipant(runtime, card.side).leader === card;
}

function moveBattlefieldCardToDrop(
  runtime: BattleRuntimeState,
  card: BattleCardRuntimeState,
): void {
  runtime.battlefield = runtime.battlefield.filter(
    (entry) => entry.card.instance.instanceId !== card.card.instance.instanceId,
  );
  card.zone = 'DROP';
  card.battlefieldSlot = null;
  card.handIndex = null;
  card.deckIndex = null;
  getParticipant(runtime, card.side).drop.push(card);
  runtime.drop.push(card);
}
