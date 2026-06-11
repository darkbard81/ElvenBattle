# Phase 3 목표 지시문 — 핵심 데이터 모델 설계 및 타입 구현

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 핵심 데이터 모델을 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 3을 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

## 기준 문서

- `documents/Plan.md`
- `documents/Core_Rule_Spec_v0.1.md`
- `documents/Phase2_Goal.md`
- `AGENTS.md`

## Phase 3의 위치

`documents/Plan.md`에서 Phase 3은 다음 단계다.

- Phase 1: Core Rule Spec v0.1 설계
- Phase 2: 프로젝트 구조 및 개발 환경 구축
- Phase 3: 핵심 데이터 모델 설계
- Phase 4: 턴 및 페이즈 시스템 구현
- Phase 5 이후: 카드/덱/Zone, 전장, 전투, 효과, 리플레이, AI 구현

따라서 Phase 3은 룰 실행 로직을 완성하는 단계가 아니라, 이후 모든 룰 엔진이 공유할 정규 TypeScript 데이터 모델을 확정하는 단계다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- 룰 엔진 타입은 Phaser, DOM, 브라우저 전역 객체, 네트워크 API에 의존하지 않는다.
- `documents/Core_Rule_Spec_v0.1.md`의 지배력 시스템, 전열/후열 전장, Zone 모델, 카드 정의/인스턴스 분리를 반영한다.
- Phase 3에서는 reducer, 전투 계산, 효과 해결, 카드 로딩의 완전한 런타임 구현을 목표로 하지 않는다.
- 단, Phase 4~6에서 바로 사용할 수 있도록 타입, 상수, 생성 헬퍼, 최소 검증 헬퍼, 테스트 데이터를 준비한다.
- TypeScript strict 설정을 약화하지 않는다.

## Phase 3 최종 목표

다음 핵심 모델을 TypeScript 타입과 최소 헬퍼로 구현한다.

- `GameState`
- `PlayerState`
- `CardDefinition`
- `CardInstance`
- `ZoneRef`
- `ZoneRegistry`
- `BoardState`
- `BoardSlot`
- `DominanceState`
- `DominanceConfig`
- `ResourceState`
- `GameAction`
- `GameEvent`
- 로그와 리플레이 준비 타입

Phase 3 완료 시점에는 다음이 가능해야 한다.

- 타입만으로 Core Rule Spec의 최소 `GameState` 구조를 표현할 수 있다.
- 카드 원본 데이터와 게임 중 인스턴스 상태가 분리된다.
- 플레이어별 덱, 패, 묘지, 추방, 공개 카드 영역을 표현할 수 있다.
- 2행 x 3열 전열/후열 전장을 타입으로 표현할 수 있다.
- 지배력 한계, 점유량, 장악 점수, 초과 상태를 표현할 수 있다.
- 타입 수준과 최소 헬퍼 테스트가 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/core/types.ts` | 공통 식별자, Phase, GameStatus, GameState, PlayerState, 로그 타입 |
| `src/cards/types.ts` | CardDefinition, CardInstance, 카드 관련 보조 타입 |
| `src/cards/index.ts` | 카드 타입 re-export |
| `src/zones/types.ts` | ZoneType, ZoneRef, ZoneRegistry |
| `src/zones/index.ts` | Zone 타입 re-export |
| `src/board/types.ts` | Row, Column, SlotId, BoardSlot, BoardState |
| `src/board/index.ts` | Board 타입 re-export |
| `src/dominance/types.ts` | DominanceState, DominanceConfig, dominance 정책 타입 |
| `src/dominance/index.ts` | Dominance 타입 re-export |
| `src/events/types.ts` | GameEvent, GameEventType, EventSourceRef |
| `src/events/index.ts` | Event 타입 re-export |
| `src/rules/types.ts` | RuleError, RuleErrorCode, ValidationResult |
| `src/rules/index.ts` | Rule 타입 re-export |
| `src/game/types.ts` | GameConfig, TurnState, ScenarioState 등 게임 구성 타입 |
| `src/game/index.ts` | Game 타입 re-export |
| `src/replay/types.ts` | ReplayFile, StateSnapshot, ActionLogEntry |
| `src/replay/index.ts` | Replay 타입 re-export |
| `tests/model-types.test.ts` | 핵심 타입 조립 smoke test |
| `tests/card-model.test.ts` | 카드 정의/인스턴스 분리 테스트 |
| `tests/zone-board-model.test.ts` | Zone과 Board 구조 테스트 |
| `tests/dominance-model.test.ts` | 지배력 타입과 기본값 테스트 |

`src/core/types.ts`가 너무 커지지 않도록 세부 모델은 각 도메인 파일에 두고, `src/core/types.ts`는 공통 식별자와 최상위 `GameState` 조립에 집중한다.

## 2. 공통 식별자와 기본 열거 타입

`src/core/types.ts`에는 최소한 다음 타입을 포함한다.

```ts
export type GameId = string;
export type PlayerId = string;
export type CardId = string;
export type InstanceId = string;
export type EffectId = string;
export type ActionId = string;
export type EventId = string;

