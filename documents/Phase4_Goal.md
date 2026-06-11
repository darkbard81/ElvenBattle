# Phase 4 목표 지시문 — 턴 및 페이즈 시스템 구현

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 턴/페이즈 진행과 액션 처리 골격을 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 4를 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

## 기준 문서

- `documents/Plan.md`
- `documents/Core_Rule_Spec_v0.1.md`
- `documents/Phase2_Goal.md`
- `documents/Phase3_Goal.md`
- `AGENTS.md`

## Phase 4의 위치

`documents/Plan.md`에서 Phase 4는 다음 단계다.

- Phase 3: 핵심 데이터 모델 설계
- Phase 4: 턴 및 페이즈 시스템 구현
- Phase 5: 카드 / 덱 / Zone 시스템 구현
- Phase 6 이후: 전장 배치, 전투, 효과, 승리 조건, 리플레이, AI 구현

따라서 Phase 4는 카드/덱/전투/효과를 완성하는 단계가 아니라, 모든 후속 룰 처리가 올라탈 `Turn Engine`, `Phase Engine`, `Action 처리 구조`를 구현하는 단계다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- 룰 엔진은 Phaser, DOM, 브라우저 전역 객체, 네트워크 API에 의존하지 않는다.
- `documents/Core_Rule_Spec_v0.1.md`의 페이즈 순서와 `GameAction` 처리 형태를 따른다.
- `src/core`, `src/game`, `src/rules`, `src/events`, `src/replay` 중심으로 구현한다.
- Phase 5 이후 구현 대상인 카드 로딩, 셔플, 드로우, Zone 이동 전체 검증, 유닛 소환, 전투, 효과 해결을 앞당겨 완성하지 않는다.
- 단, 후속 Phase가 연결될 수 있도록 명확한 확장 지점과 기본 실패 응답을 둔다.
- 모든 상태 변경은 입력 `GameState`를 직접 mutation하지 않는 방식으로 구현한다.

## Phase 4 최종 목표

다음 기능을 구현한다.

- 페이즈 전환 정책
- 턴 시작/종료 처리 골격
- `applyAction(state, action)` 진입점
- `EndPhaseAction` 처리
- `EndTurnAction` 처리
- phase/action 권한 검증
- `ActionLogEntry` 기록
- `PHASE_CHANGED`, `TURN_STARTED`, `TURN_ENDED` 이벤트 기록
- 향후 Phase 5~8 액션을 위한 unsupported action 처리

Phase 4 완료 시점에는 다음이 가능해야 한다.

- `GameState.phase`가 정해진 순서대로 전환된다.
- `activePlayerId`와 `priorityPlayerId`가 턴 교대 시 올바르게 갱신된다.
- `turnNumber`가 새 턴 시작 시 증가한다.
- `turnState`가 새 턴 시작 시 초기화된다.
- 잘못된 페이즈나 권한 없는 플레이어의 액션은 상태를 변경하지 않고 검증 실패를 반환한다.
- 정상 액션은 action log와 event log를 남긴다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/game/phase.ts` | 페이즈 순서, 다음 페이즈 계산, 페이즈 판정 헬퍼 |
| `src/game/turn.ts` | 턴 시작/턴 종료 처리, `TurnState` 초기화 |
| `src/game/action.ts` | `applyAction` 진입점과 액션 dispatch |
| `src/game/result.ts` | 액션 처리 결과 타입 |
| `src/game/index.ts` | Phase4 public API re-export |
| `src/rules/validation.ts` | 공통 action 검증 헬퍼 |
| `src/events/factory.ts` | 기본 이벤트 생성 헬퍼 |
| `src/replay/log.ts` | action log entry 생성 헬퍼 |
| `tests/phase-engine.test.ts` | 페이즈 순서 테스트 |
| `tests/turn-engine.test.ts` | 턴 교대와 turnState 초기화 테스트 |
| `tests/action-validation.test.ts` | 권한/페이즈 검증 실패 테스트 |
| `tests/apply-action.test.ts` | `END_PHASE`, `END_TURN`, unsupported action 처리 테스트 |

기존 Phase3 타입 파일은 필요한 경우에만 좁게 보강한다.

## 2. 페이즈 순서

Core Rule Spec의 기본 루프를 따른다.

```text
TURN_START -> DRAW -> RESOURCE -> MAIN -> COMBAT -> END
```

`SETUP`, `MULLIGAN`, `GAME_OVER`는 특수 페이즈로 취급한다.

권장 상수:

```ts
export const TURN_PHASES = [
  'TURN_START',
  'DRAW',
  'RESOURCE',
  'MAIN',
  'COMBAT',
  'END',
] as const;
```

필수 헬퍼:

- `isTurnPhase(phase: Phase): boolean`
- `getNextPhase(phase: Phase): Phase | null`
- `canEndPhase(state: GameState, playerId: PlayerId): ValidationResult`
- `isAutomaticPhase(phase: Phase): boolean`

기본 정책:

- `TURN_START`, `DRAW`, `RESOURCE`는 자동 페이즈다.
- `MAIN`, `COMBAT`, `END`는 Phase4에서 플레이어 액션으로 넘길 수 있는 페이즈다.
- `END` 다음은 즉시 다음 플레이어의 `TURN_START`로 넘어가는 것이 아니라 `endTurn` 처리 경로를 사용한다.
- `GAME_OVER`에서는 어떤 액션도 허용하지 않는다.

## 3. Action 처리 결과

`applyAction`은 단순히 `GameState`만 반환하지 말고, 검증 실패를 표현할 수 있는 결과 타입을 반환한다.

권장 형태:

```ts
export type ApplyActionResult =
  | {
      ok: true;
      state: GameState;
      events: GameEvent[];
      actionLogEntry: ActionLogEntry;
    }
  | {
      ok: false;
      state: GameState;
      validation: ValidationResult;
    };
