# Phase 11 목표 지시문 — 저장 / 리플레이 / 결정론 시스템 구현

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 리플레이 파일 포맷, 상태 해시, 액션 재생기, 저장/로드 직렬화, 결정론 검증을 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 11을 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

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
- `AGENTS.md`

## Phase 11의 위치

`documents/Plan.md`에서 Phase 11은 다음 단계다.

- Phase 9: 카드 Asset Pipeline 및 카드 렌더러 구축
- Phase 10: 승리 조건 및 게임 종료 구현
- Phase 11: 저장 / 리플레이 / 결정론 시스템 구현
- Phase 12: AI 플레이어 및 시뮬레이션 구현
- Phase 13 이후: Phaser UI, PvE 콘텐츠, 테스트/밸런스/배포 구현

따라서 Phase 11은 Phase3~10의 순수 룰 엔진이 만든 `GameState`, `actionLog`, `eventLog`, `rngSeed`, `rngCursor`, `GAME_ENDED` 결과를 저장 가능하고 재생 가능한 산출물로 고정하는 단계다. AI 행동 탐색, 밸런스 시뮬레이션, Phaser 리플레이 화면, 저장 슬롯 UI, 클라우드 저장, 네트워크 동기화는 이후 Phase로 남긴다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- 룰 엔진은 Phaser, DOM, 브라우저 전역 객체, 네트워크 API에 의존하지 않는다.
- 리플레이 재생은 `applyAction(state, action)`과 기존 룰 엔진 API만 사용한다.
- 리플레이 재생기는 룰 검증을 우회하거나 `GameState`를 임의로 patch하지 않는다.
- 저장/리플레이 포맷은 JSON 직렬화 가능한 데이터만 포함한다.
- 해시는 보안 목적이 아니라 결정론 검증 목적이다. 암호학적 무결성, 서명, 안티치트는 범위 밖이다.
- 상태 해시는 현재 시간, 객체 삽입 순서, 런타임 환경, 브라우저/Node 차이에 의존하지 않아야 한다.
- `clientTimestamp`처럼 재생 결과에 영향을 주지 않는 입력은 해시 대상에서 제외하거나 명시적으로 정규화한다.
- `actionLog`는 수락된 액션 순서의 정규 입력이다.
- `eventLog`는 재생 결과 검증과 UI 연출의 정규 출력이다.
- `rngSeed`, `rngCursor`, 카드 데이터 버전, 룰 버전은 리플레이 검증에 반드시 포함한다.
- Phase11은 파일 시스템 저장 어댑터를 최소 수준으로 둘 수 있지만, 룰 엔진 계층이 Node 전용 API에 직접 의존하지 않도록 분리한다.
- 모든 상태 변경 함수는 입력 `GameState`를 직접 mutation하지 않는 방식으로 구현한다.

## Phase 11 최종 목표

다음 기능을 구현한다.

- `ReplayFile` 포맷 확정
- `SaveFile` 포맷 정의
- 안정적인 JSON 직렬화 함수
- 결정론적 `GameState` 정규화 함수
- 상태 해시 계산
- 액션 로그에 `stateHashBefore`, `stateHashAfter` 기록
- 이벤트 로그 저장과 검증
- 리플레이 체크포인트 생성
- 초기 상태 또는 초기 설정 기반 리플레이 생성
- 리플레이 파일 빌드 함수
- 리플레이 파일 검증 함수
- 리플레이 재생기
- 체크포인트 해시 비교
- 최종 상태 해시 비교
- 저장 파일 serialize/deserialize
- 저장 파일 버전과 마이그레이션 확장점
- 결정론 감사 테스트
- Phase12 AI 시뮬레이션이 재사용할 replay runner 확장점

Phase 11 완료 시점에는 다음이 가능해야 한다.

