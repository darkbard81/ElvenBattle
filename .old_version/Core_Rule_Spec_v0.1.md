# Core Rule Spec v0.1 심층분석

작성일: 2026-06-10

대상: 창각의 아테리얼 스타일을 일반화한 독자 디지털 TCG 엔진

참고 원칙:

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 사용하지 않는다.
- 원작은 카드 배틀 RPG 계열로 알려져 있으나, 본 문서는 공개적으로 알려진 전열/후열 배치형 카드 전투 감각만 일반화한다.
- 세부 룰은 Magic: The Gathering의 페이즈/존/스택식 공식 규칙 구조, Hearthstone의 디지털 전용 자원 곡선, Legends of Runeterra의 디지털 CCG 전투 템포를 참고하되 그대로 복제하지 않는다.
- 핵심 룰 엔진은 Node.js + TypeScript 순수 로직으로 작성하고, Phaser는 표현 계층으로만 둔다.

## 1. 설계 목표와 범위

### 해결해야 하는 문제

Core Rule Spec v0.1은 카드 데이터와 플레이어 행동을 입력받아 결정론적으로 `GameState`를 변화시키는 룰 엔진의 기준 문서다. 엔진 구현자는 이 문서를 기준으로 다음을 일관되게 판단할 수 있어야 한다.

| 항목 | 정의 |
|---|---|
| 상태 | 게임 진행, 플레이어, 카드 인스턴스, 존, 전장, 효과 큐, 난수 시드, 로그 |
| 행동 | 카드 사용, 유닛 소환, 이동, 공격, 효과 발동, 타겟 선택, 페이즈 종료 |
| 검증 | 페이즈, 권한, 비용, 존, 타겟, 슬롯, 공격 가능 상태, 제한 횟수 |
| 상태 변화 | 비용 지불, 카드 이동, 유닛 생성, 피해, 파괴, 트리거 등록, 로그 기록 |
| 충돌 해결 | 이벤트 큐, 효과 스택, 지속 효과 레이어, 동시 트리거 정렬 |

### 포함 범위

- PvE 1인 플레이어 대 AI/시나리오 적 전투
- 턴 기반 게임 루프
- 전열/후열 기반 전장
- 유닛 카드, 전술 카드, 지속 카드의 기본 모델
- 자원 소비와 턴별 회복
- 이벤트 기반 효과 처리
- 결정론적 리플레이와 상태 스냅샷
- AI가 사용할 수 있는 `legalActions`, `simulateAction`, `evaluateState` 인터페이스

### 제외 범위

- PvP 동기화, 매치메이킹, 랭킹, 부정행위 방지
- 원작 카드, 캐릭터, 스토리, UI, 서버 프로토콜 복제
- 카드 일러스트/사운드/연출 리소스
- 복잡한 카드 제작/경제 시스템
- 네트워크 권위 서버 구현 세부

### PvE 중심 구조가 룰 설계에 주는 영향

| 설계 영역 | PvE 영향 |
|---|---|
| 승리 조건 | 단순 상대 HP 0 외 보스 처치, 생존 턴, 퍼즐 목표를 룰로 확장해야 한다. |
| AI | 적은 동일한 룰 엔진 위에서 행동해야 하며, 시나리오 스크립트가 AI 행동 후보를 제한할 수 있다. |
| 정보 공개 | AI 난이도 조절을 위해 `aiVisibleState`를 만들 수 있지만, 기본 리플레이는 실제 공개 정보만 기록한다. |
| 밸런스 | PvP 공정성보다 반복 플레이, 난이도 곡선, 보스 특수 룰 안정성이 중요하다. |
| 효과 처리 | 시나리오 트리거와 카드 트리거가 같은 이벤트 모델을 사용해야 한다. |

### 책임 분리

| 계층 | 책임 | 금지 |
|---|---|---|
| 룰 엔진 | `GameState` 검증/변경, 이벤트 생성, 효과 처리, 승패 판정 | DOM, Phaser 객체, 네트워크 호출 직접 접근 |
| 데이터 | 카드 정의, 효과 DSL, 시나리오 목표, 밸런스 상수 | 실행 중 상태 저장 |
| UI/Phaser | 렌더링, 애니메이션, 입력 수집, 로그 표시 | 임의로 룰 상태 변경 |
| 저장/리플레이 | 액션 로그, 이벤트 로그, 스냅샷, 버전 기록 | 룰 검증 우회 |
| AI | 합법 행동 조회, 상태 평가, 시뮬레이션 | 비공개 정보 사용, 난수 직접 호출 |

## 2. 핵심 게임 루프 정의

### 게임 시작 절차

1. 룰 버전, 카드 데이터 버전, 시나리오 ID, `rngSeed`를 고정한다.
2. 양측 덱 리스트를 검증한다.
3. 카드 정의에서 `CardInstance`를 생성한다.
4. 각 덱을 시드 기반 Fisher-Yates 방식으로 섞는다.
5. 선공/후공을 결정한다. PvE 기본값은 플레이어 선공이며, 시나리오가 `startingPlayerId`로 덮어쓸 수 있다.
6. 시작 HP, 시작 자원, 최대 자원, 시작 패를 세팅한다.
7. 멀리건 규칙이 켜져 있으면 `MULLIGAN` 페이즈를 거친다.
8. `GAME_STARTED`, `TURN_STARTED` 이벤트를 기록한다.

### 기본 시작값

| 항목 | 추천 기본값 | 비고 |
|---|---:|---|
| 플레이어 HP | 30 | 보스는 시나리오별 40~120 |
| 덱 크기 | 30 | PvE 짧은 전투 기준 |
| 시작 패 | 5 | 선공/후공 차이는 후공 보너스 카드 또는 자원으로 보정 |
| 시작 자원 | 0 | 1턴 시작 시 `maxResource=1`, `resource=1` |
| 최대 자원 | 10 | 디지털 CCG의 명료한 성장 곡선 |
| 전열 슬롯 | 3 | 배치 판단이 생기되 MVP 구현이 단순함 |
| 후열 슬롯 | 3 | 전열과 같은 열 관계를 만들기 쉬움 |
| 최대 패 | 10 | 종료 페이즈 정리 규칙에 사용 |

### 페이즈 표

