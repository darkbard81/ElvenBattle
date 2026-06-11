# Phase 5 목표 지시문 — 카드 / 덱 / Zone 시스템 구현

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 카드 데이터 로딩, 덱 초기화, 드로우, Zone 이동 시스템을 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 5를 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

## 기준 문서

- `documents/Plan.md`
- `documents/Core_Rule_Spec_v0.1.md`
- `documents/Phase2_Goal.md`
- `documents/Phase3_Goal.md`
- `documents/Phase4_Goal.md`
- `AGENTS.md`

## Phase 5의 위치

`documents/Plan.md`에서 Phase 5는 다음 단계다.

- Phase 3: 핵심 데이터 모델 설계
- Phase 4: 턴 및 페이즈 시스템 구현
- Phase 5: 카드 / 덱 / Zone 시스템 구현
- Phase 6: 전장 및 배치 시스템 구현
- Phase 7 이후: 전투, 효과, 승리 조건, 리플레이, AI 구현

따라서 Phase 5는 전장 소환, 전투, 효과 해결을 완성하는 단계가 아니라, 모든 카드 기반 액션이 공유할 `Card System`, `Deck System`, `Zone System`을 구현하는 단계다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- `card-data/`에는 독자 카드 정의 JSON만 둔다.
- 룰 엔진은 Phaser, DOM, 브라우저 전역 객체, 네트워크 API에 의존하지 않는다.
- `CardDefinition`과 `CardInstance`는 계속 분리한다.
- 카드 위치 변경은 직접 배열 조작이 아니라 Zone 이동 API를 통해 처리한다.
- 셔플과 드로우는 결정론적 리플레이를 위해 `rngSeed`, `rngCursor`, 액션/이벤트 로그와 연결될 수 있어야 한다.
- Phase 5에서는 유닛 소환, 전장 슬롯 점유, 공격, 피해, 효과 DSL 해결을 앞당겨 완성하지 않는다.
- 단, Phase 6 이후가 바로 연결될 수 있도록 손패 카드 검증, Zone 이동 이벤트, 카드 인스턴스 생성 헬퍼를 준비한다.
- 모든 상태 변경 함수는 입력 `GameState`를 직접 mutation하지 않는 방식으로 구현한다.

## Phase 5 최종 목표

다음 기능을 구현한다.

- 카드 정의 JSON 로딩 및 검증
- 카드 정의 레지스트리 구성
- 덱 리스트 검증
- `CardDefinition`에서 `CardInstance` 생성
- 시드 기반 결정론적 덱 셔플
- 초기 덱/패 구성 헬퍼
- 카드 이동 공통 함수
- 드로우 처리
- `DRAW` 자동 페이즈에서 기본 1장 드로우 연결
- `CARD_DRAWN`, `CARD_MOVED` 이벤트 기록
- `ActionLogEntry`와 `eventLog`가 리플레이 가능한 순서로 유지되는지 검증

Phase 5 완료 시점에는 다음이 가능해야 한다.