export type Phase =
  | 'SETUP'
  | 'MULLIGAN'
  | 'TURN_START'
  | 'DRAW'
  | 'RESOURCE'
  | 'MAIN'
  | 'COMBAT'
  | 'END'
  | 'GAME_OVER';

export type GameStatus = 'SETUP' | 'RUNNING' | 'FINISHED' | 'ABORTED';
```

지침:

- 기존 Phase2의 placeholder 타입을 유지하되 확장한다.
- 문자열 union을 우선 사용한다.
- enum은 런타임 객체가 꼭 필요할 때만 사용한다.

## 3. GameState 모델

`GameState`는 Core Rule Spec의 최소 필드를 포함해야 한다.

필수 필드:

- `gameId`
- `ruleVersion`
- `cardDataVersion`
- `scenarioId`
- `turnNumber`
- `activePlayerId`
- `priorityPlayerId`
- `phase`
- `players`
- `dominanceConfig`
- `board`
- `zones`
- `eventQueue`
- `effectStack`
- `continuousEffects`
- `pendingTriggers`
- `actionLog`
- `eventLog`
- `rngSeed`
- `rngCursor`
- `winner`
- `gameStatus`
- `turnState`
- `scenarioState`

권장 형태:

```ts
export interface GameState {
  gameId: GameId;
  ruleVersion: typeof RULE_VERSION;
  cardDataVersion: string;
  scenarioId?: string;
  turnNumber: number;
  activePlayerId: PlayerId;
  priorityPlayerId: PlayerId | null;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  dominanceConfig: DominanceConfig;
  board: BoardState;
  zones: ZoneRegistry;
  eventQueue: GameEvent[];
  effectStack: PendingEffect[];
  continuousEffects: ContinuousEffect[];
  pendingTriggers: PendingTrigger[];
  actionLog: ActionLogEntry[];
  eventLog: GameEvent[];
  rngSeed: string;
  rngCursor: number;
  winner: PlayerId | null;
  gameStatus: GameStatus;
  turnState: TurnState;
  scenarioState?: ScenarioState;
}
```

Phase 3에서 `PendingEffect`, `ContinuousEffect`, `PendingTrigger`는 최소 placeholder 구조를 허용한다. 단, `unknown`만 남발하지 말고 `effectId`, `sourceId`, `controllerId`, `payload` 같은 확장 지점을 명시한다.

## 4. PlayerState 모델

`PlayerState`는 다음 필드를 포함한다.

- `playerId`
- `kind`
- `hp`
- `maxHp`
- `deck`
- `hand`
- `graveyard`
- `banished`
- `resource`
- `dominance`
- `flags`
- `oncePerTurn`
- `revealedCards`
- `aiMetadata`

권장 형태:

```ts
export type PlayerKind = 'HUMAN' | 'AI' | 'SCENARIO';