| 페이즈 | 가능한 행동 | 금지 행동 | 자동 처리 | 트리거 이벤트 | 상태 갱신 순서 |
|---|---|---|---|---|---|
| SETUP | 없음 | 모든 플레이 액션 | 덱 생성, 셔플, 시작 패 드로우 | GAME_STARTED | 카드 인스턴스 생성 -> 셔플 -> 드로우 -> 선공 설정 |
| MULLIGAN | MulliganAction, ConfirmMulliganAction | 공격, 소환, 효과 발동 | 교체 카드 반환/재드로우 | MULLIGAN_STARTED, CARD_DRAWN | 선택 카드 덱 반환 -> 셔플 -> 재드로우 |
| TURN_START | 없음 | 수동 행동 | 턴 수 증가, 행동권 설정, 일회성 기록 초기화 | TURN_STARTED | active 변경 -> 턴 카운트 -> flags 초기화 |
| DRAW | 없음 또는 시나리오 허용 빠른 효과 | 카드 사용, 공격 | 기본 1장 드로우, 덱 아웃 확인 | CARD_DRAWN, DECK_OUT_CHECKED | 덱 확인 -> 드로우 -> 핸드 제한 예약 |
| RESOURCE | 없음 | 모든 수동 행동 | 최대 자원 증가, 자원 회복 | RESOURCE_CHANGED | maxResource 적용 -> resource 채움 |
| MAIN | PlayCard, SummonUnit, ActivateEffect, MoveUnit, EndPhase | 공격 선언 | 지속 효과 재계산 | CARD_PLAYED, UNIT_SUMMONED, UNIT_MOVED | 검증 -> 비용 -> 카드 이동/생성 -> 이벤트 큐 처리 |
| COMBAT | AttackAction, ActivateCombatEffect, EndPhase | 일반 소환, 일반 이동 | 공격 가능 상태 갱신 | ATTACK_DECLARED, DAMAGE_DEALT | 공격 검증 -> 피해 -> 파괴 -> 트리거 |
| END | EndTurnAction | 카드 사용, 공격 | 턴 종료 효과 만료, 최대 패 초과 처리 | TURN_ENDED, EFFECT_EXPIRED | 종료 트리거 -> 만료 -> 핸드 정리 -> 승패 확인 |
| GAME_OVER | 없음 | 모든 행동 | 최종 로그 고정 | GAME_ENDED | winner 기록 -> status FINISHED |

### 턴 교대

`END` 페이즈의 모든 이벤트와 상태 기반 처리가 완료된 뒤 `activePlayerId`를 상대 또는 시나리오가 지정한 다음 행위자로 바꾼다. `priorityPlayerId`는 새 active player로 설정한다. PvE 보스가 다중 행동을 갖는 경우에도 턴 소유자는 하나이며, 보스 패턴은 AI가 여러 `GameAction`을 순차 제출하는 방식으로 표현한다.

### 게임 종료 판정

매 액션 처리 후, 매 이벤트 큐 비움 후, 매 페이즈 종료 후 `checkWinConditions(state)`를 호출한다. 승리 조건은 시나리오가 확장할 수 있지만 기본 우선순위는 다음이다.

1. 항복 또는 비정상 종료
2. HP 0 이하
3. 보스 목표 달성
4. 덱 아웃 패배
5. 턴 제한 결과

## 3. GameState 모델 설계

```ts
type GameId = string;
type PlayerId = string;
type CardId = string;
type InstanceId = string;
type EffectId = string;

type GameStatus = 'SETUP' | 'RUNNING' | 'FINISHED' | 'ABORTED';
type Phase =
  | 'SETUP'
  | 'MULLIGAN'
  | 'TURN_START'
  | 'DRAW'
  | 'RESOURCE'
  | 'MAIN'
  | 'COMBAT'
  | 'END'
  | 'GAME_OVER';

interface GameState {
  gameId: GameId;
  ruleVersion: 'core-rule-v0.1';
  cardDataVersion: string;
  scenarioId?: string;
  turnNumber: number;
  activePlayerId: PlayerId;
  priorityPlayerId: PlayerId | null;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
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

| 필드 | 존재 이유 | 변경 시점 | 저장/리플레이 | UI |
|---|---|---|---|---|
| gameId | 저장 단위 식별 | 생성 시 | 필수 | 선택 |
| turnNumber | 턴 기반 효과와 로그 기준 | TURN_START | 필수 | 필수 |
| activePlayerId | 현재 턴 소유자 | 턴 교대 | 필수 | 필수 |
| priorityPlayerId | 행동권/선택권 소유자 | 페이즈/효과 선택 | 필수 | 필수 |
| phase | 합법 행동 검증 | 페이즈 변경 | 필수 | 필수 |
| players | HP, 패, 자원 등 | 대부분의 액션 | 필수 | 필수 |
| board | 전장 슬롯과 유닛 | 소환/이동/파괴 | 필수 | 필수 |
| zones | 모든 카드 위치의 정규 저장소 | 카드 이동 | 필수 | 일부 |
| eventQueue | 이벤트 기반 효과 처리 | 액션/효과 중 | 디버그용 권장 | 선택 |
| effectStack | 해결 대기 효과 | 발동/응답 시 | 필수 | 필수 |
| continuousEffects | 지속 효과 재계산 | 소환/이동/만료 | 필수 | 필수 |
| pendingTriggers | 동시 트리거 정렬 | 이벤트 발생 후 | 필수 | 선택 |
| actionLog | 리플레이 입력 원본 | 액션 수락 시 | 필수 | 선택 |
| eventLog | 검증/디버그/연출 | 이벤트 발생 시 | 권장 | 필수 |
| rngSeed | 결정론 보장 | 생성 시 | 필수 | 숨김 |
| rngCursor | 난수 호출 순서 검증 | 난수 사용 시 | 필수 | 숨김 |
| winner | 종료 결과 | GAME_OVER | 필수 | 필수 |
| gameStatus | 실행 가능 여부 | 생성/종료/중단 | 필수 | 필수 |

## 4. PlayerState 설계

```ts
interface PlayerState {
  playerId: PlayerId;
  kind: 'HUMAN' | 'AI' | 'SCENARIO';
  hp: number;
  maxHp: number;
  deck: InstanceId[];
  hand: InstanceId[];
  graveyard: InstanceId[];
  banished: InstanceId[];
  resource: ResourceState;
  flags: Record<string, boolean | number | string>;
  oncePerTurn: Record<string, number>;
  revealedCards: InstanceId[];
  aiMetadata?: AiMetadata;
}