- 독자 카드 JSON을 읽어 `CardDefinition` 배열로 검증할 수 있다.
- 유효하지 않은 카드 정의는 명확한 오류로 거부된다.
- 덱 리스트를 카드 정의 레지스트리 기준으로 검증할 수 있다.
- 같은 `rngSeed`와 같은 덱 리스트는 항상 같은 셔플 결과를 만든다.
- 플레이어 덱에서 카드를 1장 드로우하면 `deck -> hand` 이동과 인스턴스 `currentZone`이 함께 갱신된다.
- 덱이 비어 있을 때 드로우하면 Phase 10에서 덱 아웃으로 연결 가능한 실패 또는 이벤트를 남긴다.
- Phase4의 `advanceToFirstPlayablePhase` 또는 동등한 턴 시작 경로에서 `DRAW` 페이즈의 기본 드로우가 수행된다.
- 정상 처리된 드로우와 카드 이동은 이벤트 로그에 기록된다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/cards/schema.ts` | 카드 정의 런타임 검증과 정규화 |
| `src/cards/registry.ts` | 카드 정의 레지스트리 생성과 조회 |
| `src/cards/instance.ts` | 카드 인스턴스 생성 헬퍼 |
| `src/cards/deck.ts` | 덱 리스트 검증, 인스턴스화, 셔플 |
| `src/cards/index.ts` | Phase5 카드 API re-export |
| `src/zones/move.ts` | 카드 이동 공통 함수 |
| `src/zones/draw.ts` | 드로우 처리 함수 |
| `src/zones/index.ts` | Phase5 Zone API re-export |
| `src/events/factory.ts` | `CARD_MOVED`, `CARD_DRAWN` 이벤트 생성 헬퍼 추가 |
| `src/game/phase.ts` | `DRAW` 자동 페이즈 처리 연결 |
| `src/game/action.ts` | 필요 시 Phase5 드로우 자동 처리와 결과 연결 |
| `src/rules/types.ts` | 카드/덱/Zone 검증 오류 코드 보강 |
| `card-data/examples/*.json` | 독자 카드 정의 예시 보강 |
| `tests/card-schema.test.ts` | 카드 JSON 검증 테스트 |
| `tests/deck-system.test.ts` | 덱 검증, 인스턴스 생성, 셔플 테스트 |
| `tests/zone-move.test.ts` | Zone 이동 불변성 및 이벤트 테스트 |
| `tests/draw-system.test.ts` | 드로우 처리와 빈 덱 처리 테스트 |
| `tests/phase5-integration.test.ts` | 턴 시작 자동 드로우 통합 테스트 |

기존 Phase3 타입 파일은 필요한 경우에만 좁게 보강한다. 특히 Phase5를 위해 `GameState` 구조를 크게 갈아엎지 않는다.

## 2. 카드 정의 검증

`card-data/`의 JSON은 TypeScript 타입만으로 검증할 수 없으므로, Phase5에서는 런타임 검증 계층을 둔다.

필수 헬퍼:

- `parseCardDefinition(input: unknown): CardDefinition`
- `parseCardDefinitions(input: unknown): CardDefinition[]`
- `createCardRegistry(definitions: CardDefinition[]): CardRegistry`

권장 타입:

```ts
export interface CardRegistry {
  definitions: Record<CardId, CardDefinition>;
  allIds: CardId[];
}
```

검증 규칙:

- `cardId`는 비어 있지 않은 문자열이어야 한다.
- `nameKey`는 비어 있지 않은 문자열이어야 한다.
- `type`은 `UNIT`, `TACTIC`, `ONGOING`, `TOKEN` 중 하나여야 한다.
- `cost`는 0 이상의 정수여야 한다.
- `dominanceCost`, `dominanceValue`, `dominanceRequirement`는 존재하면 0 이상의 정수여야 한다.
- `UNIT` 카드는 `baseAttack`, `baseHealth`가 0 이상의 정수여야 한다.
- `rowRestriction`은 `ANY` 또는 `FRONT`/`BACK` 배열이어야 한다.
- `tags`와 `abilities`는 배열이어야 한다.
- 중복 `cardId`는 거부한다.
- 검증 오류는 표시 문구가 아니라 코드와 세부 정보를 반환하거나 throw한다.

Phase5에서는 외부 스키마 라이브러리를 추가하지 않는다. 필요한 검증은 작은 순수 TypeScript 함수로 작성한다.

## 3. 카드 인스턴스 생성

`CardDefinition`은 런타임 불변 원본이고, `CardInstance`는 게임 중 상태다.

필수 헬퍼:

- `createCardInstance(definition, ownerId, instanceId): CardInstance`
- `createDeckInstances(registry, ownerId, deckList, instanceIdPrefix): CardInstance[]`

기본 정책:

- `definitionId`는 원본 `cardId`를 참조한다.
- `ownerId`와 `controllerId`는 생성 시 같은 플레이어다.
- 초기 `currentZone`은 `{ type: 'DECK', ownerId }`다.
- 유닛의 `currentAttack`, `currentHealth`는 `baseAttack`, `baseHealth`에서 온다.
- 비유닛 카드는 공격력/체력 필드를 비워둘 수 있다.
- `damage = 0`, `exhausted = false`, `summonedThisTurn = false`로 시작한다.
- 인스턴스 ID는 같은 입력에서 같은 순서로 생성되어야 한다.

## 4. 덱 리스트와 셔플

덱 리스트는 카드 ID와 수량의 목록으로 표현한다.

권장 타입:

```ts
export interface DeckEntry {
  cardId: CardId;
  count: number;
}

export interface DeckValidationRule {
  minSize: number;
  maxSize: number;
  maxCopiesPerCard: number;
  allowTokenCards: boolean;
}
```

필수 헬퍼:

- `validateDeckList(registry, deckList, rule): ValidationResult`
- `expandDeckList(deckList): CardId[]`
- `shuffleInstanceIds(instanceIds, rng): InstanceId[]`

기본 정책:

- MVP 기본 덱 크기는 테스트 편의를 위해 규칙 객체에서 주입한다.
- `count`는 1 이상의 정수여야 한다.
- 레지스트리에 없는 `cardId`는 거부한다.
- `TOKEN` 카드는 기본 덱에 넣을 수 없다.
- 같은 `rngSeed`와 같은 입력은 같은 결과를 반환한다.
- 셔플은 Phase5에서 작은 결정론적 PRNG를 구현하거나 기존 `rngSeed`/`rngCursor` 확장 지점을 명확히 둔다.
- `Math.random()`은 사용하지 않는다.

## 5. Zone 이동 API

모든 카드 위치 변경은 `moveCard` 계층을 통해 수행한다.

필수 헬퍼:

- `moveCard(state, instanceId, to, reason): ZoneMoveResult`
- `drawCard(state, playerId): DrawCardResult`
- `drawCards(state, playerId, count): DrawCardsResult`

권장 결과 타입:

```ts
export type ZoneMoveResult =
  | {
      ok: true;
      state: GameState;
      event: GameEvent;
      record: CardMoveRecord;
    }
  | {
      ok: false;
      state: GameState;
      validation: ValidationResult;
    };
```

이동 규칙:

- `ZoneRegistry.cardInstances[instanceId]`가 없으면 실패한다.
- `from`은 인스턴스의 현재 `currentZone`에서 읽는다.
- `to`는 호출자가 명시한다.
- 플레이어 배열(`deck`, `hand`, `graveyard`, `banished`, `revealedCards`)과 `ZoneRegistry.cardInstances[instanceId].currentZone`은 반드시 함께 갱신한다.
- 전장 슬롯으로 이동하는 것은 Phase6에서 완성한다. Phase5에서는 `BATTLEFIELD` 직접 이동을 검증 실패로 두거나 테스트 전용 최소 처리를 명확히 제한한다.
- 실패 시 입력 `state`를 변경하지 않는다.
- 성공 시 `CARD_MOVED` 이벤트를 `eventLog`에 남긴다.

## 6. 드로우 처리

드로우는 덱 최상단 카드를 손패로 이동하는 특수 Zone 이동이다.

필수 정책:

- `drawCard(state, playerId)`는 해당 플레이어의 `deck[0]` 또는 명시된 top 정책에 따라 1장을 선택한다.
- 선택된 카드는 `deck`에서 제거되고 `hand` 끝에 추가된다.
- 카드 인스턴스의 `currentZone`은 `{ type: 'HAND', ownerId: playerId }`가 된다.
- `CARD_DRAWN` 이벤트를 남긴다.
- 필요하면 내부적으로 `CARD_MOVED`와 `CARD_DRAWN`을 모두 남긴다. 정책은 테스트로 고정한다.
- 빈 덱이면 상태를 변경하지 않고 `ERR_EMPTY_DECK` 또는 `DECK_OUT_PENDING`에 해당하는 오류/이벤트를 반환한다.
- Phase10의 승리 조건 구현 전까지 빈 덱 즉시 패배 처리는 하지 않는다.

`RuleErrorCode` 보강 후보:

- `ERR_CARD_DEFINITION_INVALID`
- `ERR_CARD_DEFINITION_DUPLICATED`
- `ERR_CARD_DEFINITION_NOT_FOUND`
- `ERR_DECK_INVALID`
- `ERR_EMPTY_DECK`
- `ERR_ZONE_MOVE_INVALID`
- `ERR_CARD_INSTANCE_NOT_FOUND`

## 7. 자동 페이즈 연결

Phase4는 `TURN_START -> DRAW -> RESOURCE -> MAIN` 자동 전환 헬퍼를 준비했다. Phase5에서는 `DRAW` 페이즈의 실제 드로우를 연결한다.

필수 요구:

- 새 턴 시작 후 첫 플레이 가능 페이즈로 이동하는 경로에서 활성 플레이어가 기본 1장을 드로우한다.
- 자동 드로우는 `DRAW` 페이즈 이벤트 순서 안에 기록된다.
- `PHASE_CHANGED`와 `CARD_DRAWN`의 로그 순서가 결정론적으로 고정된다.
- `RESOURCE` 페이즈의 자원 회복은 Phase5 범위 밖이다. 기존 자동 전환만 유지한다.
- 시작 패 드로우는 별도 게임 초기화 헬퍼로 구현할 수 있으나, 복잡한 멀리건은 Phase5 범위 밖이다.

## 8. 카드 데이터 예시

`card-data/examples/`에는 독자 데이터만 둔다.

권장 예시:

- 기본 전열 유닛
- 기본 후열 지원 유닛
- 기본 전술 카드
- 기본 지속 카드

주의사항:

- 원작 카드명, 캐릭터명, 설명문, 세력명, 고유 키워드를 쓰지 않는다.
- `nameKey`는 현지화 키 형태로만 둔다.
- 효과 텍스트가 필요하면 독자적인 추상 키 또는 빈 배열을 사용한다.
- 카드 이미지나 원작 UI 표현을 참조하지 않는다.

## 9. 리플레이와 결정론 기준

Phase5의 카드/덱/드로우 시스템은 이후 리플레이 시스템의 핵심 입력이다.

필수 기준:

- 같은 카드 데이터 버전, 같은 덱 리스트, 같은 `rngSeed`는 같은 초기 덱 순서를 만든다.
- `rngCursor`는 셔플에 사용한 난수 호출 수를 추적하거나, 추적하지 않는 경우 그 이유와 확장 지점을 코드로 명시한다.
- 드로우 결과는 `eventLog`로 재현 가능해야 한다.
- 카드 이동은 `CardMoveRecord` 또는 이벤트 payload로 from/to/reason을 남긴다.
- 실패한 드로우나 실패한 Zone 이동은 성공 로그에 섞지 않는다.

## 10. 테스트 요구사항

Phase5 테스트는 최소한 다음을 검증한다.

- 유효한 카드 JSON이 `CardDefinition`으로 파싱된다.
- 필수 필드가 빠진 카드 JSON은 거부된다.
- 중복 `cardId`는 레지스트리 생성에서 거부된다.
- 덱 리스트가 레지스트리 기준으로 검증된다.
- 같은 시드의 셔플 결과가 반복 실행에서 같다.
- 다른 시드의 셔플 결과가 달라질 수 있다.
- `createDeckInstances`가 같은 입력에서 안정적인 인스턴스 ID를 만든다.
- `moveCard`가 플레이어 zone 배열과 `CardInstance.currentZone`을 함께 갱신한다.
- `moveCard` 실패 시 입력 상태가 변경되지 않는다.
- `drawCard`가 덱에서 손패로 카드를 이동하고 `CARD_DRAWN` 이벤트를 남긴다.
- 빈 덱 드로우는 상태를 변경하지 않고 실패한다.
- 자동 `DRAW` 페이즈 통합 경로에서 활성 플레이어가 1장을 드로우한다.
- 룰 엔진 영역이 `src/scenes`, `src/ui`, Phaser, DOM을 import하지 않는다.

## 11. 완료 검증 명령

Phase5 완료 전 다음 명령을 모두 통과시킨다.

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

## 12. Phase5 완료 후 남겨야 할 경계

Phase5가 끝나도 다음은 아직 미완성으로 남겨야 한다.

- 유닛 소환과 전장 슬롯 배치 검증
- 지배력 기반 소환 검증
- 전열/후열 이동 규칙
- 공격 선언과 피해 계산
- 효과 DSL 실행
- 승리 조건과 덱 아웃 패배 처리
- 저장 파일 포맷과 리플레이 재생기
- AI 행동 탐색

이 경계를 넘는 구현은 Phase6 이후 문서에서 다룬다.