export interface PlayerState {
  playerId: PlayerId;
  kind: PlayerKind;
  hp: number;
  maxHp: number;
  deck: InstanceId[];
  hand: InstanceId[];
  graveyard: InstanceId[];
  banished: InstanceId[];
  resource: ResourceState;
  dominance: DominanceState;
  flags: Record<string, boolean | number | string>;
  oncePerTurn: Record<string, number>;
  revealedCards: InstanceId[];
  aiMetadata?: AiMetadata;
}
```

Phase 3에서는 HP 감소, 드로우, 덱 아웃 같은 룰 처리를 구현하지 않는다. 상태를 정확히 담을 수 있는 타입과 테스트용 샘플만 만든다.

## 5. 카드 데이터 모델

`CardDefinition`과 `CardInstance`를 반드시 분리한다.

### CardDefinition

필수 필드:

- `cardId`
- `nameKey`
- `type`
- `cost`
- `dominanceCost`
- `dominanceValue`
- `dominanceRequirement`
- `faction`
- `attribute`
- `baseAttack`
- `baseHealth`
- `rowRestriction`
- `tags`
- `abilities`
- `effectScript`
- `rarity`
- `aiHints`

지침:

- `dominanceCost`, `dominanceValue`, `dominanceRequirement`는 선택 필드로 둘 수 있다.
- `UNIT`이 아닌 카드의 `baseAttack`, `baseHealth`도 선택 필드로 둔다.
- 효과 DSL은 Phase 8 구현 대상이므로 Phase 3에서는 구조화된 placeholder 타입으로 둔다.

### CardInstance

필수 필드:

- `instanceId`
- `definitionId`
- `ownerId`
- `controllerId`
- `currentZone`
- `currentAttack`
- `currentHealth`
- `damage`
- `statusEffects`
- `exhausted`
- `summonedThisTurn`
- `temporaryModifiers`
- `attachedEffects`

지침:

- `definitionId`는 `CardDefinition.cardId`를 참조한다.
- 원본 데이터는 `CardInstance`에 복사하지 않는다.
- 런타임 변화값만 `CardInstance`에 둔다.

## 6. Zone 모델

`ZoneType`은 다음 값을 포함한다.

- `DECK`
- `HAND`
- `BATTLEFIELD`
- `GRAVEYARD`
- `BANISHED`
- `STACK`
- `REVEALED`
- `TEMPORARY`

`ZoneRef`와 `ZoneRegistry`를 구현한다.

권장 형태:

```ts
export interface ZoneRef {
  type: ZoneType;
  ownerId?: PlayerId;
  slotId?: SlotId;
}

export interface ZoneRegistry {
  cardInstances: Record<InstanceId, CardInstance>;
  stack: InstanceId[];
  revealed: Record<PlayerId, InstanceId[]>;
  temporary: InstanceId[];
}
```

Phase 3에서는 `moveCard`의 전체 룰 검증을 구현하지 않는다. 단, Phase 5에서 `moveCard`를 추가할 수 있도록 `ZoneMoveReason` 타입과 `CardMoveRecord` 타입은 준비한다.

## 7. 전장 모델

기본 전장은 각 플레이어 2행 x 3열이다.

필수 타입:

- `Row`
- `Column`
- `SlotId`
- `BoardSlot`
- `BoardState`

권장 형태:

```ts
export type Row = 'FRONT' | 'BACK';
export type Column = 0 | 1 | 2;
export type SlotId = `${PlayerId}:${Row}:${Column}`;

export interface BoardSlot {
  slotId: SlotId;
  ownerSide: PlayerId;
  row: Row;
  column: Column;
  unit: InstanceId | null;
}