interface ResourceState {
  current: number;
  max: number;
  cap: number;
  temporary: number;
}
```

| 항목 | 목적 | 룰 영향도 |
|---|---|---|
| playerId | 모든 액션/카드 소유 관계 식별 | 높음 |
| kind | 사람, AI, 시나리오 적 구분 | 중간 |
| hp/maxHp | 기본 승패 조건 | 높음 |
| deck | 드로우와 덱 아웃 | 높음 |
| hand | 카드 사용 가능성 | 높음 |
| graveyard | 파괴/사용 완료 카드 추적 | 높음 |
| banished | 되돌리기 어려운 제거 영역 | 중간 |
| resource | 카드 비용 지불 | 높음 |
| flags | 시나리오/임시 상태 | 중간 |
| oncePerTurn | 턴당 1회 제한 | 높음 |
| revealedCards | 공개된 비전장 카드 | 중간 |
| aiMetadata | 성향, 난이도, 평가 캐시 | 낮음, 룰 영향 없음 |

## 5. 카드 데이터 모델 설계

카드 원본 데이터와 게임 중 인스턴스는 반드시 분리한다. 같은 카드 정의에서 여러 장의 인스턴스가 생성될 수 있고, 각 인스턴스는 피해, 버프, 소유자, 현재 존이 달라진다.

```ts
type CardType = 'UNIT' | 'TACTIC' | 'ONGOING' | 'TOKEN';
type Row = 'FRONT' | 'BACK';

interface CardDefinition {
  cardId: CardId;
  nameKey: string;
  type: CardType;
  cost: number;
  faction?: string;
  attribute?: string;
  baseAttack?: number;
  baseHealth?: number;
  rowRestriction?: Row[] | 'ANY';
  tags: string[];
  abilities: AbilityDefinition[];
  effectScript?: EffectScript;
  rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'BOSS' | 'TOKEN';
  aiHints?: AiCardHints;
}

interface CardInstance {
  instanceId: InstanceId;
  definitionId: CardId;
  ownerId: PlayerId;
  controllerId: PlayerId;
  currentZone: ZoneRef;
  currentAttack?: number;
  currentHealth?: number;
  damage: number;
  statusEffects: StatusEffect[];
  exhausted: boolean;
  summonedThisTurn: boolean;
  temporaryModifiers: Modifier[];
  attachedEffects: EffectId[];
}
```

| 구분 | 저장 위치 | 변경 여부 | 예시 |
|---|---|---|---|
| CardDefinition | 카드 DB | 런타임 불변 | 비용 2, 기본 공격력 2 |
| CardInstance | GameState | 런타임 변경 | 피해 1, 기절, 컨트롤러 변경 |

분리 이유:

- 리플레이는 카드 데이터 버전과 액션 로그만으로 동일 인스턴스를 재구성할 수 있다.
- 버프/피해/컨트롤 변경이 원본 데이터를 오염시키지 않는다.
- AI는 원본 효율과 현재 전장 가치를 별도로 평가할 수 있다.
- 카드 패치 시 과거 리플레이는 `cardDataVersion`으로 고정된다.

## 6. Zone 시스템 설계

```ts
type ZoneType =
  | 'DECK'
  | 'HAND'
  | 'BATTLEFIELD'
  | 'GRAVEYARD'
  | 'BANISHED'
  | 'STACK'
  | 'REVEALED'
  | 'TEMPORARY';

interface ZoneRef {
  type: ZoneType;
  ownerId?: PlayerId;
  slotId?: string;
}

interface ZoneRegistry {
  cardInstances: Record<InstanceId, CardInstance>;
  stack: InstanceId[];
  revealed: Record<PlayerId, InstanceId[]>;
  temporary: InstanceId[];
}
```

| Zone | 공개 | 순서 보존 | 소유자 필요 | 리플레이 기록 | 이동 이벤트 |
|---|---|---|---|---|---|
| DECK | 비공개 | 필수 | 필수 | 셔플 seed/cursor와 이동 기록 | CARD_MOVED, CARD_DRAWN |
| HAND | 소유자에게 공개 | 선택적, UI 표시 순서 | 필수 | 필수 | CARD_MOVED |
| BATTLEFIELD | 공개 | 슬롯 좌표 기준 | 컨트롤러 필수 | 필수 | UNIT_SUMMONED, UNIT_MOVED |
| GRAVEYARD | 공개 | 필수 | 필수 | 필수 | UNIT_DESTROYED, CARD_MOVED |
| BANISHED | 공개 기본 | 필수 | 필수 | 필수 | CARD_BANISHED |
| STACK | 공개 | LIFO 또는 큐 정책 | 효과 소유자 필요 | 필수 | EFFECT_TRIGGERED, EFFECT_RESOLVED |
| REVEALED | 공개 범위 지정 | 필수 | 필수 | 필수 | CARD_REVEALED |
| TEMPORARY | 효과별 | 선택 | 선택 | 권장 | TOKEN_CREATED, EFFECT_EXPIRED |

모든 카드 이동은 `moveCard(state, instanceId, from, to, reason)`만 통해 수행한다. 직접 배열 조작은 금지한다.

## 7. 전장 구조: 전열/후열 설계

### 기본 모델

v0.1 기본 전장은 각 플레이어당 2행 x 3열이다. 앞줄은 직접 전투를 담당하고, 뒷줄은 전열이 비어 있거나 특정 효과가 있을 때 공격받는다.

```ts
interface BoardState {
  columns: 3;
  rows: Row[];
  slots: Record<SlotId, BoardSlot>;
}

type SlotId = `${PlayerId}:${Row}:${0 | 1 | 2}`;

interface BoardSlot {
  slotId: SlotId;
  ownerSide: PlayerId;
  row: Row;
  column: 0 | 1 | 2;
  unit: InstanceId | null;
}
```

JSON 예시:

```json
{
  "columns": 3,
  "rows": ["FRONT", "BACK"],
  "slots": {
    "P1:FRONT:0": { "ownerSide": "P1", "row": "FRONT", "column": 0, "unit": null },
    "P1:BACK:0": { "ownerSide": "P1", "row": "BACK", "column": 0, "unit": null }
  }
}
```

### 배치 및 전투 규칙

| 항목 | v0.1 규칙 |
|---|---|
| 전열 슬롯 수 | 3 |
| 후열 슬롯 수 | 3 |
| 슬롯 좌표 | `ownerSide + row + column` |
| 배치 조건 | 빈 슬롯, 카드 rowRestriction 만족, 비용 지불 가능 |
| 전열 차이 | 전열 유닛은 기본 공격 가능, 상대 공격의 우선 대상 |
| 후열 차이 | 후열 유닛은 기본 공격 가능하되 같은 열 전열이 막고 있으면 직접 공격받지 않음 |
| 공격 가능 대상 | 같은 열 상대 전열 우선, 없으면 같은 열 후열, 같은 열도 없으면 상대 플레이어 |
| 후열 보호 | 같은 열 상대 전열이 있으면 후열 대상 지정 불가. `PIERCE_BACK_ROW` 태그가 있으면 예외 |
| 이동 | MAIN 페이즈에 턴당 유닛 1회, 같은 플레이어 빈 슬롯으로 이동 |
| 빈 슬롯 | 공격 경로를 열어 직접 HP 공격 가능 |
| 인접 참조 | `sameColumn`, `adjacentColumn`, `sameRow` 셀렉터 지원 |

결정 필요: 후열 유닛의 공격 가능 여부. 추천 기본값은 후열도 공격 가능하되 공격력 -0, 대신 후열 직접 공격이 제한되는 방식이다. 대안은 후열 공격 불가 또는 후열 원거리 전용이다.

## 8. Action 모델 설계

모든 액션은 클라이언트 입력과 AI 입력을 동일하게 다룬다.

```ts
type ActionType =
  | 'PLAY_CARD'
  | 'SUMMON_UNIT'
  | 'ACTIVATE_EFFECT'
  | 'ATTACK'
  | 'MOVE_UNIT'
  | 'END_PHASE'
  | 'END_TURN'
  | 'MULLIGAN'
  | 'SELECT_TARGET';

