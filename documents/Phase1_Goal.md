# Core Rule Spec v0.1 심층분석 지시문

너는 TCG 게임 엔진 아키텍트이자 룰 시스템 설계자다.

아래 문서를 기반으로 「창각의 아테리얼(創刻のアテリアル / Soukoku no Arterial) 스타일」의 디지털 TCG 게임 엔진을 위한
Core Rule Spec v0.1을 심층 분석하고 설계하라.

## 분석 대상 문서

- 「창각의 아테리얼 TCG 룰 기반 게임 엔진 구성 문서.md」

## 중요 전제

- 원작의 실제 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 복제하지 않는다.
- 원작에서 알려진 전략형 TCG 구조를 일반화하여 독자적인 엔진 규칙으로 재구성한다.
- PvP는 제외하고 PvE 중심 구조로 설계한다.
- Node.js + TypeScript 기반 구현을 전제로 한다.
- Phaser는 클라이언트 표현 계층으로 보고, 핵심 룰 엔진은 UI와 분리한다.
- 카드 효과는 데이터 기반으로 처리하며, 룰 변경 시 엔진 수정 없이 카드 데이터/효과 정의만으로 확장 가능해야 한다.
- 결정론적 시뮬레이션을 지원하여 리플레이, AI 테스트, 밸런스 검증에 활용할 수 있어야 한다.

## 문서에서 반드시 반영해야 할 핵심 요소

- 턴 기반 게임 루프
- 유닛 소환
- 전열/후열 배치
- 자원 소비
- 전투 처리
- 지속 효과
- 트리거 효과
- 승리 조건 판정
- 카드 데이터 시스템
- 덱 구성 시스템
- 전장 관리
- 효과 처리 엔진
- 전투 계산 엔진
- 상태 저장 기능
- 리플레이 기능
- AI 플레이어 확장 가능성
- 이벤트 기반 효과 처리
- 데이터 중심 카드 설계
- 전열/후열 전장 구조

## 분석 목표

Core Rule Spec을 단순 요약하지 말고, 실제 엔진 구현의 기준 문서로 사용할 수 있도록 다음을 명확히 정의하라.

- 무엇을 상태로 들고 있어야 하는가
- 어떤 행동이 가능한가
- 행동은 어떤 검증을 거치는가
- 상태는 어떤 순서로 변하는가
- 효과와 전투는 어떻게 충돌 없이 해결되는가

---

# 출력 형식

# Core Rule Spec v0.1 심층분석

## 1. 설계 목표와 범위

- 이 Core Rule Spec이 해결해야 하는 문제를 정의하라.
- 포함 범위와 제외 범위를 구분하라.
- PvE 중심 구조가 룰 설계에 주는 영향을 분석하라.
- UI, 서버, 데이터, 룰 엔진의 책임을 분리하라.

## 2. 핵심 게임 루프 정의

다음 항목을 포함하여 턴 기반 루프를 설계하라.

- 게임 시작 절차
- 초기 덱/패/자원/전장 세팅
- 선공/후공 결정 방식
- 턴 시작 처리
- 드로우 처리
- 메인 페이즈
- 전투 페이즈
- 종료 페이즈
- 턴 교대
- 게임 종료 판정

각 페이즈마다 다음을 표로 정리하라.

- 가능한 행동
- 금지되는 행동
- 자동으로 발생하는 처리
- 트리거 이벤트
- 상태 갱신 순서

## 3. GameState 모델 설계

TypeScript 구현을 전제로 GameState의 최소 필드를 설계하라.

반드시 포함할 것:

- gameId
- turnNumber
- activePlayerId
- priorityPlayerId 또는 action권한자
- phase
- players
- board
- zones
- eventQueue 또는 effectStack
- continuousEffects
- pendingTriggers
- actionLog
- rngSeed
- winner
- gameStatus

각 필드에 대해 다음을 분석하라.

- 존재 이유
- 변경되는 시점
- 저장/리플레이에 필요한지 여부
- UI 표현에 필요한지 여부

가능하면 TypeScript 타입 예시를 작성하라.

## 4. PlayerState 설계

플레이어가 가져야 하는 상태를 정의하라.

포함 후보:

- playerId
- life 또는 hp
- deck
- hand
- graveyard
- banished/exile
- resource
- maxResource
- flags
- oncePerTurn 기록
- revealedCards
- aiMetadata

각 항목의 목적과 룰 영향도를 설명하라.

## 5. 카드 데이터 모델 설계

데이터 중심 카드 설계를 기준으로 카드 정의와 카드 인스턴스를 구분하라.

반드시 구분할 것:

- CardDefinition: 카드 원본 데이터
- CardInstance: 게임 중 생성된 개별 카드 객체

CardDefinition에 포함할 후보:

- cardId
- nameKey
- type
- cost
- faction/attribute
- baseAttack
- baseHealth
- rowRestriction
- tags
- abilities
- effectScript
- rarity
- aiHints

CardInstance에 포함할 후보:

