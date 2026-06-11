# Phase 10 목표 지시문 — 승리 조건 및 게임 종료 구현

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 승리 조건 판정, 게임 종료 상태 전환, `GAME_ENDED` 이벤트, PvE 목표 기반 종료 확장점을 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 10을 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

## 기준 문서

- `documents/Plan.md`
- `documents/Core_Rule_Spec_v0.1.md`
- `documents/Phase2_Goal.md`
- `documents/Phase3_Goal.md`
- `documents/Phase4_Goal.md`
- `documents/Phase5_Goal.md`
- `documents/Phase6_Goal.md`
- `documents/Phase7_Goal.md`
- `documents/Phase8_Goal.md`
- `documents/Phase9_Goal.md`
- `AGENTS.md`

## Phase 10의 위치

`documents/Plan.md`에서 Phase 10은 다음 단계다.

- Phase 8: 효과 처리 엔진 구현
- Phase 9: 카드 Asset Pipeline 및 카드 렌더러 구축
- Phase 10: 승리 조건 및 게임 종료 구현
- Phase 11: 저장 / 리플레이 / 결정론 시스템 구현
- Phase 12 이후: AI, Phaser UI, PvE 콘텐츠, 배포 구현

따라서 Phase 10은 Phase4~8의 룰 처리 결과에서 게임 종료 여부를 판정하고, `GameState`를 `GAME_OVER`/`FINISHED` 상태로 고정하는 단계다. 저장 파일 포맷, 리플레이 재생기, AI 행동 탐색, Phaser 종료 화면, 실제 PvE 스테이지 콘텐츠 제작은 이후 Phase로 남긴다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- 룰 엔진은 Phaser, DOM, 브라우저 전역 객체, 네트워크 API에 의존하지 않는다.
- 승리 조건 판정은 순수 TypeScript 룰 계층에 둔다.
- 카드 렌더러와 카드 Asset Pipeline은 승리 조건 판정에 관여하지 않는다.
- `GameState.winner`, `gameStatus`, `phase`, `eventLog`, `actionLog`는 종료 판정의 정규 근거가 된다.
- 종료 판정은 `CardDefinition`과 `CardInstance`의 룰 값을 기준으로 하며, 표시용 카드 이미지나 UI 텍스트를 참조하지 않는다.
- 승리 조건은 액션 처리 후, 이벤트 큐 flush 후, 페이즈 종료 후, 드로우 실패 후, 전투/효과 피해 처리 후 호출될 수 있어야 한다.
- `GAME_ENDED` 이벤트는 게임당 한 번만 기록한다.
- 이미 `FINISHED` 또는 `ABORTED`인 게임에는 새 액션이 상태를 변경하지 않아야 한다.
- 동시에 여러 종료 조건이 만족되면 결정론적 우선순위로 하나의 종료 결과를 선택한다.
- Phase10은 PvE 목표 기반 종료의 최소 평가 구조를 만들지만, 실제 스테이지 데이터와 보스 연출은 만들지 않는다.
- Phase10은 리플레이 파일 포맷을 확정하지 않는다. 단, Phase11이 재생할 수 있도록 action/event log의 결정론적 순서를 보존한다.
- 모든 상태 변경 함수는 입력 `GameState`를 직접 mutation하지 않는 방식으로 구현한다.

## Phase 10 최종 목표

다음 기능을 구현한다.

- 승리 조건 타입과 종료 사유 타입 정의
- 기본 승리 조건 설정 헬퍼
- `checkWinConditions(state)` 구현
- HP 0 이하 기반 승패 판정
- 양 플레이어 HP가 동시에 0 이하가 된 경우의 결정론적 처리
- 덱 아웃 패배 처리
- 드로우 실패와 덱 아웃 판정 연결
- 턴 제한 종료 처리
- PvE 보스 처치 목표 판정
- PvE 퍼즐 목표 판정 확장점
- 지배력 목표 판정 확장점
- 항복 액션 또는 항복 종료 헬퍼
- 비정상 상태 abort 헬퍼
- 종료 결과를 `GameState`에 적용하는 `finalizeGame` 구현
- `GAME_ENDED` 이벤트 생성
- `phase = 'GAME_OVER'`, `gameStatus = 'FINISHED'`, `winner` 고정
- 종료 후 action 검증 실패 처리
- 액션 처리, 페이즈 처리, 드로우, 전투, 효과 큐와 종료 판정 연결
- 종료 판정과 이벤트 기록의 결정론 테스트