- 현재 `GameState`에서 저장 가능한 JSON save file을 만들 수 있다.
- save file을 다시 읽어 동일한 `GameState`를 복원할 수 있다.
- 같은 `GameState`는 같은 state hash를 만든다.
- 객체 key 순서가 달라도 같은 논리 상태는 같은 state hash를 만든다.
- 재생에 영향을 주지 않는 `clientTimestamp` 차이는 state hash를 바꾸지 않는다.
- 종료된 게임의 `actionLog`와 초기 상태에서 리플레이 파일을 만들 수 있다.
- 리플레이 파일을 재생하면 원본 최종 상태 hash와 같은 hash가 나온다.
- 재생 중 action 결과가 달라지면 명확한 검증 실패를 반환한다.
- 체크포인트 hash가 맞지 않으면 어떤 action index에서 실패했는지 알 수 있다.
- `GAME_ENDED` 이벤트가 리플레이 결과에서도 동일하게 재현된다.
- `rngSeed`와 `rngCursor` 불일치를 감지할 수 있다.
- 룰 엔진 영역은 UI/Phaser/DOM/카드 렌더러에 의존하지 않는다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/replay/types.ts` | `ReplayFile`, `SaveFile`, `ReplayResult`, `ReplayValidationError`, snapshot 타입 확정 |
| `src/replay/hash.ts` | 안정 직렬화와 상태 해시 계산 |
| `src/replay/normalize.ts` | 해시 대상 `GameState`, `GameAction`, `GameEvent` 정규화 |
| `src/replay/snapshot.ts` | 체크포인트 생성, snapshot 검증 |
| `src/replay/file.ts` | replay/save 파일 생성과 런타임 검증 |
| `src/replay/runner.ts` | 초기 상태와 액션 로그 기반 리플레이 재생 |
| `src/replay/save.ts` | `serializeSaveFile`, `deserializeSaveFile`, 저장 버전 처리 |
| `src/replay/log.ts` | action log hash 기록 보강 |
| `src/replay/index.ts` | Phase11 Replay API re-export |
| `src/game/action.ts` | action 처리 전후 state hash 기록 연결 |
| `src/game/types.ts` | 필요한 경우 replay-friendly `GameConfig` 필드 보강 |
| `src/core/version.ts` | replay/save version 상수 필요 시 추가 |
| `tests/replay-hash.test.ts` | stable stringify, state hash 결정론 테스트 |
| `tests/replay-file.test.ts` | replay/save 파일 생성과 검증 테스트 |
| `tests/replay-runner.test.ts` | action log 재생과 최종 hash 검증 테스트 |
| `tests/replay-checkpoint.test.ts` | checkpoint hash 비교와 실패 위치 테스트 |
| `tests/save-file.test.ts` | save serialize/deserialize round-trip 테스트 |
| `tests/replay-determinism.test.ts` | 같은 seed/action에서 같은 event log/hash 검증 테스트 |

기존 Phase3~10 타입 파일은 필요한 경우에만 좁게 보강한다. 특히 Phase11을 위해 AI 행동 생성, Phaser 리플레이 UI, 저장 슬롯 화면, 외부 DB 연동을 앞당겨 만들지 않는다.

## 2. Replay File 포맷

Core Rule Spec의 초안 타입을 Phase11에서 정규 포맷으로 확정한다.

권장 타입:

```ts
export interface ReplayFile {
  replayVersion: 'replay-v0.1';
  gameId: GameId;
  ruleVersion: string;
  cardDataVersion: string;
  scenarioId?: string;
  scenarioVersion?: string;
  rngSeed: string;
  initialDecks: Record<PlayerId, CardId[]>;
  initialConfig: GameConfig;
  initialStateHash: string;
  actions: ActionLogEntry[];
  checkpoints: StateSnapshot[];
  finalStateHash: string;
  finalEventLogHash: string;
  result: ReplayGameResult;
}

