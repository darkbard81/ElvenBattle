# Phase 6 목표 지시문 — 전장 및 배치 시스템 구현

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 전열/후열 전장, 유닛 소환, 유닛 이동, 지배력 기반 배치 검증을 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 6을 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

## 기준 문서

- `documents/Plan.md`
- `documents/Core_Rule_Spec_v0.1.md`
- `documents/Phase2_Goal.md`
- `documents/Phase3_Goal.md`
- `documents/Phase4_Goal.md`
- `documents/Phase5_Goal.md`
- `AGENTS.md`

## Phase 6의 위치

`documents/Plan.md`에서 Phase 6은 다음 단계다.

- Phase 4: 턴 및 페이즈 시스템 구현
- Phase 5: 카드 / 덱 / Zone 시스템 구현
- Phase 6: 전장 및 배치 시스템 구현
- Phase 7: 전투 엔진 구현
- Phase 8 이후: 효과, 승리 조건, 리플레이, AI 구현

따라서 Phase 6은 `Board System`과 `Summon System`을 구현하는 단계다. 카드 드로우와 Zone 이동은 Phase5 산출물을 사용하고, 공격 선언/피해 계산/파괴 처리는 Phase7로 남긴다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- 룰 엔진은 Phaser, DOM, 브라우저 전역 객체, 네트워크 API에 의존하지 않는다.
- 전장은 Core Rule Spec의 기본값인 플레이어별 2행 x 3열 구조를 따른다.
- 전열(`FRONT`)과 후열(`BACK`)은 전투 대상 규칙에서 의미를 갖지만, Phase6에서는 배치와 이동 검증까지만 구현한다.
- Phase5의 `moveCard`가 막아둔 `BATTLEFIELD` 이동은 Phase6의 보드 검증을 통과한 경로에서만 허용한다.
- `CardDefinition`과 `CardInstance` 분리는 유지한다.
- `SUMMON_UNIT`, `MOVE_UNIT` 액션은 Phase4의 `applyAction` 진입점에 연결한다.
- 지배력은 전장 카드의 `dominanceCost`, `dominanceValue`를 기준으로 재계산한다.
- Phase6에서는 카드 효과 DSL, 지속 효과 레이어, 공격/피해, 유닛 파괴, 승리 조건을 완성하지 않는다.
- 모든 상태 변경 함수는 입력 `GameState`를 직접 mutation하지 않는 방식으로 구현한다.

## Phase 6 최종 목표

다음 기능을 구현한다.

- 전장 슬롯 조회와 검증 헬퍼
- 손패 유닛 소환 처리
- 전장 유닛 이동 처리
- 카드 `rowRestriction` 검증
- 슬롯 점유 검증
- 플레이어 소유 진영 검증
- `MAIN` 페이즈에서 `SUMMON_UNIT`, `MOVE_UNIT` 허용
- 소환 시 비용 지불
- 소환 시 지배력 한계 검증
- 전장 변화 후 지배력 `used`, `boardValue`, `overloaded` 재계산
- `UNIT_SUMMONED`, `UNIT_MOVED`, `CARD_MOVED`, `DOMINANCE_CHANGED` 이벤트 기록
- 소환/이동 액션에 대한 `ActionLogEntry` 기록
- Phase7 전투 엔진이 사용할 공격 대상 후보 조회 기반 준비

Phase 6 완료 시점에는 다음이 가능해야 한다.