Phase 10 완료 시점에는 다음이 가능해야 한다.

- 상대 플레이어 HP가 0 이하가 되면 게임이 종료된다.
- 자기 플레이어 HP가 0 이하가 되면 패배한다.
- 양 플레이어 HP가 동시에 0 이하가 되면 정책에 따라 무승부 또는 우선순위 기반 결과가 결정론적으로 선택된다.
- 덱이 비어 있는데 드로우해야 하면 해당 플레이어가 패배한다.
- 턴 제한이 설정된 게임은 지정된 턴 조건에서 종료된다.
- 시나리오가 지정한 보스 유닛이 파괴되면 승리 조건으로 판정할 수 있다.
- 시나리오가 지정한 퍼즐 목표나 지배력 목표는 Phase13에서 확장 가능한 형태로 평가된다.
- 게임 종료 시 `GAME_ENDED` 이벤트가 정확히 한 번 기록된다.
- 게임 종료 후에는 `END_PHASE`, `END_TURN`, `SUMMON_UNIT`, `ATTACK`, `ACTIVATE_EFFECT` 등 어떤 액션도 상태를 바꾸지 않는다.
- 종료 판정은 같은 입력 상태에서 항상 같은 결과를 만든다.
- 종료 이벤트와 action/event log 순서는 Phase11 리플레이 구현이 재사용할 수 있을 만큼 안정적이다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/game/win.ts` | 승리 조건 평가, 종료 우선순위, 기본 조건 헬퍼 |
| `src/game/end.ts` | `finalizeGame`, 항복, abort, 종료 상태 고정 |
| `src/game/types.ts` | `WinCondition`, `GameEndReason`, `GameEndResult`, 시나리오 목표 타입 보강 |
| `src/game/action.ts` | 액션 성공 후 종료 판정 연결, 항복 액션 dispatch |
| `src/game/phase.ts` | 페이즈 전환 후 종료 판정 연결, `GAME_OVER` 처리 보강 |
| `src/game/turn.ts` | 턴 제한과 턴 종료 후 종료 판정 연결 |
| `src/game/index.ts` | Phase10 Game API re-export |
| `src/events/factory.ts` | `GAME_ENDED`, 필요 시 `DECK_OUT_CHECKED` 이벤트 생성 헬퍼 |
| `src/events/types.ts` | 종료 이벤트 payload 타입 보강 |
| `src/zones/draw.ts` | 빈 덱 드로우 결과를 덱 아웃 판정으로 연결 |
| `src/battle/attack.ts` | 전투 피해와 파괴 처리 후 종료 판정 연결 |
| `src/effects/queue.ts` | 이벤트 큐 flush 후 종료 판정 연결 |
| `src/effects/dsl.ts` | 효과 피해/회복 후 종료 판정 확장점 연결 |
| `src/rules/types.ts` | 종료/항복/덱 아웃/무승부 관련 오류 코드와 검증 타입 보강 |
| `src/rules/validation.ts` | 종료 상태 액션 거부 정책 보강 |
| `tests/win-condition.test.ts` | HP, 동시 HP 0, 턴 제한, 보스 목표 판정 테스트 |
| `tests/game-end.test.ts` | `finalizeGame`, `GAME_ENDED` 단일 기록, 종료 상태 고정 테스트 |
| `tests/deck-out.test.ts` | 빈 덱 드로우와 덱 아웃 패배 테스트 |
| `tests/surrender-abort.test.ts` | 항복과 비정상 종료 테스트 |
| `tests/phase10-apply-action.test.ts` | 액션 처리 후 종료 판정 통합 테스트 |
| `tests/phase10-effects-integration.test.ts` | 효과 큐 처리 후 종료 판정 통합 테스트 |

기존 Phase3~9 타입 파일은 필요한 경우에만 좁게 보강한다. 특히 Phase10을 위해 저장 파일 포맷, 리플레이 재생기, AI 평가 함수, Phaser UI 종료 화면을 앞당겨 만들지 않는다.

## 2. 승리 조건 타입

Core Rule Spec의 승리 조건 모델을 기준으로 Phase10 MVP 타입을 정의한다.

권장 타입:

```ts
export type WinCondition =
  | { type: 'OPPONENT_HP_ZERO' }
  | { type: 'DECK_OUT_LOSS' }
  | { type: 'TURN_LIMIT'; maxTurns: number; result: 'WIN' | 'LOSS' | 'DRAW_BY_SCORE' }
  | { type: 'BOSS_DEFEATED'; bossUnitId: InstanceId; winnerId: PlayerId }
  | { type: 'PUZZLE_OBJECTIVE'; objectiveId: string; winnerId: PlayerId }
  | { type: 'DOMINANCE_OBJECTIVE'; playerId: PlayerId; threshold: number; turns: number }
  | { type: 'SURRENDER' }
  | { type: 'INVALID_STATE_ABORT' };

