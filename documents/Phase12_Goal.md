# Phase 12 목표 지시문 — AI 플레이어 및 시뮬레이션 구현

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 합법 행동 탐색, 상태 평가, 자동 행동 선택, replay runner 기반 시뮬레이션, 밸런스 통계 수집을 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 12를 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

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
- `documents/Phase10_Goal.md`
- `documents/Phase11_Goal.md`
- `AGENTS.md`

## Phase 12의 위치

`documents/Plan.md`에서 Phase 12는 다음 단계다.

- Phase 10: 승리 조건 및 게임 종료 구현
- Phase 11: 저장 / 리플레이 / 결정론 시스템 구현
- Phase 12: AI 플레이어 및 시뮬레이션 구현
- Phase 13: Phaser UI 및 PvE 콘텐츠 구현
- Phase 14: 테스트 / 밸런스 / 배포

따라서 Phase 12는 Phase3~11에서 구현한 순수 룰 엔진, `applyAction`, 승리 조건, replay runner, state hash를 사용해 AI가 룰을 우회하지 않고 행동할 수 있게 만드는 단계다. Phaser 게임 화면, 카드 조작 UI, 실제 PvE 스테이지 데이터, 보스 패턴 연출, 보상 구조, 배포 환경은 이후 Phase로 남긴다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- AI는 기존 룰 엔진 API를 통해서만 행동한다.
- AI는 `GameState`를 직접 mutation하지 않는다.
- `legalActions`는 실제 `applyAction` 검증을 통과할 수 있는 행동만 반환해야 한다.
- `simulateAction`은 원본 state를 변경하지 않고 새 state 또는 실패 결과를 반환해야 한다.
- AI의 tie-breaker는 결정론적이어야 한다. 난수가 필요하면 `rngSeed`/`rngCursor` 기반 확장점만 사용한다.
- 기본 AI는 공개 정보와 자기 정보만 사용한다.
- 테스트/밸런스용 AI는 명시 옵션 `omniscient: true`에서만 전체 상태를 볼 수 있다.
- AI 평가는 표시용 카드 이미지, Phaser UI 상태, DOM, 브라우저 전역 객체에 의존하지 않는다.
- Phase12의 AI는 MVP 1-ply greedy 수준으로 제한한다.
- MCTS, expectimax, 덱 빌딩 AI, 보스 패턴 스크립트 DSL, 강화학습은 범위 밖이다.
- 시뮬레이션은 Phase11 replay/hash 기능을 활용해 결정론 검증 가능해야 한다.
- 모든 상태 변경 함수는 입력 `GameState`를 직접 mutation하지 않는 방식으로 구현한다.

## Phase 12 최종 목표

다음 기능을 구현한다.

- AI 관련 타입 정의
- AI 관점 상태 노출 모델 정의
- 합법 행동 탐색 `legalActions(state, playerId)` 구현
- `SUMMON_UNIT` 후보 생성
- `MOVE_UNIT` 후보 생성
- `ATTACK` 후보 생성
- `END_PHASE`, `END_TURN` 후보 생성
- 필요 시 `SURRENDER` 후보 제외 정책 정의
- 상태 평가 `evaluateState(state, playerId)` 구현
- 휴리스틱 평가 항목과 가중치 정의
- 행동 시뮬레이션 `simulateAction(state, action)` 구현
- 1-ply greedy 행동 선택 `chooseAction` 구현
- 자동 턴 진행 `playAiTurn` 구현
- 자동 게임 시뮬레이션 `simulateGame` 구현
- 반복 시뮬레이션 통계 `runSimulationBatch` 구현
- replay runner와 state hash 기반 결정론 검증 연결
- AI 행동 로그와 평가 디버그 정보 제공
- 밸런스 통계 요약 타입 정의
- Phase13 PvE UI가 호출할 수 있는 AI public API 준비

Phase 12 완료 시점에는 다음이 가능해야 한다.