- 손패의 `UNIT` 카드를 빈 전장 슬롯에 소환할 수 있다.
- 유닛이 아닌 카드는 소환할 수 없다.
- row restriction이 맞지 않으면 소환할 수 없다.
- 점유된 슬롯에는 소환하거나 이동할 수 없다.
- 자기 진영 슬롯이 아닌 곳에는 소환하거나 이동할 수 없다.
- 지배력 한계를 초과하는 소환은 실패한다.
- 소환이 성공하면 손패에서 전장으로 카드가 이동하고 보드 슬롯에 유닛이 배치된다.
- 소환이 성공하면 카드 비용만큼 자원이 차감된다.
- 소환이 성공하면 해당 인스턴스는 `summonedThisTurn = true`, `exhausted = false` 상태가 된다.
- 전장 유닛은 `MAIN` 페이즈에 자기 빈 슬롯으로 이동할 수 있다.
- 같은 유닛은 한 턴에 한 번만 이동할 수 있다.
- 정상 소환/이동은 이벤트 로그와 액션 로그에 기록된다.
- 실패한 소환/이동은 상태를 변경하지 않고 검증 실패를 반환한다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/board/query.ts` | 슬롯 조회, 유닛 위치 조회, 같은 열/인접 열 헬퍼 |
| `src/board/validation.ts` | 슬롯 소유, 빈 슬롯, row restriction 검증 |
| `src/board/placement.ts` | 보드 슬롯에 유닛 배치/제거/이동 |
| `src/board/index.ts` | Phase6 Board API re-export |
| `src/dominance/calculate.ts` | 전장 기준 지배력 재계산 |
| `src/dominance/validation.ts` | 지배력 소환 가능 여부 검증 |
| `src/dominance/index.ts` | Phase6 Dominance API re-export |
| `src/game/summon.ts` | 유닛 소환 처리 |
| `src/game/move.ts` | 유닛 이동 처리 |
| `src/game/action.ts` | `SUMMON_UNIT`, `MOVE_UNIT` dispatch 연결 |
| `src/game/index.ts` | Phase6 public API re-export |
| `src/rules/validation.ts` | Phase/action 허용 목록과 공통 검증 보강 |
| `src/rules/types.ts` | 배치/소환/이동 검증 오류 코드 보강 |
| `src/events/factory.ts` | `UNIT_SUMMONED`, `UNIT_MOVED`, `DOMINANCE_CHANGED` 이벤트 생성 헬퍼 추가 |
| `src/zones/move.ts` | 보드 검증을 통과한 `BATTLEFIELD` 이동 경로 지원 |
| `tests/board-query.test.ts` | 슬롯/위치 조회 테스트 |
| `tests/summon-system.test.ts` | 소환 성공/실패 테스트 |
| `tests/move-unit-system.test.ts` | 유닛 이동 성공/실패 테스트 |
| `tests/dominance-calculation.test.ts` | 지배력 재계산 테스트 |
| `tests/phase6-apply-action.test.ts` | `applyAction` 통합 테스트 |

기존 Phase3~5 타입 파일은 필요한 경우에만 좁게 보강한다. 특히 `GameState`와 `CardInstance` 구조를 크게 갈아엎지 않는다.

## 2. 전장 조회와 슬롯 검증

Phase3에서 이미 기본 전장 타입과 `createEmptyBoard`가 존재한다. Phase6에서는 실행 로직에서 사용할 조회/검증 헬퍼를 추가한다.

필수 헬퍼:

- `getBoardSlot(board, slotId)`
- `requireBoardSlot(board, slotId): BoardSlot`
- `findUnitSlot(board, unitId): BoardSlot | null`
- `isSlotEmpty(board, slotId): boolean`
- `isOwnSideSlot(slot, playerId): boolean`
- `isRowAllowed(definition, row): boolean`
- `getSameColumnSlots(board, playerId, column)`
- `getAdjacentColumnSlots(board, playerId, column)`

검증 규칙:

- 존재하지 않는 `slotId`는 `ERR_INVALID_TARGET` 또는 `ERR_SLOT_NOT_FOUND`로 실패한다.
- `slot.ownerSide !== playerId`이면 실패한다.
- `slot.unit !== null`이면 `ERR_SLOT_OCCUPIED`로 실패한다.
- `CardDefinition.rowRestriction`이 `ANY`이면 모든 행에 배치 가능하다.
- `rowRestriction`이 배열이면 해당 행에만 배치 가능하다.
- Phase6에서는 후열 보호와 공격 대상 검증을 구현하지 않는다. 단, Phase7에서 쓸 수 있도록 같은 열/인접 열 조회 헬퍼를 준비한다.

`RuleErrorCode` 보강 후보:

- `ERR_SLOT_NOT_FOUND`
- `ERR_NOT_OWN_SLOT`
- `ERR_ROW_RESTRICTED`
- `ERR_CARD_NOT_UNIT`
- `ERR_UNIT_NOT_ON_BOARD`
- `ERR_UNIT_ALREADY_MOVED`

## 3. 유닛 소환

`SUMMON_UNIT` 액션은 손패의 `UNIT` 카드를 자기 전장 슬롯에 배치한다.

입력 payload:

```ts
export interface SummonUnitPayload {
  instanceId: InstanceId;
  slotId: SlotId;
}
```

필수 처리 순서:

1. 공통 검증을 수행한다.
2. `phase === 'MAIN'`인지 확인한다.
3. 액션 플레이어가 `priorityPlayerId`인지 확인한다.
4. `instanceId`가 존재하는지 확인한다.
5. 카드가 액션 플레이어의 손패에 있는지 확인한다.
6. 원본 `CardDefinition`이 `UNIT` 타입인지 확인한다.
7. 대상 슬롯이 존재하고 액션 플레이어 진영인지 확인한다.
8. 대상 슬롯이 비어 있는지 확인한다.
9. 카드의 `rowRestriction`이 슬롯 행을 허용하는지 확인한다.
10. 플레이어의 현재 자원으로 카드 `cost`를 지불할 수 있는지 확인한다.
11. 현재 지배력 기준으로 `used + dominanceCost <= limit + temporaryLimit`인지 확인한다.
12. 자원을 차감한다.
13. 카드를 `HAND -> BATTLEFIELD`로 이동한다.
14. 보드 슬롯에 유닛을 배치한다.
15. 카드 인스턴스의 `currentZone`을 `{ type: 'BATTLEFIELD', ownerId, slotId }`로 갱신한다.
16. `summonedThisTurn = true`, `exhausted = false`로 설정한다.
17. 지배력 상태를 재계산한다.
18. `CARD_MOVED`, `UNIT_SUMMONED`, `DOMINANCE_CHANGED` 이벤트를 기록한다.
19. `ActionLogEntry`를 기록한다.

비용 정책:

- Phase6에서는 소환 비용으로 `CardDefinition.cost`만 지불한다.
- 지배력은 소모하지 않고 점유량으로 계산한다.
- `cost > player.resource.current + player.resource.temporary`이면 실패한다.
- 임시 자원 사용 순서는 Phase8 이후 효과 엔진에서 확장할 수 있다. Phase6 MVP는 `resource.current`에서 차감한다.

## 4. 유닛 이동

`MOVE_UNIT` 액션은 이미 전장에 있는 자기 유닛을 자기 빈 슬롯으로 이동한다.

입력 payload:

```ts
export interface MoveUnitPayload {
  unitId: InstanceId;
  toSlotId: SlotId;
}
```

필수 처리 순서:

1. 공통 검증을 수행한다.
2. `phase === 'MAIN'`인지 확인한다.
3. `unitId`가 전장에 존재하는지 확인한다.
4. 유닛의 `controllerId`가 액션 플레이어인지 확인한다.
5. 출발 슬롯이 액션 플레이어 진영인지 확인한다.
6. 대상 슬롯이 존재하고 액션 플레이어 진영인지 확인한다.
7. 대상 슬롯이 비어 있는지 확인한다.
8. 카드 원본의 `rowRestriction`이 대상 슬롯 행을 허용하는지 확인한다.
9. `turnState.movedUnitIds`에 해당 유닛이 없음을 확인한다.
10. 보드 슬롯의 `unit` 값을 출발 슬롯에서 제거하고 대상 슬롯에 배치한다.
11. 카드 인스턴스의 `currentZone.slotId`를 대상 슬롯으로 갱신한다.
12. `turnState.movedUnitIds`에 유닛 ID를 추가한다.
13. 필요 시 지배력을 재계산한다.
14. `UNIT_MOVED` 이벤트를 기록한다.
15. `ActionLogEntry`를 기록한다.

이동 정책:

- Phase6 기본 이동은 `MAIN` 페이즈에만 허용한다.
- 같은 행/다른 행 이동 모두 허용하되, `rowRestriction`은 반드시 지킨다.
- 자기 진영 안에서만 이동할 수 있다.
- 이동은 지배력 비용을 바꾸지 않지만, row 조건부 지속 효과가 Phase8에서 도입될 수 있으므로 재계산 확장 지점을 둔다.
- 이동 자체는 자원을 소비하지 않는다.

## 5. 지배력 재계산과 검증

지배력은 전장에 있는 카드 인스턴스와 카드 정의를 기준으로 계산한다.

필수 헬퍼:

- `calculateDominanceForPlayer(state, registry, playerId): DominanceState`
- `recalculateDominance(state, registry, playerId): GameState`
- `canPayDominanceForSummon(state, registry, playerId, definition): ValidationResult`
- `createDominanceChangedEvent(state, playerId, before, after, reason)`

계산 규칙:

- 해당 플레이어가 조종하는 전장 카드만 계산한다.
- `dominanceCost`가 없으면 0으로 본다.
- `dominanceValue`가 없으면 0으로 본다.
- `used`는 전장 카드의 `dominanceCost` 합계다.
- `boardValue`는 전장 카드의 `dominanceValue` 합계다.
- `limit`, `temporaryLimit`은 기존 플레이어 상태를 유지한다.
- `overloaded = used > limit + temporaryLimit`로 계산한다.
- 지배력 초과 정책 기본값은 `BLOCK_NEW_SUMMON_ONLY`다. Phase6에서는 초과 상태의 기존 유닛을 강제로 제거하지 않는다.

검증 규칙:

- 새 소환은 `used + newUnitDominanceCost <= limit + temporaryLimit`일 때만 허용한다.
- 실패 시 `ERR_INSUFFICIENT_DOMINANCE`를 반환한다.
- 소환/이동 후 지배력 값이 바뀌면 `DOMINANCE_CHANGED` 이벤트를 기록한다.
- `DOMINANCE_OVERLOADED` 이벤트는 효과나 제한 감소로 초과 상태가 발생하는 Phase8 이후에 본격 사용한다.

## 6. Phase/action 연결

Phase6부터 `SUMMON_UNIT`, `MOVE_UNIT`은 구현된 액션이다.

허용 액션:

| Phase | 허용 액션 |
|---|---|
| `MAIN` | `SUMMON_UNIT`, `MOVE_UNIT`, `END_PHASE` |
| `COMBAT` | `END_PHASE` |
| `END` | `END_TURN` |

미지원 유지 액션:

- `PLAY_CARD`
- `ACTIVATE_EFFECT`
- `ATTACK`
- `MULLIGAN`
- `SELECT_TARGET`

정책:

- `SUMMON_UNIT`, `MOVE_UNIT`은 `applyAction`에서 성공/실패 결과를 반환한다.
- 검증 실패 시 입력 `state`를 변경하지 않는다.
- 성공 시 새 `GameState`, 발생 이벤트 배열, action log entry를 반환한다.
- `PLAY_CARD`는 Phase8 효과 처리 또는 별도 카드 사용 구현 전까지 미지원으로 유지한다. 단, `SUMMON_UNIT`은 유닛 카드를 손패에서 직접 전장에 배치하는 Phase6 전용 경로로 본다.

## 7. 이벤트와 로그

Phase6에서 추가하거나 보강할 이벤트:

- `UNIT_SUMMONED`
- `UNIT_MOVED`
- `DOMINANCE_CHANGED`

권장 payload:

```ts
type UnitSummonedPayload = {
  playerId: PlayerId;
  unitId: InstanceId;
  slotId: SlotId;
};