export interface ReplayGameResult {
  winner: PlayerId | null;
  gameStatus: GameStatus;
  turnNumber: number;
  phase: Phase;
}
```

정책:

- `replayVersion`은 포맷 변경 시 증가시킨다.
- `ruleVersion`, `cardDataVersion`, `scenarioVersion`은 재생 호환성 확인에 사용한다.
- `initialDecks`는 카드 ID 기준 덱 원본이다.
- `initialConfig`는 초기 상태 재구성에 필요한 설정이다.
- 현재 엔진에 완전한 setup 재구성기가 없으면 MVP에서는 `initialState` 또는 `initialStateSnapshot` 확장 필드를 둘 수 있다.
- 단, `initialState` 저장은 Phase11 MVP 편의를 위한 fallback이며 장기 정규 포맷은 `initialConfig + initialDecks + rngSeed` 기반 재구성이다.
- `actions`에는 정상 수락된 액션을 순서대로 저장한다.
- 종료 후 거부된 액션은 `actions`에 포함하지 않는다.
- `checkpoints`는 매 N개 액션 또는 턴 종료마다 생성한다.
- `finalStateHash`는 리플레이 재생 결과 검증의 최종 기준이다.
- `finalEventLogHash`는 이벤트 순서와 payload 결정론 검증에 사용한다.

## 3. Save File 포맷

Save file은 이어하기를 위한 현재 상태 저장이다. Replay file은 재생을 위한 입력/검증 파일이다.

권장 타입:

```ts
export interface SaveFile {
  saveVersion: 'save-v0.1';
  savedAtPolicy: 'OMITTED_FOR_DETERMINISM' | 'EXTERNAL_METADATA_ONLY';
  gameId: GameId;
  ruleVersion: string;
  cardDataVersion: string;
  scenarioId?: string;
  stateHash: string;
  state: GameState;
  actionLogHash: string;
  eventLogHash: string;
}
```

정책:

- 룰 결과에 영향을 주는 save file에는 현재 시각을 기록하지 않는다.
- 파일 표시용 저장 시각이 필요하면 룰 파일 밖 metadata로 분리한다.
- `state`는 JSON round-trip 후에도 타입 의미가 보존되어야 한다.
- 함수, class instance, Map, Set, Date 객체를 저장하지 않는다.
- 저장된 state의 `stateHash`와 로드 후 계산한 hash가 같아야 한다.
- `saveVersion`이 맞지 않으면 명확한 오류로 거부한다.
- 마이그레이션은 확장점만 두고 Phase11 MVP에서는 같은 버전 로드만 지원한다.

## 4. 안정 직렬화와 상태 해시

상태 해시는 재생 결과가 같은지 판단하는 결정론 검증 도구다.

필수 헬퍼:

- `stableStringify(value): string`
- `normalizeGameStateForHash(state): unknown`
- `normalizeActionForReplay(action): unknown`
- `normalizeEventForReplay(event): unknown`
- `hashString(input): string`
- `hashGameState(state): string`
- `hashActionLog(entries): string`
- `hashEventLog(events): string`

정규화 정책:

- 객체 key는 문자열 오름차순으로 정렬한다.
- 배열 순서는 보존한다.
- `undefined` 값은 직렬화에서 제거하거나 `null`로 통일한다. 한 정책을 테스트로 고정한다.
- `clientTimestamp`는 replay/hash 대상에서 제외한다.
- `eventId`는 이벤트 순서에서 파생되므로 포함하되, 생성 정책이 결정론적인지 테스트한다.
- `rngSeed`, `rngCursor`는 반드시 포함한다.
- `cardDefinitions`는 hash에 포함하되, 카드 데이터 버전만으로 충분한 경로를 별도로 검토할 수 있다.
- `eventQueue`, `effectStack`, `pendingTriggers`는 진행 중 저장에서는 포함한다.
- 종료된 리플레이 최종 hash에서는 `eventQueue`, `effectStack`, `pendingTriggers`가 비어 있어야 한다.
- 렌더링 전용 에셋 manifest, WebP hash, Phaser UI 상태는 포함하지 않는다.

해시 정책:

- Phase11 hash는 보안용이 아니므로 간단한 deterministic hash를 사용할 수 있다.
- 새 외부 의존성은 가능하면 추가하지 않는다.
- Node 전용 `crypto`에 직접 의존하면 브라우저 빌드와 충돌할 수 있으므로 주의한다.
- 같은 입력에서 같은 문자열 hash가 나오면 충분하다.
- hash 알고리즘 이름과 버전을 `hashVersion` 또는 문서 주석으로 남긴다.

## 5. Action Log 보강

현재 `ActionLogEntry`는 action, index, accepted를 기록한다. Phase11에서는 state hash를 기록해 재생 검증에 사용한다.

권장 타입:

```ts
export interface ActionLogEntry {
  index: number;
  action: GameAction;
  accepted: boolean;
  stateHashBefore: string;
  stateHashAfter: string;
}
```

정책:

- 정상 수락된 액션은 `stateHashBefore`와 `stateHashAfter`를 가진다.
- Phase11 이후 정상 액션 로그에서 hash 누락은 검증 실패로 처리한다.
- 거부된 액션은 리플레이 입력에서 제외하는 것을 기본 정책으로 한다.
- 디버그용 거부 액션 기록이 필요하면 별도 `RejectedActionLogEntry`로 분리한다.
- `index`는 0부터 시작하고 action log 배열 순서와 같아야 한다.
- action의 `clientTimestamp`는 저장할 수 있지만 replay hash에는 반영하지 않는다.

## 6. Event Log 저장과 검증

`eventLog`는 리플레이의 출력 검증과 UI 연출 재생의 근거다.

필수 헬퍼:

- `hashEventLog(events): string`
- `compareEventLogs(expected, actual): ReplayValidationError[]`
- `assertEventLogDeterministic(replay, actualState): ValidationResult`

정책:

- 리플레이 입력은 action log이고, event log는 검증 대상이다.
- 재생 중 생성된 event log가 저장된 event log와 다르면 replay 검증 실패다.
- 이벤트 비교는 type, turnNumber, phase, source, payload, visibility, rngCursor를 확인한다.
- `eventId`를 비교할지 여부는 생성 정책을 기준으로 결정한다. Phase11 권장값은 비교한다.
- `GAME_ENDED` 이벤트는 최종 이벤트로 재현되어야 한다.
- 이벤트 visibility는 저장하되, UI에서 숨김 처리하는 것은 Phase13 범위다.

## 7. 체크포인트와 스냅샷

긴 리플레이 검증과 디버깅을 위해 checkpoint를 둔다.

권장 타입:

```ts
export interface StateSnapshot {
  afterActionIndex: number;
  turnNumber: number;
  phase: Phase;
  stateHash: string;
  compressedState?: string;
}
```

정책:

- `afterActionIndex`는 해당 action 적용 후 상태를 의미한다.
- 초기 상태 checkpoint는 `afterActionIndex = -1`을 사용할 수 있다.
- 매 N개 액션 또는 `TURN_ENDED`/`GAME_ENDED` 이후 checkpoint를 만든다.
- Phase11 MVP는 `compressedState`를 비워둘 수 있다.
- 압축을 도입하더라도 룰 엔진이 압축 라이브러리에 직접 묶이지 않도록 분리한다.
- checkpoint mismatch는 expected hash, actual hash, action index를 반환한다.

필수 헬퍼:

- `createStateSnapshot(state, afterActionIndex): StateSnapshot`
- `createReplayCheckpoints(initialState, actions, interval): StateSnapshot[]`
- `verifyCheckpoint(state, snapshot): ReplayValidationError | null`

## 8. 리플레이 생성

종료된 게임 또는 진행 중 게임에서 replay file을 생성한다.

필수 헬퍼:

- `createReplayFile(initialState, finalState, options): ReplayFile`
- `createReplayFileFromState(finalState, options): ReplayFile`
- `validateReplayFile(input): ReplayFile`
- `isReplayFile(input): boolean`

정책:

- 종료된 게임은 `GAME_ENDED` 이벤트와 `finalStateHash`를 포함해야 한다.
- 진행 중 게임도 디버그 replay로 저장할 수 있지만 `result.gameStatus`가 `RUNNING`임을 명시한다.
- `initialStateHash`는 재생 시작 상태 검증에 사용한다.
- `initialDecks`, `initialConfig`, `rngSeed`가 없으면 명확한 검증 오류를 반환한다.
- 현재 엔진에서 초기 설정 재구성이 부족한 경우, MVP는 `initialState` fallback을 허용한다.
- fallback을 쓰는 경우에도 action replay는 반드시 `applyAction`을 통해 진행한다.

## 9. 리플레이 재생기

리플레이 재생기는 Phase12 AI 시뮬레이션에서도 재사용할 수 있는 순수 API여야 한다.

필수 헬퍼:

- `replayActions(initialState, actions, options): ReplayRunResult`
- `runReplay(replayFile, options): ReplayRunResult`
- `applyReplayAction(state, entry): ReplayStepResult`
- `verifyReplayResult(replayFile, finalState): ReplayValidationResult`

권장 타입:

```ts
export interface ReplayRunResult {
  ok: boolean;
  initialStateHash: string;
  finalState: GameState;
  finalStateHash: string;
  finalEventLogHash: string;
  steps: ReplayStepResult[];
  errors: ReplayValidationError[];
}