- instanceId
- ownerId
- controllerId
- currentZone
- currentAttack
- currentHealth
- damage
- statusEffects
- exhausted
- summonedThisTurn
- temporaryModifiers
- attachedEffects

카드 원본 데이터와 인스턴스 상태를 분리해야 하는 이유를 설명하라.

## 6. Zone 시스템 설계

카드가 존재할 수 있는 모든 영역을 정의하라.

예시:

- deck
- hand
- battlefield
- graveyard
- banished
- stack/effect resolving area
- revealed
- temporary

각 Zone에 대해 다음을 정의하라.

- 공개/비공개 여부
- 순서 보존 여부
- 소유자 필요 여부
- 리플레이 기록 필요 여부
- 이동 시 발생 이벤트

## 7. 전장 구조: 전열/후열 설계

창각의 아테리얼 스타일을 일반화하여 전열/후열 기반 전장을 설계하라.

반드시 분석할 것:

- 전열 슬롯 수
- 후열 슬롯 수
- 슬롯 좌표 모델
- 유닛 배치 조건
- 전열/후열의 전투 차이
- 공격 가능 대상
- 후열 보호 규칙
- 이동 가능 여부
- 빈 슬롯 처리
- 같은 열/인접 슬롯 참조 가능성

전장 구조는 TypeScript 타입 또는 JSON 예시로 표현하라.

## 8. Action 모델 설계

플레이어가 선택 가능한 행동을 명시적으로 정의하라.

예시:

- PlayCardAction
- SummonUnitAction
- ActivateEffectAction
- AttackAction
- MoveUnitAction
- EndPhaseAction
- EndTurnAction
- MulliganAction
- SelectTargetAction

각 Action에 대해 다음을 정의하라.

- 필요한 입력값
- 실행 가능 조건
- 실패 조건
- 발생 이벤트
- 상태 변경 결과
- 로그 기록 방식

모든 액션은 다음 구조를 따르게 설계하라.

~~~ts
type GameAction = {
  actionId: string;
  playerId: PlayerId;
  type: ActionType;
  payload: unknown;
  clientTimestamp?: number;
};
~~~

그리고 실제 처리는 반드시 다음 형태의 순수 함수에 가깝게 설계하라.

~~~ts
function applyAction(state: GameState, action: GameAction): GameState
~~~

## 9. Rule Validation 설계

행동 실행 전 검증해야 하는 룰 체크를 체계화하라.

반드시 포함:

- 현재 phase가 맞는가
- 행동 권한이 있는 플레이어인가
- 카드가 올바른 zone에 있는가
- 비용을 지불할 수 있는가
- 대상이 유효한가
- 슬롯이 비어 있는가
- 공격 가능한 상태인가
- once per turn 제한을 위반하지 않는가
- 효과 발동 조건을 만족하는가

검증 실패 시 다음을 정의하라.

- 에러 코드
- 사용자 메시지
- 로그 기록 여부
- 상태 불변성

## 10. 자원 시스템 설계

자원 소비 구조를 설계하라.

분석할 것:

- 자원의 종류
- 매 턴 증가 여부
- 회복 타이밍
- 카드 비용과의 관계
- 자원 부족 시 처리
- AI 평가 함수에서 자원의 가치
- 장기 밸런스에 미치는 영향

원작 고유 시스템을 복제하지 말고, 독자적이고 일반화된 자원 모델로 제안하라.

## 11. 전투 엔진 설계

전투 계산 절차를 상세히 정의하라.

반드시 포함:

- 공격 선언
- 공격 대상 선택
- 공격 가능 여부 검증
- 전열/후열 대상 규칙
- 선제/반격/동시 피해 여부
- 피해 계산
- 방어력 또는 체력 감소 처리
- 파괴 판정
- 사망/묘지 이동 이벤트
- 전투 후 트리거
- 전투 로그 생성

전투 처리 순서를 numbered step으로 작성하라.

## 12. 효과 처리 엔진 설계

이벤트 기반 효과 처리 구조를 설계하라.

효과 유형:

- 즉발 효과
- 지속 효과
- 트리거 효과
- 조건부 효과
- 턴 종료까지 지속되는 효과
- 전장에 있는 동안 지속되는 효과
- 사망 시 발동 효과
- 공격 시 발동 효과
- 소환 시 발동 효과

반드시 분석할 것:

- EventBus
- EffectStack 또는 EventQueue
- Trigger Detection
- Target Resolution
- Continuous Modifier Layer
- Effect Priority
- 동시 발동 처리 순서
- 무한 루프 방지
- 효과 취소/무효화 가능성
- 효과 처리 중 상태 스냅샷 필요성

간단한 효과 DSL 예시를 작성하라.

예시 형식:

~~~json
{
  "trigger": "ON_SUMMON",
  "condition": {
    "self": "this"
  },
  "effect": {
    "type": "DAMAGE",
    "target": "ENEMY_FRONT_UNIT",
    "amount": 1
  }
}
~~~

## 13. 이벤트 모델 설계

룰 엔진에서 발생하는 이벤트 목록을 정의하라.

예시:

- GAME_STARTED
- TURN_STARTED
- PHASE_CHANGED
- CARD_DRAWN
- CARD_PLAYED
- UNIT_SUMMONED
- UNIT_MOVED
- ATTACK_DECLARED
- DAMAGE_DEALT
- UNIT_DESTROYED
- CARD_MOVED
- EFFECT_TRIGGERED
- EFFECT_RESOLVED
- RESOURCE_CHANGED
- GAME_ENDED

각 이벤트에 대해 다음을 정의하라.

- payload 구조
- 발생 시점
- 트리거 효과와의 연결
- 리플레이 로그 필요 여부

## 14. 지속 효과와 상태 효과 설계

상태 효과 시스템을 설계하라.

예시:

- 공격 불가
- 방어 불가
- 기절
- 보호막
- 공격력 증가
- 체력 증가
- 다음 턴까지 지속
- 전장에 있는 동안 지속
- 특정 row에 있을 때만 지속

중첩 규칙, 만료 타이밍, 제거 조건, 표시 방식까지 분석하라.

## 15. 승리 조건 설계

승리/패배 조건을 정의하라.

검토할 후보:

- 상대 HP 0 이하
- 덱 아웃
- 특정 턴 제한
- 보스 처치
- PvE 특수 목표
- 항복
- 비정상 상태 처리

PvE 중심 구조에서 일반 전투, 보스전, 퍼즐전의 승리 조건 확장성을 함께 분석하라.

## 16. 결정론적 시뮬레이션과 리플레이 설계

리플레이와 AI 학습을 위해 결정론을 보장하는 방법을 설계하라.

반드시 포함:

- rngSeed
- Action Log
- Event Log
- State Snapshot
- 버전 정보
- 카드 데이터 버전
- 룰 버전
- 랜덤 처리 순서 고정
- 클라이언트 애니메이션과 룰 처리 분리

리플레이 저장 포맷 예시를 작성하라.

## 17. AI 플레이어를 고려한 룰 설계

AI가 행동을 평가할 수 있도록 상태와 행동을 어떻게 노출해야 하는지 분석하라.

포함할 것:

- legalActions(state, playerId)
- evaluateState(state, playerId)
- simulateAction(state, action)
- search depth
- 휴리스틱 평가 요소
- 자원 가치
- 전장 위치 가치
- 카드 어드밴티지
- 생존 가치
- 보스전 특수 목표 가치

## 18. 밸런스 검증 관점

Core Rule Spec 단계에서 미리 정의해야 할 밸런스 변수들을 정리하라.

예시:

- 시작 HP
- 시작 패 수
- 최대 패 수
- 덱 최소/최대 매수
- 전열/후열 슬롯 수
- 자원 증가량
- 기본 공격 규칙
- 후열 보호 강도
- 평균 카드 비용
- 평균 공격력/체력
- 게임 평균 턴 수

각 변수에 대해 “밸런스 영향도”를 분석하라.

## 19. MVP 구현 우선순위

가장 먼저 구현해야 할 최소 규칙 세트를 제안하라.

목표:

효과 없는 기본 유닛 카드만으로도 다음이 가능한 수준을 MVP로 정의하라.

- 게임 시작
- 카드 드로우
- 유닛 소환
- 전열/후열 배치
- 공격
- 피해 계산
- 유닛 파괴
- 승리 판정
- 리플레이 재생

우선순위는 다음 형식으로 작성하라.

| 우선순위 | 구현 항목 | 필요한 이유 | 후속 의존성 |
|---|---|---|---|

## 20. 모호한 규칙과 결정 필요사항

현재 문서에서 아직 정의되지 않은 부분을 모두 찾아라.

예시:

- 플레이어 HP 수치
- 덱 매수
- 시작 패 수
- 자원 증가 방식
- 전장 슬롯 수
- 공격 대상 규칙
- 후열 공격 가능 여부
- 반격 여부
- 카드 타입 구분
- 효과 발동 우선권
- 동시 트리거 처리
- 덱 아웃 처리
- 보스전 특수 룰

각 항목에 대해 다음을 제시하라.

- 왜 중요한가
- 정하지 않으면 어떤 문제가 생기는가
- 추천 기본값
- 대안

## 21. 최종 산출물

마지막에 다음 결과물을 반드시 포함하라.

1. Core Rule Spec v0.1 요약
2. 핵심 GameState 타입 초안
3. 핵심 Action 타입 초안
4. 핵심 Event 타입 초안
5. 최소 카드 데이터 JSON 예시
6. 최소 전투 처리 순서
7. MVP 구현 체크리스트
8. 다음 단계 설계 과제

## 작성 방식

- 설명은 한국어로 작성한다.
- 추상적인 조언보다 실제 구현 가능한 규칙과 타입을 우선한다.
- TypeScript 타입 예시를 적극적으로 포함한다.
- 표를 활용해 비교와 우선순위를 명확히 한다.
- 원작 데이터 복제는 피하고, 독자적 엔진 규칙으로 일반화한다.
- 애매한 부분은 반드시 “결정 필요”로 표시하고 추천 기본값을 제안한다.