- 현재 우선권을 가진 AI 플레이어의 합법 행동 목록을 조회할 수 있다.
- `MAIN` 페이즈에서 손패 유닛 소환과 전장 유닛 이동 후보를 생성할 수 있다.
- `COMBAT` 페이즈에서 공격 가능한 유닛의 공격 후보를 생성할 수 있다.
- `END_PHASE`와 `END_TURN` 후보를 필요한 페이즈에서 생성할 수 있다.
- 모든 후보 행동은 `applyAction`으로 검증했을 때 성공하거나, 생성 단계에서 제거된다.
- AI 평가 함수는 HP, 유닛 수, 전열/후열, 손패, 자원, 지배력, 승리/패배 상태를 반영한다.
- `chooseAction`은 같은 state에서 항상 같은 action을 선택한다.
- `simulateAction`은 입력 state를 변경하지 않는다.
- `playAiTurn`은 자동 페이즈와 수동 페이즈를 지나 유효한 action sequence를 만든다.
- `simulateGame`은 두 AI 또는 AI 대 고정 상대를 `GAME_OVER`까지 진행하거나 최대 step에서 중단한다.
- 시뮬레이션 결과는 replay file 또는 action log로 검증 가능하다.
- 같은 seed와 같은 초기 state는 같은 winner, action log hash, event log hash를 만든다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/ai/types.ts` | AI 옵션, 평가 결과, 행동 후보, 시뮬레이션 결과 타입 |
| `src/ai/visibility.ts` | AI 관점 공개 정보 필터링 |
| `src/ai/legal-actions.ts` | phase별 합법 행동 후보 생성 |
| `src/ai/evaluate.ts` | 상태 평가 휴리스틱과 가중치 |
| `src/ai/simulate.ts` | `simulateAction`, 1-step action simulation |
| `src/ai/choose.ts` | `chooseAction`, tie-breaker, greedy 선택 |
| `src/ai/turn.ts` | `playAiTurn`, 자동 턴 진행 |
| `src/ai/batch.ts` | 반복 시뮬레이션과 통계 집계 |
| `src/ai/debug.ts` | 평가 breakdown과 후보 정렬 debug helper |
| `src/ai/index.ts` | Phase12 AI API re-export |
| `src/rules/types.ts` | 필요한 경우 AI 생성 action payload 타입 보강 |
| `src/game/action.ts` | AI가 생성한 action도 기존 검증 경로를 통과하는지 확인, 필요 시 보강 |
| `src/replay/runner.ts` | 시뮬레이션 결과 replay 검증 확장점 필요 시 보강 |
| `tests/ai-visibility.test.ts` | 공개 정보/omniscient 옵션 테스트 |
| `tests/ai-legal-actions.test.ts` | 소환/이동/공격/종료 후보 생성 테스트 |
| `tests/ai-evaluate.test.ts` | 평가 함수 항목과 승패 점수 테스트 |
| `tests/ai-simulate.test.ts` | `simulateAction` 불변성과 성공/실패 테스트 |
| `tests/ai-choose-action.test.ts` | greedy 선택과 deterministic tie-breaker 테스트 |
| `tests/ai-turn.test.ts` | AI 턴 자동 진행 테스트 |
| `tests/ai-batch-simulation.test.ts` | 반복 시뮬레이션 통계와 결정론 테스트 |
| `tests/phase12-integration.test.ts` | replay/hash와 AI 시뮬레이션 통합 테스트 |

기존 Phase3~11 타입 파일은 필요한 경우에만 좁게 보강한다. 특히 Phase12를 위해 Phaser UI, PvE 스테이지 데이터, 보스 패턴 DSL, 덱 빌더, 외부 AI 라이브러리를 앞당겨 만들지 않는다.

## 2. AI Public API

Core Rule Spec의 AI API를 Phase12에서 정규 엔진 API로 만든다.

권장 시그니처:

```ts
export function legalActions(
  state: GameState,
  playerId: PlayerId,
  options?: AiOptions,
): AiActionCandidate[];

export function evaluateState(
  state: GameState,
  playerId: PlayerId,
  options?: AiEvaluationOptions,
): AiEvaluation;