export interface ReplayStepResult {
  actionIndex: number;
  actionId: string;
  ok: boolean;
  stateHashBefore: string;
  stateHashAfter: string;
  eventLogHashAfter: string;
}
```

정책:

- 재생기는 action log 순서대로 `applyAction`을 호출한다.
- 저장된 action이 현재 state에서 실패하면 replay 실패다.
- action 결과의 `stateHashBefore`가 저장값과 다르면 replay 실패다.
- action 결과의 `stateHashAfter`가 저장값과 다르면 replay 실패다.
- 체크포인트가 있으면 해당 index에서 hash를 비교한다.
- 최종 hash와 final event log hash가 replay file과 같아야 성공이다.
- 재생기는 입력 replay file을 mutation하지 않는다.

## 10. 결정론 검증 범위

Phase11에서 결정론을 검증해야 하는 핵심 영역은 다음이다.

| 영역 | 검증 방식 |
|---|---|
| 셔플/RNG | 같은 `rngSeed`, 같은 덱 리스트에서 같은 초기 순서 |
| 액션 처리 | 같은 state/action에서 같은 next state hash |
| 이벤트 처리 | 같은 state/action에서 같은 event log hash |
| 효과 큐 | 같은 이벤트 순서에서 같은 trigger/effect 해결 순서 |
| 승리 조건 | 같은 종료 조건에서 같은 `GAME_ENDED` payload |
| 지배력 | 같은 전장에서 같은 `used`, `boardValue`, `overloaded` |
| 저장/로드 | save round-trip 후 같은 state hash |

정책:

- 랜덤 호출은 `rngCursor`로 추적되어야 한다.
- `Math.random()` 직접 사용은 금지한다.
- 현재 시간, 객체 주소, Map/Set iteration 순서에 의존하지 않는다.
- 테스트 fixture는 같은 입력을 두 번 실행해 hash가 같은지 검증한다.
- 의도적으로 다른 seed나 action을 넣으면 hash가 달라져야 한다.

## 11. 저장 시스템 경계

Phase11의 Save System은 룰 상태를 안전하게 직렬화/복원하는 계층이다.

Phase11에서 해야 할 일:

- `GameState`를 JSON 문자열로 저장할 수 있게 한다.
- JSON 문자열을 검증해 `SaveFile`로 복원한다.
- 복원된 state hash를 저장된 `stateHash`와 비교한다.
- 저장 버전이 다르면 명확히 실패한다.
- 저장 파일에 룰 결정론과 무관한 UI 상태를 넣지 않는다.

Phase11에서 하지 않을 일:

- 브라우저 `localStorage` UI
- 파일 선택/다운로드 UI
- 서버 저장 API
- 클라우드 동기화
- 자동 저장 슬롯 관리 화면
- 저장 파일 암호화
- 저장 파일 압축

파일 시스템 저장이 필요하면 Node script 또는 외부 adapter에서 처리하고, `src/core`, `src/game`, `src/rules`, `src/replay`의 순수 API가 Node 전용 모듈을 직접 import하지 않게 한다.

## 12. 런타임 검증과 오류 모델

리플레이와 저장 파일은 외부 입력이 될 수 있으므로 런타임 검증이 필요하다.

필수 오류 코드 후보:

- `ERR_REPLAY_VERSION_UNSUPPORTED`
- `ERR_SAVE_VERSION_UNSUPPORTED`
- `ERR_REPLAY_FILE_INVALID`
- `ERR_SAVE_FILE_INVALID`
- `ERR_REPLAY_HASH_MISMATCH`
- `ERR_REPLAY_ACTION_FAILED`
- `ERR_REPLAY_CHECKPOINT_MISMATCH`
- `ERR_REPLAY_EVENT_LOG_MISMATCH`
- `ERR_SAVE_HASH_MISMATCH`

정책:

- 검증 실패는 throw보다 결과 타입 반환을 우선한다.
- 치명적 개발 오류만 throw한다.
- 오류에는 action index, expected hash, actual hash, reason을 포함한다.
- JSON parse 실패와 schema 검증 실패를 구분한다.
- unknown input을 TypeScript type assertion만으로 통과시키지 않는다.

## 13. 테스트 요구사항

Phase11 테스트는 최소한 다음을 검증한다.

- `stableStringify`가 객체 key 순서와 무관하게 같은 문자열을 만든다.
- 같은 `GameState`는 같은 `stateHash`를 만든다.
- 논리적으로 같은 state의 객체 key 순서 차이는 hash를 바꾸지 않는다.
- state에 영향을 주지 않는 `clientTimestamp` 차이는 action replay hash를 바꾸지 않는다.
- HP, 지배력, phase, event log가 달라지면 state hash가 달라진다.
- `createActionLogEntry` 또는 액션 처리 결과가 전후 state hash를 기록한다.
- save file을 serialize/deserialize하면 같은 state hash가 나온다.
- 잘못된 save version은 거부된다.
- replay file을 생성하면 `initialStateHash`, `finalStateHash`, `finalEventLogHash`가 포함된다.
- replay file action index가 순서와 맞지 않으면 검증 실패한다.
- replay runner가 정상 action log를 끝까지 재생한다.
- replay runner 최종 state hash가 저장된 hash와 같으면 성공한다.
- replay runner가 변경된 action payload를 감지해 hash mismatch를 반환한다.
- checkpoint mismatch는 action index와 expected/actual hash를 포함한다.
- `GAME_ENDED` 이벤트가 replay 결과에서 동일하게 재현된다.
- 같은 `rngSeed`와 같은 action log는 같은 event log hash를 만든다.
- 다른 `rngSeed` 또는 다른 action log는 필요한 경우 다른 hash를 만든다.
- 룰 엔진 영역이 Phaser, DOM, 브라우저 전역 객체, 카드 렌더러를 import하지 않는다.
- 코드와 카드 데이터에 원작 보호 대상 텍스트가 추가되지 않는다.

## 14. 완료 검증 명령

Phase11 완료 전 다음 명령을 모두 통과시킨다.

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

첫 번째 명령은 룰 엔진 계층의 UI/Phaser/DOM/카드 렌더러 의존성이 없어야 한다. 두 번째 명령은 결정론 로직이 현재 시간이나 전역 난수에 직접 의존하지 않는지 확인한다. 세 번째 명령은 문서 외 코드, 카드 데이터, 생성물에 원작 보호 대상 텍스트가 들어가지 않았는지 확인하기 위한 감사다.

## 15. Phase11 완료 후 남겨야 할 경계

Phase11이 끝나도 다음은 아직 미완성으로 남겨야 한다.

- AI 행동 탐색과 평가 함수
- 자동 플레이와 밸런스 시뮬레이션
- Phaser 기반 리플레이 감상 UI
- 저장 슬롯 화면과 파일 선택 UI
- PvE 스테이지 데이터, 보스 패턴, 보상 구조
- 복잡한 시나리오 DSL과 목표 연출
- 클라우드 저장, 서버 저장, 계정 동기화
- 네트워크, PvP, 매치메이킹, 랭킹
- 저장 파일 암호화, 서명, 안티치트
- 배포, Docker, Nginx 구성

이 경계를 넘는 구현은 Phase12 이후 문서에서 다룬다.