type GameAction = {
  actionId: string;
  playerId: PlayerId;
  type: ActionType;
  payload: unknown;
  clientTimestamp?: number;
};

function applyAction(state: GameState, action: GameAction): GameState;
```

| Action | 입력값 | 실행 가능 조건 | 실패 조건 | 이벤트 | 상태 변경 | 로그 |
|---|---|---|---|---|---|---|
| PlayCardAction | hand instanceId, targets | MAIN/COMBAT 허용, 비용 가능 | 손패 아님, 비용 부족, 타겟 불가 | CARD_PLAYED | 비용 차감, 카드 이동/효과 등록 | action + public payload |
| SummonUnitAction | hand instanceId, slotId | MAIN, 빈 슬롯, UNIT | 슬롯 점유, 제한 위반 | UNIT_SUMMONED | 손패 -> 전장, 소환멀미 설정 | action + slot |
| ActivateEffectAction | sourceId, abilityId, targets | 우선권, 조건 만족 | once 위반, 타겟 불가 | EFFECT_ACTIVATED | 비용, stack 등록 | action + ability |
| AttackAction | attackerId, targetRef | COMBAT, 공격 가능 | exhausted, 보호 규칙 위반 | ATTACK_DECLARED | exhausted true, 피해 처리 | action + target |
| MoveUnitAction | unitId, toSlotId | MAIN, 이동 가능 | 턴당 이동 위반, 슬롯 점유 | UNIT_MOVED | 슬롯 변경, 이동 기록 | action |
| EndPhaseAction | 없음 | 현재 우선권자 | 큐 처리 중 | PHASE_CHANGED | 다음 페이즈 | action |
| EndTurnAction | 없음 | END 페이즈 | 종료 불가 상태 | TURN_ENDED | 턴 교대 | action |
| MulliganAction | replaceIds | MULLIGAN | 비손패 카드 | CARD_MOVED, CARD_DRAWN | 교체 드로우 | private 선택은 소유자 로그 |
| SelectTargetAction | pendingEffectId, targets | target 선택 대기 | 유효하지 않은 선택 | TARGET_SELECTED | 효과 해결 계속 | action |

## 9. Rule Validation 설계

```ts
interface ValidationResult {
  ok: boolean;
  errors: RuleError[];
}

interface RuleError {
  code: RuleErrorCode;
  messageKey: string;
  detail?: Record<string, unknown>;
}

type RuleErrorCode =
  | 'ERR_WRONG_PHASE'
  | 'ERR_NOT_PRIORITY_PLAYER'
  | 'ERR_CARD_NOT_IN_ZONE'
  | 'ERR_INSUFFICIENT_RESOURCE'
  | 'ERR_INVALID_TARGET'
  | 'ERR_SLOT_OCCUPIED'
  | 'ERR_ATTACKER_EXHAUSTED'
  | 'ERR_SUMMONING_SICKNESS'
  | 'ERR_ONCE_PER_TURN_USED'
  | 'ERR_EFFECT_CONDITION_NOT_MET'
  | 'ERR_GAME_ALREADY_FINISHED';