```

지침:

- 실패 결과의 `state`는 입력 state와 동일 참조 또는 깊은 동등 상태여야 한다.
- 성공 결과는 새 `GameState` 객체를 반환한다.
- Phase4에서는 복잡한 구조 공유 최적화보다 상태 불변성을 우선한다.

## 4. `applyAction` 진입점

필수 시그니처:

```ts
export function applyAction(state: GameState, action: GameAction): ApplyActionResult;
```

지원할 액션:

- `END_PHASE`
- `END_TURN`

Phase4에서 명시적으로 미지원 처리할 액션:

- `PLAY_CARD`
- `SUMMON_UNIT`
- `ACTIVATE_EFFECT`
- `ATTACK`
- `MOVE_UNIT`
- `MULLIGAN`
- `SELECT_TARGET`

미지원 액션 정책:

- `gameStatus === 'RUNNING'`이고 권한은 맞더라도 아직 구현되지 않은 액션이면 실패로 반환한다.
- `RuleErrorCode`에 `ERR_ACTION_NOT_IMPLEMENTED`를 추가한다.
- 상태는 변경하지 않는다.
- `actionLog`에는 기록하지 않는다.

## 5. 공통 검증 규칙

`src/rules/validation.ts`에 다음 헬퍼를 구현한다.

필수 헬퍼:

- `validateGameRunning(state)`
- `validatePriorityPlayer(state, playerId)`
- `validatePhaseAllowsAction(state, action)`
- `validationOk()`
- `validationError(code, messageKey, detail?)`
- `mergeValidationResults(...results)`

검증 순서:

1. `gameStatus === 'RUNNING'`인지 확인한다.
2. `playerId === priorityPlayerId`인지 확인한다.
3. 현재 `phase`에서 해당 `ActionType`이 가능한지 확인한다.
4. 지원되지 않는 액션이면 `ERR_ACTION_NOT_IMPLEMENTED`를 반환한다.

Phase4의 허용 액션:

| Phase | 허용 액션 |
|---|---|
| `MAIN` | `END_PHASE` |
| `COMBAT` | `END_PHASE` |
| `END` | `END_TURN` |

자동 페이즈는 Phase4 헬퍼로 전환할 수 있지만, 사용자가 직접 해당 페이즈에서 액션을 제출하는 구조는 허용하지 않는다.

## 6. 페이즈 전환 처리

`END_PHASE`는 다음 규칙을 따른다.

1. 공통 검증을 수행한다.
2. `MAIN`이면 `COMBAT`로 전환한다.
3. `COMBAT`이면 `END`로 전환한다.
4. `PHASE_CHANGED` 이벤트를 생성한다.
5. `ActionLogEntry`를 기록한다.
6. `priorityPlayerId`는 기본적으로 `activePlayerId`를 유지한다.

Phase4에서는 `DRAW`, `RESOURCE`의 자동 처리를 완성하지 않는다. 단, 자동 페이즈 진행을 위한 헬퍼를 준비한다.

권장 헬퍼:

- `advanceAutomaticPhase(state): GameState`
- `advanceToFirstPlayablePhase(state): GameState`

기본 정책:

- 새 턴 시작 직후 `TURN_START -> DRAW -> RESOURCE -> MAIN`까지 자동 전환할 수 있다.
- 자동 전환 이벤트는 각각 `PHASE_CHANGED`를 남긴다.
- 드로우/자원 회복 실제 처리는 Phase5 이후로 남긴다.

## 7. 턴 시작과 턴 종료 처리

### 턴 시작

필수 헬퍼:

```ts
export function startTurn(state: GameState, nextPlayerId: PlayerId): GameState;
```

처리 규칙:

- `activePlayerId = nextPlayerId`
- `priorityPlayerId = nextPlayerId`
- `turnNumber += 1`
- `phase = 'TURN_START'`
- `turnState` 초기화
- `TURN_STARTED` 이벤트 기록

`turnNumber` 정책:

- 게임 생성 직후 첫 턴을 아직 시작하지 않은 상태라면 `turnNumber = 0`으로 둘 수 있다.
- Phase4 테스트에서는 `END_TURN` 후 다음 턴이 `turnNumber + 1`이 되는 것을 검증한다.

### 턴 종료

필수 헬퍼:

```ts
export function endTurn(state: GameState): GameState;
```

처리 규칙:

- 현재 phase는 `END`여야 한다.
- `TURN_ENDED` 이벤트를 기록한다.
- 다음 플레이어를 결정한다.
- 다음 플레이어의 `TURN_START` 상태로 전환한다.
- 기본 2인 PvE 전투에서는 player id 목록의 다음 플레이어로 교대한다.

다음 플레이어 결정 헬퍼:

- `getPlayerOrder(state): PlayerId[]`
- `getNextPlayerId(state): PlayerId`

정렬 정책:

- Phase4에서는 `Object.keys(state.players)` 순서를 사용해도 된다.
- 안정성을 위해 테스트에서는 `P1`, `P2` 순서로 state를 구성한다.
- Phase5 이후 `GameConfig.playerIds` 또는 명시적 player order를 도입할 수 있다.

## 8. 이벤트 생성

`src/events/factory.ts`에 기본 이벤트 생성 헬퍼를 둔다.

필수 헬퍼:

- `createPhaseChangedEvent(state, from, to)`
- `createTurnStartedEvent(state, activePlayerId)`
- `createTurnEndedEvent(state, endedPlayerId)`

이벤트 요구:

- `eventId`는 결정론적이어야 한다.
- Phase4 기본 정책은 `event-${state.eventLog.length + state.eventQueue.length + 1}` 형식이다.
- `turnNumber`, `phase`, `visibility`, `payload`를 명시한다.
- 이벤트는 `eventQueue`와 `eventLog` 중 어디에 기록할지 정책을 통일한다.

Phase4 기록 정책:

- 즉시 해결되는 시스템 이벤트는 `eventLog`에 기록한다.
- `eventQueue`에는 Phase8 효과 처리 전까지 쌓지 않는다.
- 따라서 Phase4 시스템 이벤트는 반환 결과의 `events`와 `state.eventLog`에 포함한다.

## 9. Action Log 기록

`src/replay/log.ts`에 action log helper를 둔다.

필수 헬퍼:

- `createActionLogEntry(state, action, accepted)`

정책:

- 성공 액션만 `state.actionLog`에 추가한다.
- `index`는 기존 `state.actionLog.length`를 사용한다.
- Phase4에서는 state hash를 계산하지 않는다.
- 실패 액션은 action log에 넣지 않는다.

## 10. 상태 불변성

Phase4의 모든 상태 변경 함수는 입력 객체를 직접 변경하지 않는다.

필수 테스트:

- `applyAction` 성공 후 반환 state는 입력 state와 다른 참조다.
- `applyAction` 실패 후 반환 state는 입력 state와 동일 참조이거나 내용이 변경되지 않았다.
- 기존 `actionLog`와 `eventLog` 배열을 직접 push하지 않는다.

권장 구현:

```ts
const nextState: GameState = {
  ...state,
  phase: nextPhase,
  eventLog: [...state.eventLog, event],
  actionLog: [...state.actionLog, actionLogEntry],
};
```

## 11. 테스트 요구사항

Phase4 완료 시 다음 테스트를 추가하고 통과시킨다.

| 테스트 파일 | 검증 내용 |
|---|---|
| `tests/phase-engine.test.ts` | 페이즈 순서, 자동 페이즈 판정, 다음 페이즈 계산 |
| `tests/turn-engine.test.ts` | `startTurn`, `endTurn`, 다음 플레이어 결정, `turnState` 초기화 |
| `tests/action-validation.test.ts` | 게임 종료 상태, 권한자 불일치, 잘못된 페이즈, 미지원 액션 검증 |
| `tests/apply-action.test.ts` | `END_PHASE`, `END_TURN`, 로그/이벤트 기록, 상태 불변성 |

테스트 데이터 지침:

- 테스트 카드와 플레이어는 독자 데이터만 사용한다.
- Phaser, DOM, 브라우저 API를 테스트에 사용하지 않는다.
- 테스트용 `GameState` 생성 헬퍼를 중복이 심하지 않은 범위에서 둘 수 있다.

## 12. 완료 조건

Phase4는 다음 조건을 모두 만족해야 완료로 본다.

- [ ] `TURN_PHASES` 또는 동등한 페이즈 순서 상수가 존재한다.
- [ ] `getNextPhase`가 `MAIN -> COMBAT`, `COMBAT -> END`를 반환한다.
- [ ] 자동 페이즈 판정 헬퍼가 존재한다.
- [ ] `startTurn`이 `activePlayerId`, `priorityPlayerId`, `turnNumber`, `phase`, `turnState`를 갱신한다.
- [ ] `endTurn`이 다음 플레이어의 `TURN_START`로 전환한다.
- [ ] `applyAction(state, action)` 진입점이 존재한다.
- [ ] `END_PHASE` 액션이 `MAIN`과 `COMBAT`에서 동작한다.
- [ ] `END_TURN` 액션이 `END`에서 동작한다.
- [ ] 공통 검증 실패가 `ValidationResult`로 표현된다.
- [ ] 권한 없는 플레이어의 액션은 상태를 변경하지 않는다.
- [ ] `GAME_OVER` 또는 `FINISHED` 상태에서는 액션이 실패한다.
- [ ] 미지원 액션은 `ERR_ACTION_NOT_IMPLEMENTED`로 실패한다.
- [ ] 성공 액션은 `ActionLogEntry`를 추가한다.
- [ ] 페이즈/턴 이벤트가 `eventLog`에 기록된다.
- [ ] 상태 변경 함수가 입력 `GameState`를 직접 mutation하지 않는다.
- [ ] 룰 엔진 도메인이 Phaser, DOM, UI 계층을 import하지 않는다.
- [ ] 원작 보호 대상 데이터가 추가되지 않았다.
- [ ] `npm run build`가 통과한다.
- [ ] `npm run lint`가 통과한다.
- [ ] `npm run format:check`가 통과한다.
- [ ] `npm test`가 통과한다.

## 13. 제외 범위

Phase4에서 다음은 구현하지 않는다.

- 카드 데이터 로딩 완성
- 덱 셔플
- 실제 카드 드로우
- Zone 이동 처리 완성
- 유닛 소환
- 지배력 재계산
- 자원 회복의 완전 구현
- 공격 선언과 전투 계산
- 피해, 파괴, 묘지 이동
- 효과 스택 해결
- 지속 효과 레이어 계산
- 승리 조건 판정 완성
- 리플레이 재생
- AI 행동 탐색
- Phaser UI 구현

단, 위 기능들이 `applyAction`, 이벤트, 로그 구조에 연결될 수 있도록 실패 정책과 dispatch 경계를 마련한다.

## 14. Phase5로 넘길 준비물

Phase4 완료 후 Phase5는 다음 작업을 바로 시작할 수 있어야 한다.

- `DRAW` 자동 페이즈에서 실제 드로우 처리 연결
- `RESOURCE` 자동 페이즈에서 자원 회복과 지배력 한계 증가 연결
- `PLAY_CARD`, `SUMMON_UNIT`의 카드/Zone 검증 연결
- `moveCard` API와 `CARD_MOVED` 이벤트 연결
- 덱 구성과 카드 인스턴스 생성 로직 연결
- Action log 기반 리플레이 입력 축적

## 15. 최종 산출물

Phase4 결과로 다음을 제출해야 한다.

1. Phase Engine
2. Turn Engine
3. `applyAction` 진입점
4. 공통 Action Validation 헬퍼
5. Phase/Turn 이벤트 생성 헬퍼
6. Action log helper
7. Phase4 테스트
8. 통과한 검증 명령 목록
9. Phase5 착수 시 남은 TODO 목록

## 작성 및 구현 방식

- 설명과 문서는 한국어로 작성한다.
- 코드, 파일명, npm script, 타입명은 영어를 사용한다.
- 코드 주석은 한국어로 작성한다.
- 기존 `documents/Plan.md`, `documents/Core_Rule_Spec_v0.1.md`, `documents/Phase3_Goal.md`의 방향을 좁히거나 바꾸지 않는다.
- Phase4는 “턴 및 페이즈 시스템 구현” 단계이므로 카드/전투/효과 로직을 과도하게 앞당기지 않는다.
- 테스트 가능한 상태를 완료 기준으로 삼고, 단순 타입 선언만으로 완료 처리하지 않는다.
