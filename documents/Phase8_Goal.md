# Phase 8 목표 지시문 — 효과 처리 엔진 구현

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 이벤트 기반 효과 처리, 트리거 효과, 지속 효과, 상태 효과, 최소 효과 DSL을 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 8을 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

## 기준 문서

- `documents/Plan.md`
- `documents/Core_Rule_Spec_v0.1.md`
- `documents/Phase2_Goal.md`
- `documents/Phase3_Goal.md`
- `documents/Phase4_Goal.md`
- `documents/Phase5_Goal.md`
- `documents/Phase6_Goal.md`
- `documents/Phase7_Goal.md`
- `AGENTS.md`

## Phase 8의 위치

`documents/Plan.md`에서 Phase 8은 다음 단계다.

- Phase 6: 전장 및 배치 시스템 구현
- Phase 7: 전투 엔진 구현
- Phase 8: 효과 처리 엔진 구현
- Phase 9: 카드 Asset Pipeline 및 카드 렌더러 구축
- Phase 10 이후: 승리 조건, 저장/리플레이, AI 구현

따라서 Phase 8은 Phase4~7에서 이미 발생시키는 이벤트를 소비해 카드 효과를 감지하고 해결하는 `Effect Engine`, `Event System`, `Effect DSL`을 구현하는 단계다. 승리 조건 확정, 리플레이 파일 포맷, AI 행동 탐색은 이후 Phase로 남긴다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- 룰 엔진은 Phaser, DOM, 브라우저 전역 객체, 네트워크 API에 의존하지 않는다.
- 효과 처리는 기존 `GameState.eventLog`, `eventQueue`, `effectStack`, `continuousEffects`, `pendingTriggers` 구조를 사용한다.
- Phase8의 DSL은 완전한 카드 게임 언어가 아니라 MVP 효과를 안정적으로 처리하는 최소 구조다.
- 효과 엔진은 결정론적으로 동작해야 한다.
- 같은 입력 state와 같은 event/effect 정의는 항상 같은 next state와 event log를 만든다.
- 트리거 정렬은 active player, non-active player, scenario 순서를 기본으로 한다.
- 효과 루프 방지를 위해 기본 32회 반복 한계를 둔다.
- Phase8에서는 효과가 승패를 확정하지 않는다. HP 0, 덱 아웃, PvE 목표 기반 종료는 Phase10에서 처리한다.
- 모든 상태 변경 함수는 입력 `GameState`를 직접 mutation하지 않는 방식으로 구현한다.

## Phase 8 최종 목표

다음 기능을 구현한다.

- 이벤트 큐 처리 루프
- 이벤트 기반 트리거 감지
- 동시 트리거 정렬
- `pendingTriggers` 등록과 소비
- `effectStack` 등록과 해결
- `EFFECT_TRIGGERED`, `EFFECT_RESOLVED` 이벤트 기록
- 최소 효과 DSL 실행
- 단일 대상 피해 효과
- 단일 대상 회복 효과
- 유닛/플레이어 대상 선택
- 상태 효과 부여
- 일시적 공격력/체력 modifier 부여
- 지속 효과 등록과 만료
- 공격력/체력 modifier 레이어 재계산 헬퍼
- 상태 효과 만료 처리
- 지배력 관련 modifier 확장 지점
- Phase7 전투 처리 후 트리거 연결

Phase 8 완료 시점에는 다음이 가능해야 한다.