```

검증 순서:

1. `gameStatus === RUNNING`인지 확인한다.
2. 액션 제출자가 `priorityPlayerId` 또는 허용된 자동 행위자인지 확인한다.
3. 현재 `phase`에서 허용되는 `ActionType`인지 확인한다.
4. 카드/유닛/효과 source가 올바른 zone에 있는지 확인한다.
5. 비용을 지불할 수 있는지 확인한다.
6. 타겟 셀렉터와 보호 규칙을 검증한다.
7. 슬롯 점유와 row restriction을 검증한다.
8. 공격 가능 상태, exhausted, summonedThisTurn, 상태 효과를 확인한다.
9. once per turn 또는 once per game 제한을 확인한다.
10. 효과 발동 조건을 평가한다.

검증 실패 정책:

- 상태는 절대 변경하지 않는다.
- 실패 액션은 기본적으로 `actionLog`에 기록하지 않는다.
- 디버그 모드에서는 `rejectedActionLog`에 별도 기록할 수 있다.
- UI 메시지는 `messageKey`로 반환하고 룰 엔진은 표시 문구를 만들지 않는다.

## 10. 자원 시스템 설계

v0.1은 단일 자원 `energy`를 사용한다. 원작 고유 자원을 복제하지 않고, PvE 밸런싱과 AI 평가가 쉬운 일반 모델을 채택한다.

| 항목 | 규칙 |
|---|---|
| 종류 | 단일 숫자 자원 |
| 증가 | 각 자기 턴 RESOURCE 페이즈에 `max += 1`, cap 10 |
| 회복 | RESOURCE 페이즈에 `current = max + temporary` |
| 카드 비용 | `cost <= current`면 사용 가능, 사용 시 차감 |
| 부족 처리 | 액션 검증 실패 `ERR_INSUFFICIENT_RESOURCE` |
| 임시 자원 | 카드 효과로 그 턴에만 추가, END에 제거 |
| AI 가치 | 남은 자원, 다음 턴 곡선, 손패 비용 분포로 평가 |
| 장기 밸런스 | 낮은 비용 카드는 초반 템포, 높은 비용 카드는 보스전 후반 보상 역할 |

대안:

- 속성별 다중 자원: 덱 빌딩 깊이는 늘지만 v0.1 MVP에는 과하다.
- 카드 희생형 자원: 전략성은 높지만 리플레이/AI 분기가 복잡하다.
- 매턴 고정 자원: 속도는 빠르지만 성장감이 약하다.

## 11. 전투 엔진 설계

전투는 `AttackAction` 하나가 단일 공격을 처리한다. 한 턴에 여러 유닛이 각각 공격할 수 있지만, 각 유닛은 기본적으로 한 번만 공격한다.

1. 공격 액션을 수신한다.
2. `phase === COMBAT`인지 확인한다.
3. 공격자가 전장에 있고 컨트롤러가 액션 플레이어인지 확인한다.
4. 공격자가 `exhausted`, `summonedThisTurn`, `CANNOT_ATTACK`, `STUNNED` 상태가 아닌지 확인한다.
5. 대상이 `UnitRef` 또는 `PlayerRef`인지 파싱한다.
6. 전열/후열 보호 규칙으로 대상이 합법인지 확인한다.
7. `ATTACK_DECLARED` 이벤트를 생성한다.
8. 공격 시 트리거를 수집하고 먼저 해결한다. 단, 대상 변경/공격 취소 효과가 있으면 재검증한다.
9. 공격자 공격력과 방어자 체력/보호막/피해 감소를 지속 효과 레이어로 계산한다.
10. 대상이 유닛이면 공격 피해를 대상에게 적용한다.
11. 반격 규칙이 켜져 있고 대상이 전열 유닛이며 기절 상태가 아니면 방어자 공격력만큼 공격자에게 동시 피해를 적용한다.
12. 대상이 플레이어이면 HP에 피해를 적용한다.
13. `DAMAGE_DEALT` 이벤트를 기록한다.
14. 체력이 0 이하인 유닛을 상태 기반 처리로 파괴한다.
15. 파괴된 유닛을 graveyard로 이동하고 `UNIT_DESTROYED`, `CARD_MOVED` 이벤트를 기록한다.
16. 사망/피해/전투 후 트리거를 수집한다.
17. 트리거를 정렬해 `effectStack`에 넣고 해결한다.
18. 공격자를 `exhausted = true`로 설정한다.
19. 승리 조건을 확인한다.
20. 전투 로그를 `eventLog`와 UI용 요약 로그에 남긴다.

결정 필요: 반격 방식. 추천 기본값은 전열 유닛 간 동시 피해, 후열 유닛은 반격하지 않음이다. 대안은 모든 유닛 동시 피해 또는 반격 없음이다.

## 12. 효과 처리 엔진 설계

### 구조

| 요소 | 역할 |
|---|---|
| EventBus | 액션/상태 변화로 발생한 이벤트를 발행 |
| EventQueue | 이벤트를 순서대로 처리하며 트리거 감지 |
| EffectStack | 해결 대기 효과를 LIFO 또는 우선순위 순서로 관리 |
| Trigger Detection | 이벤트와 카드 ability의 trigger를 매칭 |
| Target Resolution | 발동 시점 또는 해결 시점의 타겟 유효성 검사 |
| Continuous Modifier Layer | 공격력/체력/권한/보호 규칙을 레이어별 재계산 |
| Effect Priority | active player 우선, 그 뒤 비active/시나리오 순 |
| Loop Guard | 같은 원인 연쇄 32회 초과 시 `ERR_EFFECT_LOOP_LIMIT` |
| Snapshot | 효과 해결 전후 state hash와 affected refs 기록 |

### 효과 유형

| 유형 | 해결 방식 |
|---|---|
| 즉발 효과 | stack에 등록 후 해결되면 즉시 폐기 |
| 지속 효과 | `continuousEffects`에 등록, 조건이 거짓이면 제거 |
| 트리거 효과 | 이벤트 감지 후 `pendingTriggers`로 모았다가 정렬 |
| 조건부 효과 | 발동 시와 해결 시 조건을 모두 검사 |
| 턴 종료 지속 | `expiresAt: END_OF_TURN` |
| 전장 지속 | source가 battlefield를 떠나면 만료 |
| 사망 시 | UNIT_DESTROYED 이벤트에서 발동 |
| 공격 시 | ATTACK_DECLARED 이벤트에서 발동 |
| 소환 시 | UNIT_SUMMONED 이벤트에서 발동 |

### 지속 효과 레이어

1. 원본 기본값
2. 영구 수정
3. 장비/부착 효과
4. 전장/행/열 조건부 aura
5. 턴 종료까지 버프/디버프
6. 피해와 보호막
7. 공격 가능/대상 가능 제한

### 동시 발동 처리

1. 같은 이벤트에서 발생한 트리거를 수집한다.
2. active player가 조종하는 트리거를 먼저 원하는 순서로 정렬한다.
3. non-active player 또는 AI 트리거를 정렬한다.
4. PvE 시나리오 트리거는 카드 트리거 뒤에 둔다. 단, `priority: SCENARIO_BEFORE_CARD`가 있으면 앞선다.
5. 정렬 결과를 `pendingTriggers`와 로그에 기록한다.

### 효과 DSL 예시

```json
{
  "id": "sample_on_summon_damage_front",
  "trigger": "ON_SUMMON",
  "condition": {
    "source": "SELF",
    "controller": "EVENT_UNIT_CONTROLLER"
  },
  "target": {
    "selector": "ENEMY_FRONT_UNIT",
    "required": false
  },
  "effect": {
    "type": "DAMAGE",
    "amount": 1
  },
  "timing": {
    "speed": "TRIGGERED",
    "priority": "NORMAL"
  }
}
```

## 13. 이벤트 모델 설계

```ts
interface GameEvent<TPayload = unknown> {
  eventId: string;
  type: GameEventType;
  turnNumber: number;
  phase: Phase;
  source?: EventSourceRef;
  payload: TPayload;
  visibility: 'PUBLIC' | 'OWNER_ONLY' | 'HIDDEN';
  rngCursor?: number;
}

type GameEventType =
  | 'GAME_STARTED'
  | 'TURN_STARTED'
  | 'PHASE_CHANGED'
  | 'CARD_DRAWN'
  | 'CARD_PLAYED'
  | 'UNIT_SUMMONED'
  | 'UNIT_MOVED'
  | 'ATTACK_DECLARED'
  | 'DAMAGE_DEALT'
  | 'UNIT_DESTROYED'
  | 'CARD_MOVED'
  | 'EFFECT_TRIGGERED'
  | 'EFFECT_RESOLVED'
  | 'RESOURCE_CHANGED'
  | 'GAME_ENDED';