export function simulateAction(
  state: GameState,
  action: GameAction,
  options?: AiSimulationOptions,
): AiSimulationResult;

export function chooseAction(
  state: GameState,
  playerId: PlayerId,
  options?: AiChooseOptions,
): AiDecision;
```

권장 타입:

```ts
export interface AiActionCandidate {
  action: GameAction;
  source: 'RULES' | 'FALLBACK_END_PHASE' | 'FALLBACK_END_TURN';
  score?: number;
  reason?: string;
}

export interface AiEvaluation {
  playerId: PlayerId;
  score: number;
  breakdown: Record<string, number>;
}

export interface AiDecision {
  playerId: PlayerId;
  action: GameAction | null;
  candidates: AiActionCandidate[];
  evaluation: AiEvaluation;
}
```

정책:

- API는 순수 TypeScript 모듈이어야 한다.
- `legalActions`는 후보를 만든 뒤 `applyAction` dry-run 또는 `simulateAction`으로 검증한다.
- `chooseAction`은 후보가 없으면 `null`을 반환하거나 명확한 fallback action을 만든다.
- `GameAction.actionId`는 결정론적 prefix와 후보 index를 사용한다.
- `clientTimestamp`는 AI action에 넣지 않는다.
- 같은 state와 같은 options는 같은 후보 순서와 같은 선택을 만들어야 한다.

## 3. AI 관점 상태 노출

AI는 플레이어가 볼 수 있는 정보만 사용해야 한다.

필수 헬퍼:

- `createAiView(state, playerId, options): AiGameView`
- `maskHiddenInformation(state, playerId): GameState`
- `canAiSeeCard(state, playerId, instanceId): boolean`

정책:

- 기본 AI는 자기 손패, 공개 전장, 공개 묘지, 공개 이벤트만 본다.
- 상대 손패의 카드 ID와 정의는 숨긴다.
- 상대 덱 순서와 덱 내용은 숨긴다.
- `revealedCards`는 공개된 범위만 보여준다.
- `omniscient: true` 옵션은 테스트와 밸런스 시뮬레이션에서만 사용한다.
- 마스킹된 정보가 룰 판정에 쓰이면 안 된다. 룰 검증은 실제 state를 사용하고, 평가는 view를 사용한다.
- Phase12 MVP에서는 손패와 덱 숨김 정책을 타입과 테스트로 고정하되 복잡한 정보 추론 AI는 만들지 않는다.

## 4. 합법 행동 탐색

`legalActions`는 현재 phase와 priority에 따라 후보를 생성한다.

지원할 행동:

| 페이즈 | 후보 |
|---|---|
| `MAIN` | `SUMMON_UNIT`, `MOVE_UNIT`, `END_PHASE` |
| `COMBAT` | `ATTACK`, `END_PHASE` |
| `END` | `END_TURN` |
| `GAME_OVER` | 없음 |

정책:

- `state.priorityPlayerId !== playerId`이면 빈 배열을 반환한다.
- `gameStatus !== 'RUNNING'`이면 빈 배열을 반환한다.
- `SUMMON_UNIT` 후보는 손패의 `UNIT` 카드와 자기 빈 슬롯 조합에서 생성한다.
- 소환 후보는 자원, row restriction, 지배력 한계 검증을 통과해야 한다.
- `MOVE_UNIT` 후보는 전장 자기 유닛과 자기 빈 슬롯 조합에서 생성한다.
- 이동 후보는 row restriction과 턴당 이동 제한을 통과해야 한다.
- `ATTACK` 후보는 현재 공격 가능한 자기 유닛과 공격 가능한 대상 조합에서 생성한다.
- 공격 대상은 Phase7의 같은 열 전열/후열/직접 공격 규칙을 따른다.
- `END_PHASE`, `END_TURN`은 항상 마지막 fallback 후보로 둔다.
- `SURRENDER`는 Phase12 기본 AI 후보에서 제외한다.

필수 헬퍼:

- `generateSummonActions(state, playerId): AiActionCandidate[]`
- `generateMoveActions(state, playerId): AiActionCandidate[]`
- `generateAttackActions(state, playerId): AiActionCandidate[]`
- `generatePhaseActions(state, playerId): AiActionCandidate[]`
- `filterLegalActions(state, candidates): AiActionCandidate[]`

## 5. 상태 평가 휴리스틱

Phase12 평가는 MVP AI가 “명백히 나쁜 행동”을 피하고 전투를 끝낼 수 있게 하는 수준으로 둔다.

권장 평가 항목:

| 항목 | 예시 가중치 | 설명 |
|---|---:|---|
| 승리 상태 | +100000 | 내가 이긴 상태 |
| 패배 상태 | -100000 | 내가 진 상태 |
| 내 HP - 상대 HP | +10 | 생존과 킬각 |
| 내 유닛 수 - 상대 유닛 수 | +80 | 전장 우위 |
| 전열 유닛 수 | +25 | 방어 안정성 |
| 후열 유닛 수 | +15 | 보호받는 전력 |
| 공격력 합계 차이 | +20 | 다음 전투 압박 |
| 남은 체력 합계 차이 | +15 | 교환 내구도 |
| 손패 수 차이 | +8 | 카드 어드밴티지 |
| 자원 여유 | +3 | 추가 행동 가능성 |
| 지배력 boardValue 차이 | +12 | 장악 목표와 효과 조건 |
| 지배력 여유 | +5 | 추가 유닛 배치 가능성 |
| 즉시 종료 가능성 | +5000 | 한 행동 뒤 승리 가능 |

정책:

- 점수는 playerId 관점에서 계산한다.
- 같은 state와 playerId는 항상 같은 score를 만든다.
- 평가 breakdown을 제공해 테스트와 디버그가 가능해야 한다.
- UI 표시 텍스트, 카드 이미지, Phaser 객체는 평가에 쓰지 않는다.
- Phase12에서는 복잡한 카드 효과 기대값, 장기 combo 평가, 상대 손패 추론은 제외한다.

## 6. 행동 시뮬레이션과 선택

AI는 후보 행동을 실제 룰 엔진으로 시뮬레이션한 뒤 가장 좋은 결과를 선택한다.

필수 헬퍼:

- `simulateAction(state, action, options): AiSimulationResult`
- `scoreAction(state, action, playerId, options): AiScoredAction`
- `chooseGreedyAction(state, playerId, options): AiDecision`
- `sortCandidatesByScore(candidates): AiActionCandidate[]`

정책:

- `simulateAction`은 `applyAction`을 호출한다.
- 실패한 action은 선택 후보에서 제외하거나 매우 낮은 점수로 둔다.
- 입력 state는 참조/깊은 동등성 기준으로 변경되지 않아야 한다.
- 기본 탐색 깊이는 1-ply다.
- 후보 점수가 같으면 deterministic tie-breaker를 사용한다.
- tie-breaker 우선순위는 `score desc`, `action.type`, `actionId`, payload stable stringify 오름차순이다.
- Phase12에서는 상대 응답까지 보는 minimax를 구현하지 않는다.

## 7. 자동 턴 진행

`playAiTurn`은 현재 AI가 우선권을 가진 동안 행동을 선택해 적용한다.

필수 헬퍼:

- `playAiStep(state, playerId, options): AiStepResult`
- `playAiTurn(state, playerId, options): AiTurnResult`
- `advanceAiControlledGame(state, options): AiGameSimulationResult`

정책:

- 한 step은 하나의 action을 선택하고 적용한다.
- `MAIN`과 `COMBAT`에서는 후보가 있으면 greedy action을 선택한다.
- 더 유리한 행동이 없거나 후보가 fallback뿐이면 phase를 넘긴다.
- `END`에서는 `END_TURN`을 선택한다.
- action 수가 `maxActionsPerTurn`을 넘으면 실패 또는 중단 결과를 반환한다.
- 게임이 `GAME_OVER`가 되면 즉시 중단한다.
- 자동 페이즈 진행은 기존 `advanceToFirstPlayablePhase` 또는 동등한 룰 엔진 경로를 사용한다.

## 8. 게임 시뮬레이션과 밸런스 통계

Phase12는 PvE 밸런스 검증의 기초가 되는 반복 시뮬레이션을 제공한다.

필수 헬퍼:

- `simulateGame(initialState, options): AiGameSimulationResult`
- `runSimulationBatch(initialStates, options): AiBatchSimulationResult`
- `summarizeSimulationResults(results): AiSimulationSummary`

권장 결과:

```ts
export interface AiGameSimulationResult {
  ok: boolean;
  finalState: GameState;
  actions: GameAction[];
  winner: PlayerId | null;
  turnCount: number;
  actionCount: number;
  replayFile?: ReplayFile;
  errors: string[];
}