- `UNIT_SUMMONED`, `ATTACK_DECLARED`, `DAMAGE_DEALT`, `UNIT_DESTROYED`, `CARD_DRAWN`, `PHASE_CHANGED` 이벤트에서 트리거를 감지할 수 있다.
- 카드 `abilities[].effectScript`가 이벤트 trigger와 매칭되면 `pendingTriggers`에 등록된다.
- 같은 이벤트에서 여러 트리거가 발생하면 결정론적 순서로 정렬된다.
- 트리거는 `effectStack`에 올라가고 순서대로 해결된다.
- 단일 피해 효과가 유닛 또는 플레이어에게 피해를 줄 수 있다.
- 단일 회복 효과가 플레이어 HP 또는 유닛 피해를 회복할 수 있다.
- 상태 효과가 유닛에 부여되고 기존 Phase7 공격 검증에서 반영된다.
- 공격력/체력 modifier가 유닛의 전투 수치 계산에 반영될 수 있다.
- 턴 종료 또는 턴 시작 만료 조건을 가진 효과가 만료된다.
- 효과 해결 결과가 이벤트 로그에 기록된다.
- 효과 루프가 한계를 넘으면 실패 결과 또는 검증 오류를 반환한다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/effects/triggers.ts` | 이벤트와 카드 ability trigger 매칭 |
| `src/effects/queue.ts` | 이벤트 큐 처리 루프 |
| `src/effects/stack.ts` | effectStack 등록과 해결 순서 |
| `src/effects/dsl.ts` | 최소 효과 DSL 파싱/실행 |
| `src/effects/targets.ts` | 효과 대상 선택과 검증 |
| `src/effects/modifiers.ts` | modifier 적용, 만료, 전투 수치 계산 |
| `src/effects/status.ts` | 상태 효과 부여와 만료 |
| `src/effects/continuous.ts` | 지속 효과 등록과 재계산 |
| `src/effects/result.ts` | 효과 처리 결과 타입 |
| `src/effects/index.ts` | Phase8 Effect API re-export |
| `src/events/factory.ts` | `EFFECT_TRIGGERED`, `EFFECT_RESOLVED`, 필요 시 `EFFECT_EXPIRED` 이벤트 생성 헬퍼 |
| `src/events/types.ts` | 필요한 이벤트 타입 보강 |
| `src/battle/attack.ts` | 전투 후 이벤트 큐/트리거 처리 연결 |
| `src/game/action.ts` | 필요한 경우 액션 성공 후 이벤트 큐 처리 연결 |
| `src/game/phase.ts` | 턴 시작/종료 만료 처리 연결 |
| `src/rules/types.ts` | 효과 루프/타겟/DSL 검증 오류 코드 보강 |
| `tests/effect-trigger.test.ts` | 트리거 감지와 정렬 테스트 |
| `tests/effect-stack.test.ts` | effectStack 등록/해결 테스트 |
| `tests/effect-dsl.test.ts` | 피해/회복/상태/버프 DSL 테스트 |
| `tests/effect-target.test.ts` | 효과 대상 선택 테스트 |
| `tests/status-effect.test.ts` | 상태 효과 부여와 만료 테스트 |
| `tests/continuous-effect.test.ts` | modifier 레이어 재계산 테스트 |
| `tests/phase8-integration.test.ts` | 전투/소환 이벤트와 효과 처리 통합 테스트 |

기존 Phase3~7 타입 파일은 필요한 경우에만 좁게 보강한다. 특히 Phase8을 위해 승리 조건이나 저장 파일 포맷을 앞당겨 만들지 않는다.

## 2. 이벤트 큐 처리

Phase4~7은 대부분 이벤트를 `eventLog`에 즉시 기록했다. Phase8에서는 효과 처리를 위해 이벤트를 순차 소비하는 큐를 도입한다.

필수 헬퍼:

- `enqueueEvents(state, events): GameState`
- `processEventQueue(state, options): ProcessEffectsResult`
- `processSingleEvent(state, event, context): ProcessEffectsResult`
- `flushEventQueue(state, options): ProcessEffectsResult`

기본 정책:

- 이벤트는 발생 순서대로 처리한다.
- 시스템 이벤트는 계속 `eventLog`에 기록한다.
- 트리거 감지를 위한 처리 대상 이벤트는 `eventQueue`에도 넣을 수 있다.
- 이미 `eventLog`에 기록된 이벤트를 다시 큐에 넣는 경우 중복 로그가 생기지 않도록 정책을 명확히 한다.
- Phase8 권장 정책은 “액션 처리 함수가 이벤트를 생성하고 `eventLog`에 기록한 뒤, 같은 이벤트 객체를 `eventQueue`로 전달해 트리거만 처리한다”다.
- 효과 처리 후 `eventQueue`는 비어 있어야 한다.
- 효과 처리 중 새 이벤트가 발생하면 큐 뒤에 추가한다.

루프 가드:

- 한 번의 `flushEventQueue`에서 처리한 이벤트+효과 해결 횟수가 기본 32회를 넘으면 중단한다.
- 오류 코드는 `ERR_EFFECT_LOOP_LIMIT`를 사용한다.

## 3. 트리거 감지

카드의 `AbilityDefinition`과 `EffectScript`를 기준으로 이벤트와 트리거를 매칭한다.

필수 헬퍼:

- `collectTriggeredAbilities(state, event): PendingTrigger[]`
- `matchesTrigger(ability, event): boolean`
- `sortPendingTriggers(state, triggers): PendingTrigger[]`
- `registerPendingTriggers(state, triggers): GameState`

기본 trigger 문자열:

| Trigger | 이벤트 |
|---|---|
| `ON_SUMMON` | `UNIT_SUMMONED` |
| `ON_ATTACK_DECLARED` | `ATTACK_DECLARED` |
| `ON_DAMAGE_DEALT` | `DAMAGE_DEALT` |
| `ON_DESTROYED` | `UNIT_DESTROYED` |
| `ON_CARD_DRAWN` | `CARD_DRAWN` |
| `ON_PHASE_CHANGED` | `PHASE_CHANGED` |
| `ON_TURN_STARTED` | `TURN_STARTED` |
| `ON_TURN_ENDED` | `TURN_ENDED` |

트리거 대상 카드 범위:

- 기본적으로 전장에 있는 카드의 ability만 트리거된다.
- `HAND`, `GRAVEYARD`, `BANISHED` 트리거는 Phase8 MVP에서 제외한다.
- `ONGOING` 카드는 전장에 있을 때 지속/트리거 효과 source가 될 수 있다.
- 시나리오 트리거는 `scenarioState` 확장 지점만 둔다.

정렬 정책:

1. active player가 조종하는 트리거
2. non-active player가 조종하는 트리거
3. scenario 트리거
4. 같은 controller 안에서는 `sourceId`, `abilityId`, `effectId` 문자열 오름차순

## 4. Effect Stack

트리거는 `effectStack`에 올라간 뒤 해결된다.

필수 헬퍼:

- `pushTriggeredEffects(state, triggers): GameState`
- `resolveNextEffect(state): ResolveEffectResult`
- `resolveEffectStack(state, options): ProcessEffectsResult`

기본 정책:

- Phase8 MVP는 트리거 정렬 결과를 앞에서부터 순서대로 해결한다.
- 응답 타이밍, 인터럽트, 플레이어 선택형 stack 조작은 구현하지 않는다.
- 해결 전에 source가 전장을 떠났더라도 effectScript가 이미 등록된 단순 효과는 해결한다.
- 단, target이 필수인데 더 이상 유효하지 않으면 해당 효과는 `skipped`로 해결 기록을 남긴다.
- 해결 성공/실패/스킵은 `EFFECT_RESOLVED` 이벤트에 기록한다.

## 5. 최소 효과 DSL

Phase8에서 지원할 최소 DSL은 다음 효과 타입으로 제한한다.

```ts
type EffectDsl =
  | { type: 'DAMAGE'; amount: number; target: TargetSelector }
  | { type: 'HEAL'; amount: number; target: TargetSelector }
  | { type: 'APPLY_STATUS'; status: StatusEffectType; stacks?: number; target: TargetSelector; expiresAt: Expiration }
  | { type: 'MODIFY_STAT'; stat: 'ATTACK' | 'HEALTH'; amount: number; target: TargetSelector; expiresAt: Expiration }
  | { type: 'DRAW_CARD'; count: number; target: TargetSelector };