export interface BoardState {
  columns: 3;
  rows: Row[];
  slots: Record<SlotId, BoardSlot>;
}
```

Phase 3에서는 슬롯 생성 헬퍼를 추가할 수 있다.

권장 헬퍼:

- `createEmptyBoard(playerIds: readonly PlayerId[]): BoardState`
- `createSlotId(playerId: PlayerId, row: Row, column: Column): SlotId`

헬퍼를 구현한다면 반드시 테스트를 추가한다.

## 8. 지배력과 자원 모델

`DominanceState`와 `DominanceConfig`는 Core Rule Spec v0.1.1을 따른다.

필수 타입:

- `DominanceState`
- `DominanceConfig`
- `DominanceOverloadPolicy`
- `ResourceState`

권장 기본값:

```ts
export const DEFAULT_DOMINANCE_CONFIG = {
  startLimit: 3,
  limitGainPerTurn: 1,
  cap: 10,
  overloadPolicy: 'BLOCK_NEW_SUMMON_ONLY',
} as const satisfies DominanceConfig;
```

지침:

- Phase 3에서는 전장 카드 기반 재계산 로직을 완성하지 않아도 된다.
- 단, `createInitialDominanceState(config)` 같은 초기 상태 헬퍼는 구현할 수 있다.
- 지배력은 `energy`와 분리된 모델로 둔다.

## 9. Action / Event / Rule Validation 타입

Phase 3에서는 실행 로직이 아니라 타입 계약을 만든다.

필수 타입:

- `ActionType`
- `GameAction`
- `AttackPayload`
- `SummonUnitPayload`
- `MoveUnitPayload`
- `GameEventType`
- `GameEvent`
- `EventSourceRef`
- `ValidationResult`
- `RuleError`
- `RuleErrorCode`

`RuleErrorCode`에는 최소한 다음 값을 포함한다.

- `ERR_WRONG_PHASE`
- `ERR_NOT_PRIORITY_PLAYER`
- `ERR_CARD_NOT_IN_ZONE`
- `ERR_INSUFFICIENT_RESOURCE`
- `ERR_INSUFFICIENT_DOMINANCE`
- `ERR_DOMINANCE_REQUIREMENT_NOT_MET`
- `ERR_INVALID_TARGET`
- `ERR_SLOT_OCCUPIED`
- `ERR_ATTACKER_EXHAUSTED`
- `ERR_SUMMONING_SICKNESS`
- `ERR_ONCE_PER_TURN_USED`
- `ERR_EFFECT_CONDITION_NOT_MET`
- `ERR_GAME_ALREADY_FINISHED`

## 10. 로그와 리플레이 준비 타입

Phase 11의 리플레이 구현을 준비하기 위해 최소 타입을 둔다.

필수 타입:

- `ActionLogEntry`
- `StateSnapshot`
- `ReplayFile`
- `GameConfig`

지침:

- `ReplayFile`은 `ruleVersion`, `cardDataVersion`, `rngSeed`, `initialDecks`, `actions`, `checkpoints`, `finalStateHash`를 포함한다.
- Phase 3에서는 state hash 계산 로직을 구현하지 않는다.
- 로그 타입은 Phase 4의 `applyAction`과 Phase 11의 리플레이가 동시에 사용할 수 있게 만든다.

## 11. 타입 export 규칙

- 각 도메인 `index.ts`는 해당 도메인의 public type을 re-export한다.
- `src/core/index.ts`는 공통 타입과 버전을 re-export한다.
- 도메인 간 순환 import를 만들지 않는다.
- type-only import는 `import type`을 사용한다.
- 런타임 상수는 필요한 경우에만 export한다.

권장 import 방향:

```text
core/types -> 도메인 타입을 조립하기 위해 type import 가능
cards/types -> core, zones, effects/status placeholder
zones/types -> core, board, cards type import 가능
board/types -> core
dominance/types -> 독립 또는 core
events/types -> core
rules/types -> core
replay/types -> core, game
```

순환 참조가 생기면 공통 타입을 `src/core/types.ts` 또는 별도 좁은 타입 파일로 올린다.

## 12. 테스트 요구사항

Phase 3 완료 시 다음 테스트를 추가하고 통과시킨다.

| 테스트 파일 | 검증 내용 |
|---|---|
| `tests/model-types.test.ts` | 최소 `GameState` 객체를 타입 안정적으로 조립할 수 있음 |
| `tests/card-model.test.ts` | `CardDefinition`과 `CardInstance`가 분리되어 있음 |
| `tests/zone-board-model.test.ts` | `ZoneRef`, `ZoneRegistry`, 2x3 `BoardState` 구조 검증 |
| `tests/dominance-model.test.ts` | `DEFAULT_DOMINANCE_CONFIG`, 초기 지배력 상태 검증 |

테스트 지침:

- 테스트는 런타임 룰 구현이 아니라 모델 조립과 헬퍼 결과를 검증한다.
- 샘플 데이터는 독자 데이터만 사용한다.
- 원작 카드명이나 원작 고유 표현을 테스트 데이터에 쓰지 않는다.

## 13. 완료 조건

Phase 3은 다음 조건을 모두 만족해야 완료로 본다.

- [ ] `GameState` 타입이 Core Rule Spec의 필수 필드를 포함한다.
- [ ] `PlayerState` 타입이 HP, Zone 배열, 자원, 지배력, flags, oncePerTurn을 포함한다.
- [ ] `CardDefinition`과 `CardInstance`가 별도 타입으로 구현되어 있다.
- [ ] 카드 원본 데이터와 런타임 상태를 혼합하지 않는다.
- [ ] `ZoneType`, `ZoneRef`, `ZoneRegistry`가 구현되어 있다.
- [ ] `BoardState`, `BoardSlot`, `SlotId`, `Row`, `Column`이 구현되어 있다.
- [ ] `DominanceState`, `DominanceConfig`, `ResourceState`가 구현되어 있다.
- [ ] `GameAction`, `GameEvent`, `ValidationResult`, `RuleError` 타입이 구현되어 있다.
- [ ] 로그와 리플레이 준비 타입이 구현되어 있다.
- [ ] 도메인 `index.ts`가 public 타입을 re-export한다.
- [ ] 타입 import가 순환 런타임 의존성을 만들지 않는다.
- [ ] 원작 보호 대상 데이터가 추가되지 않았다.
- [ ] `npm run build`가 통과한다.
- [ ] `npm run lint`가 통과한다.
- [ ] `npm run format:check`가 통과한다.
- [ ] `npm test`가 통과한다.

## 14. 제외 범위

Phase 3에서 다음은 구현하지 않는다.

- `applyAction` reducer
- 턴/페이즈 진행 로직
- 카드 JSON 스키마 검증 완성
- 덱 셔플과 드로우 처리
- `moveCard`의 전체 룰 검증
- 지배력 재계산의 전체 전장 스캔 로직
- 유닛 소환 검증
- 공격 대상 검증
- 피해 계산
- 효과 스택 해결
- 지속 효과 레이어 계산
- 리플레이 재생
- AI 행동 탐색
- Phaser UI 구현

단, 위 기능들이 사용할 타입과 확장 지점은 Phase 3에서 마련한다.

## 15. Phase 4로 넘길 준비물

Phase 3 완료 후 Phase 4는 다음 작업을 바로 시작할 수 있어야 한다.

- `GameState.phase`, `activePlayerId`, `priorityPlayerId` 기반 페이즈 전환 구현
- `GameAction` 타입을 사용하는 `applyAction` reducer 구현
- `ValidationResult`와 `RuleErrorCode` 기반 행동 검증 구현
- `ActionLogEntry`와 `GameEvent`를 통한 액션/이벤트 로그 기록
- `TurnState`를 사용한 턴당 제한 초기화

## 16. 최종 산출물

Phase 3 결과로 다음을 제출해야 한다.

1. 핵심 데이터 모델 TypeScript 타입
2. 카드 정의/인스턴스 타입
3. Zone 모델 타입
4. Board 모델 타입
5. Dominance/Resource 모델 타입
6. Action/Event/Rule Validation 타입
7. Replay 준비 타입
8. 최소 생성 헬퍼와 기본 상수
9. 모델 테스트
10. 통과한 검증 명령 목록
11. Phase 4 착수 시 남은 TODO 목록

## 작성 및 구현 방식

- 설명과 문서는 한국어로 작성한다.
- 코드, 파일명, npm script, 타입명은 영어를 사용한다.
- 코드 주석은 한국어로 작성한다.
- 기존 `documents/Plan.md`와 `documents/Core_Rule_Spec_v0.1.md`의 방향을 좁히거나 바꾸지 않는다.
- Phase 3은 “데이터 모델 구현” 단계이므로 실행 로직을 과도하게 앞당기지 않는다.
- 타입은 이후 구현 단계에서 수정 비용이 커지지 않도록 보수적으로 설계한다.
- 테스트 가능한 상태를 완료 기준으로 삼고, 단순 타입 선언만으로 완료 처리하지 않는다.