type UnitMovedPayload = {
  playerId: PlayerId;
  unitId: InstanceId;
  fromSlotId: SlotId;
  toSlotId: SlotId;
};

type DominanceChangedPayload = {
  playerId: PlayerId;
  before: DominanceState;
  after: DominanceState;
  reason: 'SUMMON' | 'MOVE' | 'DESTROY' | 'EFFECT' | 'RECALCULATE';
};
```

로그 순서:

- 소환 성공: `CARD_MOVED` -> `UNIT_SUMMONED` -> `DOMINANCE_CHANGED`
- 이동 성공: `UNIT_MOVED` -> `DOMINANCE_CHANGED`가 필요한 경우
- 실패 액션은 `actionLog`에 기록하지 않는다.
- 이벤트 ID는 기존 `events/factory.ts` 정책처럼 결정론적으로 생성한다.

## 8. Zone과 Board의 정합성

Phase6은 `BATTLEFIELD`를 실제 Zone으로 사용하기 시작한다.

정합성 규칙:

- `BoardSlot.unit === instanceId`이면 해당 `CardInstance.currentZone.type`은 `BATTLEFIELD`여야 한다.
- `CardInstance.currentZone.slotId`는 실제 보드 슬롯 ID와 같아야 한다.
- 전장에 있는 유닛은 플레이어 `hand`, `deck`, `graveyard`, `banished` 배열에 남아 있으면 안 된다.
- 전장 슬롯 하나에는 유닛 하나만 존재한다.
- 같은 유닛이 두 슬롯에 동시에 존재하면 안 된다.
- `controllerId`와 `slot.ownerSide`는 Phase6 기본 정책에서 같아야 한다.

구현 지침:

- `moveCard`가 `BATTLEFIELD` 이동을 직접 무조건 허용하지 않도록 한다.
- 소환/이동 처리 함수가 보드 검증을 마친 뒤 Zone과 Board를 함께 갱신한다.
- 전장 이동 중 실패가 발생하면 이전 상태를 유지한다.

## 9. 테스트 요구사항

Phase6 테스트는 최소한 다음을 검증한다.

- 슬롯 ID로 슬롯을 조회할 수 있다.
- 존재하지 않는 슬롯은 검증 실패한다.
- 빈 슬롯과 점유 슬롯을 구분할 수 있다.
- 손패 유닛을 자기 전열 슬롯에 소환할 수 있다.
- 손패 유닛을 자기 후열 슬롯에 소환할 수 있다.
- row restriction이 맞지 않으면 소환 실패한다.
- 유닛이 아닌 카드는 소환 실패한다.
- 손패에 없는 카드는 소환 실패한다.
- 상대 진영 슬롯에는 소환 실패한다.
- 점유 슬롯에는 소환 실패한다.
- 자원이 부족하면 소환 실패한다.
- 지배력이 부족하면 소환 실패한다.
- 소환 성공 시 손패에서 제거되고 보드 슬롯에 배치된다.
- 소환 성공 시 `CardInstance.currentZone`이 `BATTLEFIELD`와 `slotId`로 갱신된다.
- 소환 성공 시 자원이 차감된다.
- 소환 성공 시 지배력 `used`, `boardValue`, `overloaded`가 갱신된다.
- 소환 성공 시 `CARD_MOVED`, `UNIT_SUMMONED`, `DOMINANCE_CHANGED` 이벤트가 기록된다.
- 전장 유닛을 자기 빈 슬롯으로 이동할 수 있다.
- 같은 유닛을 같은 턴에 두 번 이동할 수 없다.
- 이동 성공 시 출발 슬롯은 비고 대상 슬롯은 점유된다.
- 이동 성공 시 `CardInstance.currentZone.slotId`가 갱신된다.
- `SUMMON_UNIT`, `MOVE_UNIT`이 `applyAction`에서 처리된다.
- 실패한 소환/이동은 입력 상태를 변경하지 않는다.
- 룰 엔진 영역이 `src/scenes`, `src/ui`, Phaser, DOM을 import하지 않는다.

## 10. 완료 검증 명령

Phase6 완료 전 다음 명령을 모두 통과시킨다.

```bash
npm run build
npm run lint
npm run format:check
npm test
```

추가 감사 명령:

```bash
rg -n "from ['\"]\\.\\.?/.*/(scenes|ui)|from ['\"]phaser|document\\.|window\\." src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai
rg -n "창각|創刻|アテリアル" src tests card-data
```

첫 번째 명령은 룰 엔진 계층의 UI/Phaser/DOM 의존성이 없어야 한다. 두 번째 명령은 문서 외 코드와 카드 데이터에 원작 보호 대상 텍스트가 들어가지 않았는지 확인하기 위한 감사다.

## 11. Phase6 완료 후 남겨야 할 경계

Phase6이 끝나도 다음은 아직 미완성으로 남겨야 한다.

- 공격 선언과 공격 대상 검증
- 후열 보호를 포함한 전투 대상 선택
- 피해 계산과 반격 처리
- 유닛 파괴와 묘지 이동
- 효과 DSL 실행
- 지속 효과 레이어에 따른 능력치/지배력 수정
- 승리 조건과 게임 종료 처리
- 저장 파일 포맷과 리플레이 재생기
- AI 행동 탐색과 평가 함수

이 경계를 넘는 구현은 Phase7 이후 문서에서 다룬다.