```

| 이벤트 | payload 구조 | 발생 시점 | 트리거 연결 | 리플레이 |
|---|---|---|---|---|
| GAME_STARTED | `{players, scenarioId}` | setup 완료 | 시작 효과 | 필수 |
| TURN_STARTED | `{activePlayerId, turnNumber}` | 턴 시작 | 턴 시작 효과 | 필수 |
| PHASE_CHANGED | `{from, to}` | 페이즈 변경 | 페이즈 진입 효과 | 필수 |
| CARD_DRAWN | `{playerId, instanceId?}` | 드로우 | 드로우 반응 | 필수, 비공개 마스킹 |
| CARD_PLAYED | `{playerId, instanceId, targets}` | 카드 사용 | 사용 시 효과 | 필수 |
| UNIT_SUMMONED | `{unitId, slotId}` | 전장 배치 | 소환 시 효과 | 필수 |
| UNIT_MOVED | `{unitId, fromSlot, toSlot}` | 이동 | 이동/행 진입 효과 | 필수 |
| ATTACK_DECLARED | `{attackerId, target}` | 공격 선언 | 공격 시 효과 | 필수 |
| DAMAGE_DEALT | `{source, target, amount}` | 피해 적용 | 피해/피격 효과 | 필수 |
| UNIT_DESTROYED | `{unitId, reason}` | 체력 0 이하 등 | 사망 시 효과 | 필수 |
| CARD_MOVED | `{instanceId, from, to, reason}` | 모든 존 이동 | zone change 효과 | 필수 |
| EFFECT_TRIGGERED | `{effectId, source}` | 트리거 감지 | 메타 트리거는 금지 기본 | 권장 |
| EFFECT_RESOLVED | `{effectId, result}` | 효과 해결 | 해결 후 효과 | 필수 |
| RESOURCE_CHANGED | `{playerId, before, after}` | 자원 변화 | 자원 반응 | 필수 |
| GAME_ENDED | `{winner, reason}` | 종료 | 없음 | 필수 |

## 14. 지속 효과와 상태 효과 설계

```ts
interface StatusEffect {
  statusId: string;
  type:
    | 'CANNOT_ATTACK'
    | 'CANNOT_DEFEND'
    | 'STUNNED'
    | 'SHIELD'
    | 'ATTACK_UP'
    | 'HEALTH_UP'
    | 'TAUNT'
    | 'BACK_ROW_GUARD';
  sourceId?: InstanceId;
  stacks: number;
  expiresAt: Expiration;
  visible: boolean;
}

type Expiration =
  | { type: 'END_OF_TURN'; playerId?: PlayerId }
  | { type: 'START_OF_TURN'; playerId?: PlayerId }
  | { type: 'LEAVES_BATTLEFIELD'; sourceId: InstanceId }
  | { type: 'USES'; remaining: number }
  | { type: 'PERMANENT' };
```

| 상태 | 중첩 | 만료 | 제거 조건 | 표시 |
|---|---|---|---|---|
| 공격 불가 | 가장 강한 제한 1개면 충분 | 지정 만료 | 정화, 만료 | 아이콘 |
| 방어 불가 | 중첩 없음 | 지정 만료 | 정화, 만료 | 아이콘 |
| 기절 | 중첩 시 지속 시간 갱신 | 다음 자기 턴 종료 추천 | 피해/정화 대안 | 강한 아이콘 |
| 보호막 | 스택 수만큼 피해 1회 무효 | 사용 시 감소 | 피해 흡수 | 스택 숫자 |
| 공격력 증가 | 합산 | 효과별 | source 이탈, 만료 | 수치 강조 |
| 체력 증가 | 합산, 최대 체력 변화 | 효과별 | source 이탈, 만료 | 수치 강조 |
| 다음 턴까지 | 중첩 정책 효과별 | START/END | 만료 | 턴 표시 |
| 전장 지속 | source별 | source 이탈 | source 제거 | aura 표시 |
| row 조건부 | 조건 참일 때만 | 조건 거짓 | 이동 | 행 강조 |

중첩 규칙:

- 수치 효과는 기본 합산한다.
- 같은 source의 같은 named modifier는 `stackPolicy`에 따라 `STACK`, `REFRESH`, `HIGHEST_ONLY` 중 하나를 따른다.
- 제한 효과는 하나라도 있으면 제한이 적용된다.
- 허용 효과와 금지 효과가 충돌하면 금지 효과가 우선한다.

## 15. 승리 조건 설계

```ts
type WinCondition =
  | { type: 'OPPONENT_HP_ZERO' }
  | { type: 'DECK_OUT_LOSS' }
  | { type: 'TURN_LIMIT'; maxTurns: number; result: 'WIN' | 'LOSS' | 'DRAW_BY_SCORE' }
  | { type: 'BOSS_DEFEATED'; bossUnitId: InstanceId }
  | { type: 'PUZZLE_OBJECTIVE'; objectiveId: string }
  | { type: 'SURRENDER' }
  | { type: 'INVALID_STATE_ABORT' };
```

| 조건 | 규칙 | PvE 확장 |
|---|---|---|
| 상대 HP 0 이하 | 기본 승리/패배 | 일반 전투 |
| 덱 아웃 | 드로우해야 할 때 덱이 비면 패배 | 장기전 압박 |
| 턴 제한 | 정해진 턴 안에 목표 달성 | 퍼즐/챌린지 |
| 보스 처치 | 지정 boss unit 파괴 | 다중 체력바/페이즈 |
| PvE 특수 목표 | 오브젝트 보호, 특정 슬롯 점령 | 시나리오 DSL |
| 항복 | 플레이어 요청 즉시 패배 | 중도 종료 |
| 비정상 상태 | 불가능 상태 감지 시 ABORTED | 디버그 및 복구 |

일반전은 HP 0, 보스전은 `BOSS_DEFEATED`와 HP 조건 조합, 퍼즐전은 `PUZZLE_OBJECTIVE`를 우선한다. 여러 조건이 동시에 충족되면 시나리오의 `winConditionPriority`를 따른다.

## 16. 결정론적 시뮬레이션과 리플레이 설계

결정론 보장 규칙:

- 모든 난수는 `rngSeed`와 `rngCursor`로만 생성한다.
- 셔플, 무작위 타겟, AI tie-breaker는 난수 호출 순서를 고정한다.
- 클라이언트 시간은 룰 결과에 영향을 주지 않는다.
- `applyAction`은 같은 state와 action에서 항상 같은 next state를 반환한다.
- 카드 데이터 버전, 룰 버전, 시나리오 버전을 리플레이에 저장한다.
- 애니메이션은 `eventLog`를 소비하는 표현 계층이며 룰 처리를 지연시키지 않는다.

```ts
interface ReplayFile {
  replayVersion: 'replay-v0.1';
  gameId: GameId;
  ruleVersion: string;
  cardDataVersion: string;
  scenarioVersion?: string;
  rngSeed: string;
  initialDecks: Record<PlayerId, CardId[]>;
  initialConfig: GameConfig;
  actions: ActionLogEntry[];
  checkpoints: StateSnapshot[];
  finalStateHash: string;
}