export type GameEndReason =
  | 'OPPONENT_HP_ZERO'
  | 'PLAYER_HP_ZERO'
  | 'BOTH_PLAYERS_HP_ZERO'
  | 'DECK_OUT'
  | 'TURN_LIMIT'
  | 'BOSS_DEFEATED'
  | 'PUZZLE_OBJECTIVE'
  | 'DOMINANCE_OBJECTIVE'
  | 'SURRENDER'
  | 'INVALID_STATE_ABORT';

export interface GameEndResult {
  winner: PlayerId | null;
  loser: PlayerId | null;
  reason: GameEndReason;
  condition: WinCondition['type'];
  detail?: Record<string, string | number | boolean | null>;
}
```

정책:

- `winner: null`은 무승부 또는 비정상 종료처럼 승자가 없는 종료를 의미한다.
- `loser: null`은 무승부, abort, 혹은 패배자를 특정하지 않는 종료를 의미한다.
- HP 기반 일반전은 `OPPONENT_HP_ZERO`와 `PLAYER_HP_ZERO` reason을 구분할 수 있어야 한다.
- `BOTH_PLAYERS_HP_ZERO`는 Phase10에서 명시 정책을 둔다.
- `SURRENDER`는 제출 플레이어가 loser가 되고 상대가 winner가 된다.
- `INVALID_STATE_ABORT`는 `gameStatus = 'ABORTED'` 또는 `FINISHED` 중 하나를 선택해 일관되게 적용한다. 권장값은 `ABORTED`다.
- Phase10의 `PUZZLE_OBJECTIVE`, `DOMINANCE_OBJECTIVE`는 확장 가능한 평가 구조만 두고 복잡한 시나리오 DSL은 Phase13 이후로 남긴다.

## 3. 종료 판정 우선순위

Core Rule Spec의 기본 우선순위를 따른다.

1. 항복 또는 비정상 종료
2. HP 0 이하
3. 보스 목표 달성
4. 덱 아웃 패배
5. 턴 제한 결과
6. 퍼즐 목표 또는 지배력 목표

세부 정책:

- 명시적 항복은 다른 조건보다 우선한다.
- `INVALID_STATE_ABORT`는 디버그와 복구를 위해 모든 일반 승패보다 우선한다.
- HP 0과 덱 아웃이 같은 처리 흐름에서 동시에 발생하면 HP 0을 먼저 판정한다.
- 시나리오가 `winConditionPriority`를 제공하면 위 기본 우선순위를 덮어쓸 수 있다.
- 시나리오 우선순위도 같은 입력에서 같은 결과를 내야 하며, 현재 시간이나 배열 삽입 순서에 의존하지 않는다.
- 우선순위가 같은 조건이 여러 개면 `condition.type`, 관련 `playerId`, `objectiveId` 문자열 오름차순으로 정렬한다.

필수 헬퍼:

- `getDefaultWinConditions(state): WinCondition[]`
- `getScenarioWinConditions(state): WinCondition[]`
- `getWinConditionPriority(state): WinCondition['type'][]`
- `sortSatisfiedEndResults(state, results): GameEndResult[]`
- `checkWinConditions(state): GameEndResult | null`

## 4. HP 기반 종료

HP 기반 종료는 기본 일반전의 핵심 조건이다.

필수 헬퍼:

- `getLivingPlayerIds(state): PlayerId[]`
- `getDefeatedPlayerIdsByHp(state): PlayerId[]`
- `evaluateHpWinCondition(state): GameEndResult | null`

정책:

- `PlayerState.hp <= 0`이면 해당 플레이어는 HP 기준 패배 후보가 된다.
- 한 명만 HP 0 이하이면 상대 플레이어가 winner다.
- 두 명 이상이 HP 0 이하이면 `BOTH_PLAYERS_HP_ZERO`로 처리한다.
- Phase10 기본 정책은 동시 HP 0을 무승부(`winner = null`)로 처리한다.
- 시나리오가 동시 패배 우선순위를 지정하면 해당 정책으로 winner를 선택할 수 있다.
- HP 기반 종료는 전투 피해, 효과 피해, 비용 지불로 인한 HP 변화 후 모두 확인되어야 한다.

테스트 요구:

- 플레이어가 상대에게 직접 공격 피해를 주어 HP 0 이하가 되면 종료된다.
- 효과 DSL의 `DAMAGE`가 플레이어 HP를 0 이하로 만들면 이벤트 큐 flush 후 종료된다.
- 양쪽 HP가 동시에 0 이하인 state는 항상 같은 `BOTH_PLAYERS_HP_ZERO` 결과를 낸다.
- 이미 종료된 게임에 HP 변화 액션을 다시 적용할 수 없다.

## 5. 덱 아웃 종료

Phase5의 드로우 시스템은 빈 덱 드로우를 Phase10과 연결 가능한 실패 또는 이벤트로 남겼다. Phase10에서는 이를 실제 패배 조건으로 연결한다.

필수 헬퍼:

- `isDeckOut(state, playerId): boolean`
- `markDeckOut(state, playerId): GameState`
- `evaluateDeckOutWinCondition(state): GameEndResult | null`
- `handleDrawFromEmptyDeck(state, playerId): GameState`

정책:

- 드로우해야 하는 시점에 `player.deck.length === 0`이면 덱 아웃이다.
- 덱이 비어 있는 것만으로 즉시 패배하지 않는다. 드로우 시도 또는 덱 아웃 체크가 발생해야 한다.
- 덱 아웃 플레이어는 loser가 되고 상대 플레이어가 winner가 된다.
- 양쪽이 같은 처리 흐름에서 동시에 덱 아웃이면 `winner = null` 무승부로 처리한다.
- 덱 아웃 여부는 `turnState`, `flags`, 또는 명확한 `GameEndResult.detail`로 추적하되 리플레이 가능한 상태여야 한다.
- 빈 덱 드로우 시 `CARD_DRAWN`에 `instanceId`를 넣지 않는다.
- 필요하면 `DECK_OUT_CHECKED` 이벤트를 추가할 수 있지만, Core Rule Spec과 현재 이벤트 타입 경계를 고려해 최소 변경을 우선한다.

테스트 요구:

- 빈 덱에서 자동 DRAW 페이즈가 처리되면 덱 아웃 패배가 발생한다.
- 수동 또는 효과 드로우가 빈 덱을 대상으로 하면 덱 아웃 패배가 발생한다.
- 덱이 비어 있어도 드로우 시도가 없으면 종료되지 않는다.
- 덱 아웃 종료 이벤트 payload에는 패배 playerId와 reason이 포함된다.

## 6. 턴 제한 종료

PvE 퍼즐, 생존전, 챌린지 전투를 위해 턴 제한을 지원한다.

필수 헬퍼:

- `evaluateTurnLimitWinCondition(state, condition): GameEndResult | null`
- `calculateTurnLimitScore(state): number`

정책:

- `turnNumber >= maxTurns`이고 지정된 판정 시점에 도달하면 턴 제한 조건을 평가한다.
- 권장 판정 시점은 턴 종료 처리 후 또는 새 턴 시작 직전이다.
- `result: 'WIN'`이면 기본 플레이어 또는 시나리오 지정 플레이어가 winner다.
- `result: 'LOSS'`이면 기본 플레이어가 loser다.
- `result: 'DRAW_BY_SCORE'`는 Phase10 MVP에서 `winner = null`로 처리하거나, 결정론적 score 계산 헬퍼로 winner를 선택한다.
- score 계산은 HP, `dominance.boardValue`, 남은 유닛 수처럼 현재 state에서 결정론적으로 계산 가능한 값만 사용한다.

테스트 요구:

- 제한 턴 전에는 종료되지 않는다.
- 제한 턴에 도달하면 설정된 결과로 종료된다.
- `DRAW_BY_SCORE`는 같은 state에서 같은 winner 또는 무승부 결과를 낸다.

## 7. PvE 목표 기반 종료

Phase10은 PvE 목표 종료의 엔진 확장점을 만든다.

지원할 최소 목표:

| 목표 | 판정 기준 | Phase10 범위 |
|---|---|---|
| 보스 처치 | 지정 `bossUnitId`가 전장에 없고 파괴/묘지 이동 기록이 있음 | 구현 |
| 퍼즐 목표 | `scenarioState.objectives[objectiveId]`가 완료 상태 | 확장점 |
| 지배력 목표 | 지정 플레이어 `boardValue >= threshold`가 `turns`회 유지 | 기본 카운터 또는 확장점 |

권장 타입 보강:

```ts
export interface ScenarioObjectiveState {
  objectiveId: string;
  completed: boolean;
  progress?: number;
}