export interface AiSimulationSummary {
  games: number;
  completedGames: number;
  winsByPlayer: Record<PlayerId, number>;
  draws: number;
  averageTurns: number;
  averageActions: number;
}
```

정책:

- 기본 시뮬레이션은 같은 초기 state와 같은 옵션에서 같은 결과를 반환한다.
- `maxTurns`, `maxActions`, `maxGames` 안전장치를 둔다.
- 시뮬레이션 결과는 replay file 또는 action log hash로 검증 가능해야 한다.
- 통계는 카드 밸런스 판단을 돕는 수치만 제공한다.
- Phase12에서는 그래프, 대시보드, UI 표시를 만들지 않는다.

## 9. Replay/Hash 연동

Phase11의 replay/hash 시스템은 Phase12 시뮬레이션 검증에 사용한다.

정책:

- AI가 선택한 action은 일반 action log에 기록된다.
- 시뮬레이션 종료 후 replay file을 만들 수 있어야 한다.
- replay runner로 재생한 최종 state hash가 원본 시뮬레이션 결과와 같아야 한다.
- AI option은 replay file에 직접 저장하지 않되, 필요하면 외부 metadata로 분리한다.
- AI 선택 과정의 debug 정보는 replay 입력이 아니라 분석용 output이다.
- action log만으로 같은 결과가 재현되어야 한다.

테스트 요구:

- AI가 만든 action log로 replay file을 만들 수 있다.
- replay runner가 AI 시뮬레이션 결과를 재현한다.
- 같은 seed와 같은 AI 옵션은 같은 action log hash를 만든다.
- 후보 평가 debug 정보가 달라도 replay hash는 바뀌지 않는다.

## 10. 결정론과 난수 정책

AI는 결정론을 깨뜨리면 안 된다.

정책:

- 기본 AI는 난수를 사용하지 않는다.
- 동점 후보는 stable sort로 해결한다.
- 난수 tie-breaker가 필요하면 `rngSeed`/`rngCursor` 기반 helper를 별도 Phase에서 도입한다.
- `Math.random()`, `Date.now()`, `new Date()`는 AI/rules/replay 계층에서 직접 사용하지 않는다.
- actionId는 현재 시간이나 random 값이 아니라 deterministic counter/prefix를 사용한다.
- batch simulation은 실행 순서가 결과를 바꾸지 않아야 한다.

## 11. 디버그와 분석 정보

AI는 테스트와 밸런스 조정을 위해 판단 근거를 제공해야 한다.

필수 헬퍼:

- `explainEvaluation(state, playerId): AiEvaluation`
- `explainCandidate(state, action, playerId): AiScoredAction`
- `formatAiDebugSummary(decision): string`

정책:

- debug summary는 테스트나 로그용 문자열이며 룰 판정에 쓰지 않는다.
- 평가 breakdown에는 항목별 점수가 포함되어야 한다.
- 후보별 score와 action type을 확인할 수 있어야 한다.
- debug 문자열은 한국어 문서와 달리 코드 값은 영어 식별자를 사용한다.
- Phase12에서는 UI 패널이나 시각화는 만들지 않는다.

## 12. 테스트 요구사항

Phase12 테스트는 최소한 다음을 검증한다.

- 기본 AI view는 상대 손패와 덱 정보를 숨긴다.
- `omniscient: true` 옵션은 전체 상태를 볼 수 있다.
- 우선권이 없는 player의 `legalActions`는 빈 배열을 반환한다.
- `MAIN` 페이즈에서 소환 가능한 손패 유닛과 빈 슬롯 후보가 생성된다.
- 자원 부족, 지배력 부족, row restriction 위반 후보는 제외된다.
- `MAIN` 페이즈에서 이동 가능한 유닛과 빈 슬롯 후보가 생성된다.
- 이미 이동한 유닛의 이동 후보는 제외된다.
- `COMBAT` 페이즈에서 공격 가능한 유닛의 합법 대상 후보가 생성된다.
- 보호된 후열과 막힌 직접 공격 후보는 제외된다.
- `END_PHASE`, `END_TURN` fallback 후보가 올바른 페이즈에서 생성된다.
- 생성된 모든 후보는 `applyAction` 검증을 통과한다.
- `evaluateState`는 승리 상태를 큰 양수, 패배 상태를 큰 음수로 평가한다.
- HP, 유닛 수, 지배력 우위가 평가 점수에 반영된다.
- `simulateAction`은 입력 state를 변경하지 않는다.
- 실패 action simulation은 실패 결과와 오류를 반환한다.
- `chooseAction`은 같은 state에서 같은 action을 선택한다.
- 동점 후보 정렬은 deterministic하다.
- AI는 lethal attack이 있으면 phase 종료보다 공격을 선택한다.
- `playAiTurn`은 최대 action 제한 안에서 턴을 진행한다.
- `simulateGame`은 `GAME_OVER` 또는 max step 중단 결과를 반환한다.
- 같은 초기 state와 seed로 두 번 시뮬레이션하면 같은 action log hash가 나온다.
- replay runner가 AI 시뮬레이션 action log를 재생해 같은 final state hash를 만든다.
- 룰 엔진 영역이 Phaser, DOM, 브라우저 전역 객체, 카드 렌더러를 import하지 않는다.
- 코드와 카드 데이터에 원작 보호 대상 텍스트가 추가되지 않는다.

## 13. 완료 검증 명령

Phase12 완료 전 다음 명령을 모두 통과시킨다.

```bash
npm run build
npm run lint
npm run format:check
npm test
```

추가 감사 명령:

```bash
rg -n "from ['\"]\\.\\.?/.*/(scenes|ui|assets/cards)|from ['\"]phaser|document\\.|window\\." src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai
rg -n "Math\\.random\\(|Date\\.now\\(|new Date\\(" src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai
rg -n "창각|創刻|アテリアル" src tests card-data generated
```

첫 번째 명령은 룰 엔진 계층의 UI/Phaser/DOM/카드 렌더러 의존성이 없어야 한다. 두 번째 명령은 AI와 시뮬레이션이 현재 시간이나 전역 난수에 직접 의존하지 않는지 확인한다. 세 번째 명령은 문서 외 코드, 카드 데이터, 생성물에 원작 보호 대상 텍스트가 들어가지 않았는지 확인하기 위한 감사다.

## 14. Phase12 완료 후 남겨야 할 경계

Phase12가 끝나도 다음은 아직 미완성으로 남겨야 한다.

- Phaser 기반 실제 게임 화면
- 카드 조작 UI와 전장 UI
- AI 행동 애니메이션과 사고 시간 연출
- PvE 스테이지 데이터와 보스 패턴
- 보상 구조와 진행도 저장
- 시나리오 DSL의 복잡한 조건 분기
- 덱 빌더와 카드 획득 시스템
- 고급 AI 탐색, MCTS, expectimax, 강화학습
- 시뮬레이션 결과 대시보드
- 네트워크, PvP, 매치메이킹, 랭킹
- 배포, Docker, Nginx 구성

이 경계를 넘는 구현은 Phase13 이후 문서에서 다룬다.