interface StateSnapshot {
  afterActionIndex: number;
  turnNumber: number;
  phase: Phase;
  stateHash: string;
  compressedState?: string;
}
```

스냅샷은 매 N개 액션 또는 턴 종료마다 저장한다. 리플레이 재생은 초기 상태에서 액션을 순서대로 다시 적용하고, 체크포인트 hash와 비교한다.

## 17. AI 플레이어를 고려한 룰 설계

```ts
function legalActions(state: GameState, playerId: PlayerId): GameAction[];
function evaluateState(state: GameState, playerId: PlayerId): number;
function simulateAction(state: GameState, action: GameAction): GameState;
```

AI용 상태 노출 원칙:

- 기본 AI는 플레이어가 볼 수 있는 공개 정보와 자신의 손패만 본다.
- 테스트/밸런스 AI는 `omniscient=true` 옵션으로 전체 상태를 볼 수 있다.
- `legalActions`는 룰 검증을 통과하는 액션만 반환한다.
- `simulateAction`은 원본 state를 변경하지 않는다.

휴리스틱 예시:

| 평가 요소 | 방향 |
|---|---|
| 내 HP - 상대 HP | 생존/킬각 |
| 전열 유닛 수 | 방어 안정성 |
| 후열 유닛 수 | 보호받는 공격 자원 |
| 손패 수 | 카드 어드밴티지 |
| 남은 자원 | 같은 턴 추가 행동 가능성 |
| 다음 턴 자원 곡선 | 손패 비용과 매칭 |
| 슬롯 위치 가치 | 같은 열 공격 경로, 인접 aura |
| 보스 목표 진행도 | 보스전 특수 가치 |
| 파괴 예정 위험 | 낮은 체력, 보호막 여부 |

탐색 깊이는 MVP에서 1-ply greedy, 이후 2~3-ply expectimax 또는 MCTS를 고려한다.

## 18. 밸런스 검증 관점

| 변수 | 추천 기본값 | 밸런스 영향도 |
|---|---:|---|
| 시작 HP | 30 | 높음. 평균 턴 수와 버스트 피해 허용치를 결정 |
| 시작 패 수 | 5 | 높음. 초반 선택지와 말림 빈도 결정 |
| 최대 패 수 | 10 | 중간. 드로우 엔진의 상한 |
| 덱 최소/최대 | 30/40 | 높음. 일관성과 덱 아웃 압박 |
| 전열 슬롯 수 | 3 | 높음. 공격 경로와 방어 밀도 |
| 후열 슬롯 수 | 3 | 높음. 보호 가치와 배치 전략 |
| 자원 증가량 | 턴당 +1 | 높음. 비용 곡선의 중심 |
| 자원 cap | 10 | 중간. 후반 카드 설계 상한 |
| 기본 공격 규칙 | 유닛당 턴 1회 | 높음. 전투 속도 |
| 후열 보호 강도 | 같은 열 전열 보호 | 높음. 위치 전략의 핵심 |
| 평균 카드 비용 | 2~4 | 높음. 초중반 템포 |
| 평균 공격력/체력 | 2/3, 3/2 | 높음. 교환 효율 |
| 평균 게임 턴 수 | 8~12 | 높음. PvE 한 판 길이 |
| 덱 아웃 처리 | 드로우 실패 시 패배 | 중간. 장기전 제어 |
| 반격 | 전열 동시 피해 | 높음. 공격 유불리 |

## 19. MVP 구현 우선순위

| 우선순위 | 구현 항목 | 필요한 이유 | 후속 의존성 |
|---|---|---|---|
| 1 | GameState/PlayerState/CardInstance 타입 | 모든 룰 처리의 기반 | 전체 |
| 2 | 카드 DB와 덱 검증 | 게임 시작 가능 | 드로우, 소환 |
| 3 | deterministic RNG와 셔플 | 리플레이 필수 | 시작 절차 |
| 4 | Zone 이동 API | 카드 위치 정합성 | 드로우, 소환, 파괴 |
| 5 | 페이즈 머신 | 행동 가능 시점 제어 | 액션 검증 |
| 6 | 자원 시스템 | 카드 사용 비용 | 카드 플레이 |
| 7 | 전열/후열 BoardState | 핵심 차별화 | 소환, 공격 |
| 8 | SummonUnitAction | 기본 유닛 배치 | 전투 |
| 9 | AttackAction/전투 계산 | 게임 승패 진행 | 피해, 파괴 |
| 10 | 승리 조건 | 게임 종료 | 리플레이 완료 |
| 11 | ActionLog/EventLog | 디버그와 재생 | 리플레이 |
| 12 | Replay runner | 결정론 검증 | AI 테스트 |
| 13 | 기본 AI legal action | PvE 플레이 가능 | 밸런스 |
| 14 | 단순 효과 DSL | 확장 카드 설계 | 트리거/지속 효과 |

MVP 정의: 효과 없는 기본 유닛 카드만으로 게임 시작, 드로우, 유닛 소환, 전열/후열 배치, 공격, 피해 계산, 유닛 파괴, HP 승리 판정, 리플레이 재생이 가능해야 한다.

## 20. 모호한 규칙과 결정 필요사항

| 항목 | 왜 중요한가 | 미정 시 문제 | 추천 기본값 | 대안 |
|---|---|---|---|---|
| 플레이어 HP | 게임 길이 결정 | 카드 피해 기준 부재 | 30 | 20, 40 |
| 덱 매수 | 일관성/덱 아웃 | 밸런스 테스트 불가 | 30 | 40 |
| 시작 패 수 | 초반 선택지 | 말림/폭발력 불명 | 5 | 4 또는 6 |
| 자원 증가 | 비용 곡선 | 카드 비용 설계 불가 | 턴당 max +1, cap 10 | 고정 3, 카드 희생 |
| 전장 슬롯 수 | 배치 전략 | UI/AI 분기 불명 | 3x2 | 4x2, 3x3 |
| 공격 대상 규칙 | 전열/후열 의미 | 보호 규칙 충돌 | 같은 열 전열 우선 | 자유 지정 + 도발 |
| 후열 공격 가능 | 후열 가치 | 후열이 단순 대기열화 | 가능 | 불가, 원거리만 가능 |
| 반격 여부 | 공격 리스크 | 교환 효율 불명 | 전열 동시 피해 | 반격 없음 |
| 카드 타입 | 데이터 모델 | 효과 처리 분기 불명 | UNIT/TACTIC/ONGOING/TOKEN | 장비/지형 추가 |
| 효과 우선권 | 충돌 해결 | 동시 트리거 비결정 | active -> nonactive -> scenario | stack LIFO만 사용 |
| 동시 트리거 | 결정론 | 리플레이 불일치 | 정렬 후 로그 기록 | controller 선택 |
| 덱 아웃 | 장기전 결말 | 무한 게임 | 드로우 실패 패배 | 피로 피해 |
| 보스전 특수 룰 | PvE 다양성 | 시나리오가 엔진 우회 | WinCondition/ScenarioTrigger DSL | 별도 보스 엔진 |
| 소환멀미 | 템포 제어 | 선턴 폭발 | 소환 턴 공격 불가 | Charge 태그 예외 |
| 이동 제한 | 위치 전략 | 무한 이동 최적화 | 유닛당 턴 1회 | 이동 비용 1 |
| 최대 패 | 드로우 밸런스 | 무제한 손패 | 10 | 7, 제한 없음 |

## 21. 최종 산출물

### 21.1 Core Rule Spec v0.1 요약

Core Rule Spec v0.1은 2행 x 3열 전장을 사용하는 PvE 중심 디지털 TCG 룰이다. 각 턴은 `TURN_START -> DRAW -> RESOURCE -> MAIN -> COMBAT -> END` 순서로 진행된다. 플레이어는 자원을 사용해 유닛을 소환하고, 전열/후열 슬롯에 배치하며, 같은 열 우선 공격 규칙으로 상대 유닛 또는 HP를 공격한다. 모든 행동은 `applyAction(state, action)`에서 검증 후 순수 함수에 가깝게 처리된다. 효과는 이벤트 기반으로 감지하고, 지속 효과는 레이어로 재계산한다. 리플레이는 `rngSeed`, `actionLog`, `eventLog`, 버전 정보, 스냅샷 해시로 결정론을 검증한다.

### 21.2 핵심 GameState 타입 초안

```ts
interface GameState {
  gameId: GameId;
  ruleVersion: 'core-rule-v0.1';
  cardDataVersion: string;
  scenarioId?: string;
  turnNumber: number;
  activePlayerId: PlayerId;
  priorityPlayerId: PlayerId | null;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
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

### 21.3 핵심 Action 타입 초안

```ts
type GameAction = {
  actionId: string;
  playerId: PlayerId;
  type: ActionType;
  payload: unknown;
  clientTimestamp?: number;
};

interface AttackPayload {
  attackerId: InstanceId;
  target: { type: 'UNIT'; unitId: InstanceId } | { type: 'PLAYER'; playerId: PlayerId };
}

interface SummonUnitPayload {
  instanceId: InstanceId;
  slotId: SlotId;
}

interface MoveUnitPayload {
  unitId: InstanceId;
  toSlotId: SlotId;
}
```

### 21.4 핵심 Event 타입 초안

```ts
interface GameEvent<TPayload = unknown> {
  eventId: string;
  type: GameEventType;
  turnNumber: number;
  phase: Phase;
  source?: EventSourceRef;
  payload: TPayload;
  visibility: 'PUBLIC' | 'OWNER_ONLY' | 'HIDDEN';
  rngCursor?: number;
}
```

### 21.5 최소 카드 데이터 JSON 예시

```json
{
  "cardId": "unit_basic_vanguard",
  "nameKey": "card.unit_basic_vanguard.name",
  "type": "UNIT",
  "cost": 2,
  "faction": "neutral",
  "attribute": "soldier",
  "baseAttack": 2,
  "baseHealth": 3,
  "rowRestriction": "ANY",
  "tags": ["BASIC_UNIT"],
  "abilities": [],
  "rarity": "COMMON",
  "aiHints": {
    "role": "FRONTLINE",
    "preferredRow": "FRONT"
  }
}
```

### 21.6 최소 전투 처리 순서

1. 공격자와 대상 입력을 받는다.
2. COMBAT 페이즈, 행동권, 공격 가능 상태를 검증한다.
3. 같은 열 전열/후열 보호 규칙을 검증한다.
4. `ATTACK_DECLARED` 이벤트를 기록한다.
5. 공격 전 트리거를 해결한다.
6. 공격력, 피해 감소, 보호막을 계산한다.
7. 대상에게 피해를 적용한다.
8. 가능한 경우 전열 반격 피해를 동시에 적용한다.
9. 체력 0 이하 유닛을 파괴하고 graveyard로 이동한다.
10. 피해/파괴/전투 후 트리거를 해결한다.
11. 공격자를 exhausted 처리한다.
12. 승패를 판정하고 로그를 고정한다.

### 21.7 MVP 구현 체크리스트

- [ ] TypeScript 프로젝트 초기화
- [ ] `GameState`, `PlayerState`, `CardDefinition`, `CardInstance` 타입 작성
- [ ] 카드 DB 로더와 덱 검증 구현
- [ ] seed 기반 RNG와 셔플 구현
- [ ] Zone 이동 API 구현
- [ ] 페이즈 머신 구현
- [ ] 자원 회복/소비 구현
- [ ] 2x3 전장 슬롯 구현
- [ ] 유닛 소환 액션 구현
- [ ] 공격 액션과 피해 계산 구현
- [ ] 파괴/묘지 이동 구현
- [ ] 기본 승리 조건 구현
- [ ] action/event 로그 구현
- [ ] 리플레이 재생 및 state hash 검증 구현
- [ ] 기본 AI의 `legalActions` 구현

### 21.8 다음 단계 설계 과제

1. 효과 DSL 스키마를 JSON Schema 또는 Zod로 구체화한다.
2. `applyAction` 내부의 reducer 모듈 경계를 정의한다.
3. state hash 규칙과 스냅샷 압축 형식을 정한다.
4. 카드 데이터 버전 관리와 밸런스 상수 파일 구조를 정한다.
5. Phaser UI가 소비할 public view model을 설계한다.
6. AI 평가 함수 v0.1의 가중치를 실험용 설정 파일로 분리한다.
7. 보스전 `ScenarioState`와 특수 목표 DSL을 별도 문서로 확장한다.

## 참고한 웹 자료

- Eushully 작품 정보 및 `創刻のアテリアル` 출시 맥락: https://ru.wikipedia.org/wiki/Eushully
- Magic: The Gathering Comprehensive Rules. 페이즈, 존, 스택, 우선권, 지속 효과 구조 참고: https://media.wizards.com/2024/downloads/MagicCompRules%2020241108.pdf
- Hearthstone 장르, 마나 증가형 디지털 CCG 구조 참고: https://en.wikipedia.org/wiki/Hearthstone
- Legends of Runeterra 장르, 라운드/마나/전투 템포 참고: https://en.wikipedia.org/wiki/Legends_of_Runeterra