export interface ScenarioState {
  scenarioId: string;
  objectives?: Record<string, ScenarioObjectiveState>;
  bossUnitIds?: InstanceId[];
  winConditions?: WinCondition[];
  winConditionPriority?: WinCondition['type'][];
}
```

정책:

- 보스 목표는 특정 `InstanceId`를 참조하므로 테스트 fixture에서 명확히 생성해야 한다.
- 보스 유닛이 파괴되어 `GRAVEYARD`로 이동했거나 `UNIT_DESTROYED` 이벤트가 기록된 경우 목표 달성으로 본다.
- 퍼즐 목표는 Phase10에서 `completed` boolean을 읽는 수준으로 제한한다.
- 지배력 목표의 연속 턴 카운트는 `scenarioState` 또는 `turnState`에 결정론적으로 저장한다.
- 실제 PvE 스테이지 데이터, 보상, 대화, 연출은 만들지 않는다.

테스트 요구:

- 지정 보스 유닛이 파괴되면 winner가 설정된다.
- 다른 유닛이 파괴되어도 보스 목표는 완료되지 않는다.
- `completed: true`인 퍼즐 목표는 종료 결과로 평가된다.
- 지배력 목표는 기준 미달, 기준 달성, 연속 턴 수 충족을 구분한다.

## 8. 게임 종료 적용

종료 결과는 하나의 경로로 `GameState`에 반영한다.

필수 헬퍼:

- `finalizeGame(state, result): GameState`
- `createGameEndedEvent(state, result): GameEvent`
- `hasGameEnded(state): boolean`
- `surrenderGame(state, playerId): GameState`
- `abortGame(state, reason, detail): GameState`

정책:

- `finalizeGame`은 이미 종료된 state에 대해 idempotent하게 동작해야 한다.
- 최초 종료 시 `phase = 'GAME_OVER'`로 설정한다.
- 정상 승패 종료는 `gameStatus = 'FINISHED'`로 설정한다.
- 비정상 종료는 `gameStatus = 'ABORTED'`로 설정한다.
- `winner`는 `GameEndResult.winner`로 설정한다.
- `priorityPlayerId`는 `null`로 설정한다.
- `eventQueue`와 `effectStack`은 종료 직전 처리 정책을 명확히 한다. 권장 정책은 현재 flush가 끝난 뒤 종료 판정을 적용하는 것이다.
- `pendingTriggers`는 종료 후 해결하지 않는다.
- `GAME_ENDED` 이벤트를 `eventLog` 끝에 한 번 추가한다.
- 종료 이후 `actionLog`에는 새 정상 액션을 추가하지 않는다.

`GAME_ENDED` payload 권장 형태:

```ts
export interface GameEndedPayload {
  winner: PlayerId | null;
  loser: PlayerId | null;
  reason: GameEndReason;
  condition: WinCondition['type'];
  detail?: Record<string, string | number | boolean | null>;
}
```

테스트 요구:

- `finalizeGame`을 두 번 호출해도 `GAME_ENDED` 이벤트가 중복되지 않는다.
- 종료 후 `phase`, `gameStatus`, `winner`, `priorityPlayerId`가 고정된다.
- 종료 후 액션 검증은 `ERR_GAME_ALREADY_FINISHED`를 반환한다.
- 종료 이벤트는 마지막 이벤트로 기록된다.

## 9. 액션/페이즈/효과 연결

승리 조건은 한 곳에서만 구현하되 여러 처리 경로에서 호출되어야 한다.

연결 지점:

| 경로 | 호출 시점 |
|---|---|
| `applyAction` | 액션 성공, 이벤트 큐 처리, action/event log 기록 이후 |
| `advancePhase` 또는 `endPhase` | 자동 처리와 `PHASE_CHANGED` 기록 이후 |
| `endTurn` | `TURN_ENDED` 처리와 만료 효과 처리 이후 |
| `drawCard` | 빈 덱 드로우 시도 후 |
| `attack` | 피해, 파괴, 지배력 재계산, 이벤트 큐 처리 이후 |
| `flushEventQueue` | 모든 트리거와 효과 해결 이후 |
| `resolveEffectStack` | 효과 피해/회복/드로우 결과 처리 이후 |

정책:

- 종료 판정 호출은 중복될 수 있지만 `finalizeGame`이 중복 종료를 막아야 한다.
- 이벤트 큐 처리 중간에 HP가 0이 되어도 현재 큐 처리 정책에 따라 flush 후 종료한다.
- 단, 이미 종료된 state에서 새 효과를 해결하지 않도록 `hasGameEnded` 가드를 둔다.
- Phase10에서는 복잡한 interrupt형 종료 효과를 만들지 않는다.
- `applyAction`의 성공 결과는 종료된 state도 정상 성공으로 반환할 수 있다. 예를 들어 공격 액션이 성공했고 그 결과 게임이 끝난 경우다.
- 종료 상태에서 시작한 액션은 실패 결과로 반환한다.

## 10. 종료 후 불변성

게임 종료 후에는 리플레이와 디버깅을 위해 상태가 안정적으로 고정되어야 한다.

불변성:

- `gameStatus`가 `FINISHED` 또는 `ABORTED`이면 새 액션은 상태를 바꾸지 않는다.
- `phase`가 `GAME_OVER`이면 수동 액션은 모두 실패한다.
- `winner`는 한 번 설정된 뒤 바뀌지 않는다.
- `GAME_ENDED` 이벤트는 하나만 존재한다.
- 종료 이후 `eventLog` 순서는 바뀌지 않는다.
- 종료 이후 `eventQueue`, `effectStack`, `pendingTriggers` 처리 정책은 테스트로 고정한다.
- 종료 상태를 다시 `RUNNING`으로 되돌리는 API는 만들지 않는다.

검증 헬퍼:

- `assertGameCanAcceptAction(state): ValidationResult`
- `assertGameNotFinished(state): ValidationResult`
- `countGameEndedEvents(state): number`

오류 코드 보강 후보:

- `ERR_GAME_ALREADY_FINISHED`
- `ERR_GAME_ABORTED`
- `ERR_WIN_CONDITION_INVALID`
- `ERR_GAME_END_ALREADY_RECORDED`
- `ERR_SURRENDER_NOT_ALLOWED`
- `ERR_INVALID_END_RESULT`

기존 오류 코드가 이미 있으면 재사용하고, 새 코드는 필요한 경우에만 추가한다.

## 11. 리플레이 준비 경계

Phase10은 Phase11의 저장/리플레이 구현을 준비하지만 완성하지 않는다.

Phase10에서 해야 할 일:

- 종료를 만드는 액션과 이벤트 순서를 결정론적으로 유지한다.
- `GAME_ENDED` payload에 종료 reason과 winner를 기록한다.
- 종료 판정이 현재 시간, 브라우저 상태, 랜덤 호출에 의존하지 않게 한다.
- `actionLog`는 종료를 유발한 액션까지만 포함한다.
- 종료 후 실패 액션은 action log에 기록하지 않는다.

Phase10에서 하지 않을 일:

- `ReplayFile` JSON 포맷 확정
- 리플레이 재생기 구현
- 상태 해시 구현
- 저장 슬롯 UI 구현
- 파일 시스템 저장 API 구현
- 압축/서명/검증 파일 생성

## 12. 테스트 요구사항

Phase10 테스트는 최소한 다음을 검증한다.

- HP 0 이하인 상대 플레이어를 패배로 판정한다.
- HP 0 이하인 자기 플레이어를 패배로 판정한다.
- 양 플레이어 HP 0 이하를 결정론적 무승부로 판정한다.
- 빈 덱에서 드로우하면 덱 아웃 패배가 발생한다.
- 빈 덱이지만 드로우하지 않은 상태는 종료되지 않는다.
- 턴 제한 조건이 제한 턴 전에는 발동하지 않는다.
- 턴 제한 조건이 제한 턴에 지정 결과로 종료된다.
- 지정 boss unit 파괴만 보스전 승리로 인정한다.
- 퍼즐 목표 `completed` 상태가 종료 조건으로 평가된다.
- 지배력 목표는 `boardValue`와 연속 턴 조건을 기준으로 평가된다.
- 항복은 제출 플레이어 패배와 상대 승리로 처리된다.
- 비정상 종료는 `ABORTED` 상태와 `INVALID_STATE_ABORT` reason을 남긴다.
- `GAME_ENDED` 이벤트가 정확히 한 번만 기록된다.
- `GAME_ENDED` 이벤트 payload가 `winner`, `loser`, `reason`, `condition`을 포함한다.
- 종료 후 모든 액션은 상태를 변경하지 않는다.
- `applyAction`으로 공격, 효과, 드로우가 게임을 끝낼 수 있다.
- 이벤트 큐 flush 후 승리 조건이 판정된다.
- 종료 판정은 같은 입력에서 같은 결과를 낸다.
- 룰 엔진 영역이 Phaser, DOM, 브라우저 전역 객체, 카드 렌더러를 import하지 않는다.
- 코드와 카드 데이터에 원작 보호 대상 텍스트가 추가되지 않는다.

## 13. 완료 검증 명령

Phase10 완료 전 다음 명령을 모두 통과시킨다.

```bash
npm run build
npm run lint
npm run format:check
npm test
```

추가 감사 명령:

```bash
rg -n "from ['\"]\\.\\.?/.*/(scenes|ui|assets/cards)|from ['\"]phaser|document\\.|window\\." src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai
rg -n "창각|創刻|アテリアル" src tests card-data generated
```

첫 번째 명령은 룰 엔진 계층의 UI/Phaser/DOM/카드 렌더러 의존성이 없어야 한다. 두 번째 명령은 문서 외 코드, 카드 데이터, 생성물에 원작 보호 대상 텍스트가 들어가지 않았는지 확인하기 위한 감사다.

## 14. Phase10 완료 후 남겨야 할 경계

Phase10이 끝나도 다음은 아직 미완성으로 남겨야 한다.

- 리플레이 파일 포맷과 리플레이 재생기
- 상태 해시와 리플레이 검증
- 저장 슬롯과 저장 파일 관리
- AI 행동 탐색과 평가 함수
- 밸런스 시뮬레이션
- Phaser 기반 실제 게임 화면과 종료 화면
- 카드 조작 UI와 전장 UI
- PvE 스테이지 데이터, 보스 패턴, 보상 구조
- 시나리오 DSL의 복잡한 조건 분기
- 네트워크, PvP, 매치메이킹, 랭킹
- 배포, Docker, Nginx 구성

이 경계를 넘는 구현은 Phase11 이후 문서에서 다룬다.