```

지원할 target selector:

| Selector | 의미 |
|---|---|
| `SELF` | 효과 source 유닛 |
| `EVENT_SOURCE` | 이벤트 source 카드 또는 플레이어 |
| `EVENT_TARGET` | 이벤트 payload의 target |
| `CONTROLLER` | 효과 controller player |
| `ENEMY_PLAYER` | controller의 상대 플레이어 |
| `SAME_COLUMN_ENEMY_FRONT` | source와 같은 열 상대 전열 유닛 |
| `SAME_COLUMN_ENEMY_BACK` | source와 같은 열 상대 후열 유닛 |
| `DAMAGED_UNIT` | `DAMAGE_DEALT` 이벤트의 유닛 대상 |
| `DESTROYED_UNIT` | `UNIT_DESTROYED` 이벤트의 유닛 |

DSL 검증:

- `type`은 지원 목록 중 하나여야 한다.
- `amount`, `count`, `stacks`는 0 이상의 정수여야 한다.
- 필수 target을 찾지 못하면 효과는 skipped 처리한다.
- Phase8에서는 복수 대상, 무작위 대상, 조건부 분기, 반복, 토큰 생성, 카드 생성은 제외한다.

## 6. 피해와 회복 효과

Phase7의 `battle/damage.ts` 피해 API를 재사용한다.

정책:

- `DAMAGE` 효과는 유닛 또는 플레이어에게 피해를 준다.
- 유닛 피해 후 체력 0 이하이면 Phase7의 파괴 처리 경로를 재사용한다.
- `HEAL` 효과가 플레이어를 대상으로 하면 `hp`를 `maxHp` 이하로 회복한다.
- `HEAL` 효과가 유닛을 대상으로 하면 `damage`를 0 이하로 내리지 않는다.
- 피해/회복 결과는 `EFFECT_RESOLVED`와 필요 시 `DAMAGE_DEALT` 이벤트에 기록한다.
- 회복 전용 이벤트 타입은 Phase8 MVP에서 만들지 않고 `EFFECT_RESOLVED.payload.result`에 포함한다.

## 7. 상태 효과

상태 효과는 기존 `StatusEffect` 타입을 사용한다.

필수 헬퍼:

- `applyStatusEffect(state, unitId, status): GameState`
- `removeExpiredStatusEffects(state, timing): GameState`
- `hasStatusEffect(state, unitId, statusType): boolean`

지원 상태:

- `CANNOT_ATTACK`
- `STUNNED`
- `SHIELD`
- `ATTACK_UP`
- `HEALTH_UP`

만료 정책:

- `END_OF_TURN`은 해당 턴 종료 처리 때 만료된다.
- `START_OF_TURN`은 해당 플레이어 턴 시작 처리 때 만료된다.
- `LEAVES_BATTLEFIELD`는 source가 전장을 떠나면 만료된다.
- `USES`는 Phase8 MVP에서 감소 확장 지점만 둔다.
- `PERMANENT`는 명시 제거 전까지 유지한다.

Phase7 공격 검증은 이미 `CANNOT_ATTACK`, `STUNNED`를 읽으므로 Phase8 상태 효과가 즉시 전투에 반영되어야 한다.

## 8. 지속 효과와 Modifier

지속 효과는 `continuousEffects`와 `temporaryModifiers`를 사용한다.

필수 헬퍼:

- `applyModifier(state, unitId, modifier): GameState`
- `removeExpiredModifiers(state, timing): GameState`
- `getModifiedAttack(state, unitId): number`
- `getModifiedHealth(state, unitId): number`
- `recalculateContinuousEffects(state): GameState`

기본 정책:

- Phase8 MVP의 modifier는 카드 인스턴스 `temporaryModifiers`에 직접 붙인다.
- `ATTACK` modifier는 `currentAttack` 계산에 반영된다.
- `HEALTH` modifier는 남은 체력 계산에 반영된다.
- 실제 `currentAttack`, `currentHealth` 원본 값을 덮어쓰기보다 계산 헬퍼에서 합산하는 것을 우선한다.
- Phase7의 `getUnitAttack`, `getUnitRemainingHealth`는 Phase8 modifier 헬퍼를 사용하도록 연결한다.
- `DOMINANCE_COST`, `DOMINANCE_VALUE` modifier는 타입 확장 지점만 유지하고 실제 지배력 재계산 연결은 필요 범위 내에서 최소 구현한다.

## 9. 기존 액션과의 연결

Phase8은 모든 액션을 새로 구현하지 않는다. 기존 액션 성공 후 발생한 이벤트를 효과 엔진에 전달한다.

연결 대상:

- `SUMMON_UNIT`: `UNIT_SUMMONED` 트리거 처리
- `MOVE_UNIT`: `UNIT_MOVED` 트리거 처리
- `ATTACK`: `ATTACK_DECLARED`, `DAMAGE_DEALT`, `UNIT_DESTROYED` 트리거 처리
- `DRAW`: `CARD_DRAWN` 트리거 처리
- `END_PHASE`, `END_TURN`: `PHASE_CHANGED`, `TURN_ENDED` 트리거와 만료 처리

정책:

- 액션 자체의 검증과 기본 상태 변경은 Phase4~7 구현을 유지한다.
- 액션 성공 후 이벤트 큐를 flush한다.
- 효과로 새 이벤트가 생기면 다시 트리거 감지를 수행한다.
- 효과 처리 실패가 발생하면 해당 액션 전체를 실패로 되돌릴지, 효과만 실패 로그로 남길지 정책을 테스트로 고정한다.
- 권장 정책은 “기본 액션은 성공 상태를 유지하고, 효과 실패는 `EFFECT_RESOLVED`의 실패 결과와 validation에 기록”이다.

## 10. 테스트 요구사항

Phase8 테스트는 최소한 다음을 검증한다.

- `UNIT_SUMMONED` 이벤트가 `ON_SUMMON` ability를 감지한다.
- 같은 이벤트에서 여러 트리거가 deterministic order로 정렬된다.
- pending trigger가 effect stack으로 이동한다.
- effect stack이 순서대로 해결된다.
- `DAMAGE` DSL이 유닛에게 피해를 준다.
- `DAMAGE` DSL이 플레이어 HP를 감소시킨다.
- 효과 피해로 체력 0 이하가 된 유닛이 파괴된다.
- `HEAL` DSL이 유닛 damage를 회복한다.
- `HEAL` DSL이 플레이어 HP를 `maxHp` 이하로 회복한다.
- `APPLY_STATUS` DSL이 유닛에 상태 효과를 부여한다.
- `CANNOT_ATTACK` 또는 `STUNNED` 상태가 Phase7 공격 검증에 반영된다.
- `MODIFY_STAT` DSL이 공격력 계산에 반영된다.
- 만료 조건이 맞으면 상태 효과와 modifier가 제거된다.
- loop guard가 32회 초과 효과 연쇄를 중단한다.
- `EFFECT_TRIGGERED`, `EFFECT_RESOLVED` 이벤트가 기록된다.
- `SUMMON_UNIT` 또는 `ATTACK` 액션 후 트리거 효과가 통합 처리된다.
- 실패하거나 target이 사라진 효과는 상태를 깨뜨리지 않고 skipped/failed 결과를 남긴다.
- 룰 엔진 영역이 `src/scenes`, `src/ui`, Phaser, DOM을 import하지 않는다.

## 11. 완료 검증 명령

Phase8 완료 전 다음 명령을 모두 통과시킨다.

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

## 12. Phase8 완료 후 남겨야 할 경계

Phase8이 끝나도 다음은 아직 미완성으로 남겨야 한다.

- 카드 Asset Pipeline과 카드 이미지 렌더러
- HP 0, 덱 아웃, PvE 목표 기반 승리 조건
- `GAME_ENDED` 이벤트와 최종 로그 고정
- 저장 파일 포맷과 리플레이 재생기
- 상태 해시와 리플레이 검증
- AI 행동 탐색과 평가 함수
- 복잡한 DSL 기능: 복수 대상, 무작위 대상, 토큰 생성, 카드 생성, 비용 대체, stack 응답
- 완전한 지속 효과 레이어와 충돌 해결 규칙

이 경계를 넘는 구현은 Phase9 이후 문서에서 다룬다.
