# Phase 13 목표 지시문 — Phaser UI 및 PvE 콘텐츠 구현

너는 Node.js + TypeScript + Vite + Phaser 기반 디지털 TCG 게임 엔진의 플레이 가능한 MVP 화면, 카드 조작 UI, 전장 UI, PvE 스테이지, 보스전 표시와 AI 턴 연결을 구현하는 클라이언트 개발자다.

아래 문서를 기준으로 Phase 13을 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

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
- `documents/Phase12_Goal.md`
- `AGENTS.md`

## Phase 13의 위치

`documents/Plan.md`에서 Phase 13은 다음 단계다.

- Phase 11: 저장 / 리플레이 / 결정론 시스템 구현
- Phase 12: AI 플레이어 및 시뮬레이션 구현
- Phase 13: Phaser UI 및 PvE 콘텐츠 구현
- Phase 14: 테스트 / 밸런스 / 배포

따라서 Phase 13은 Phase3~12에서 구현한 순수 룰 엔진, 카드 에셋 manifest, 승리 조건, 리플레이/hash, AI public API를 실제 플레이 화면에 연결해 “브라우저에서 한 판을 시작하고 끝낼 수 있는 Playable MVP”를 만드는 단계다. Phase13은 표현 계층과 최소 PvE 콘텐츠를 구현하지만, 룰 엔진을 Phaser에 종속시키지 않는다. 대규모 밸런스 검증, 성능 최적화, Docker/Nginx 배포, 고급 덱 빌더, 장기 진행도/보상 시스템은 Phase14 이후로 남긴다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- Phaser는 표현 계층이다. 룰 상태 변경은 반드시 `applyAction`, phase 진행 API, AI API 등 기존 룰 엔진 public API를 통해서만 일어난다.
- `src/core`, `src/rules`, `src/cards`, `src/zones`, `src/board`, `src/dominance`, `src/battle`, `src/events`, `src/effects`, `src/replay`, `src/ai`는 `src/scenes`나 `src/ui`를 import하지 않는다.
- UI는 `GameState`, `CardDefinition`, `CardInstance`, `eventLog`, `actionLog`, Phase9 card asset manifest를 읽어 표시한다.
- 카드 이미지는 표시용이다. 비용, 지배력, 공격력, 체력, 승패 판정은 항상 룰 상태의 정규 데이터에서 읽는다.
- Phase9의 카드 base asset과 runtime number overlay metadata를 사용해 Phaser `BitmapText` 또는 동등한 고정 좌표 텍스트를 표시한다.
- Phase12 AI는 동일 룰 엔진 위에서 행동해야 하며, UI는 AI 턴을 임의로 state patch하지 않는다.
- 애니메이션은 `eventLog`를 소비하는 표현 계층이며, 룰 결과를 지연하거나 변경하지 않는다.
- UI 입력은 명확한 선택 상태를 거쳐 `GameAction`으로 변환되어야 한다.
- `clientTimestamp`처럼 결정론에 불필요한 값은 action에 넣지 않는다.
- Phase13 MVP는 로컬 브라우저 단일 플레이를 대상으로 하며, PvP, 네트워크 동기화, 계정, 저장 슬롯 UI, 클라우드 저장은 범위 밖이다.
- 테스트 가능한 UI view model과 pure helper를 우선 만들고, Phaser 객체 직접 검증은 최소 smoke 수준으로 둔다.

## Phase 13 최종 목표

다음 기능을 구현한다.

- Vite 진입점에서 Phaser 게임 부트스트랩
- Phaser 장면 구조 정의
- 최소 PvE 스테이지 데이터 정의
- 플레이어 기본 덱과 AI 기본 덱 생성
- 플레이어와 AI의 초기 게임 생성 흐름 연결
- 화면 레이아웃 좌표계와 responsive scale 정의
- 카드 에셋 manifest 로딩과 카드 sprite 표시
- Phase9 runtime number overlay 슬롯 기반 숫자 표시
- 손패 UI 구현
- 전열/후열 2행 x 3열 전장 UI 구현
- 플레이어/상대 HP, 자원, 지배력, 페이즈, 턴 표시
- 카드 선택, 소환 슬롯 선택, 이동 슬롯 선택, 공격 대상 선택 입력 구현
- `END_PHASE`, `END_TURN`, 항복 또는 재시작 버튼 구현
- 합법 행동 후보 하이라이트
- 불법 입력 방지와 검증 오류 표시
- AI 턴 자동 진행 연결
- event log 기반 기본 전투/소환/이동/파괴/게임 종료 연출
- 보스전 MVP 표시와 `BOSS_DEFEATED` 목표 연결
- 게임 종료 화면 구현
- replay/debug용 action log와 event log 요약 패널 구현
- Phaser UI가 룰 엔진 계층을 오염시키지 않는 import boundary 유지

Phase 13 완료 시점에는 다음이 가능해야 한다.

- `npm run dev -- --host 127.0.0.1`로 브라우저에서 게임 화면이 열린다.
- 플레이어가 카드 손패를 보고 유닛 카드를 자기 전열/후열 빈 슬롯에 소환할 수 있다.
- 플레이어가 자기 유닛을 합법적인 빈 슬롯으로 이동할 수 있다.
- 플레이어가 전투 페이즈에서 합법적인 공격 대상만 선택할 수 있다.
- 후열 보호와 직접 공격 차단 규칙이 UI 선택 하이라이트와 실제 `applyAction` 결과 모두에서 일치한다.
- 플레이어가 페이즈를 넘기고 턴을 종료할 수 있다.
- AI 턴이 Phase12 AI API로 자동 진행된다.
- 카드의 코스트, 지배력, 공격력, 체력/HP 표시는 룰 상태 변화에 따라 갱신된다.
- 기본 PvE 일반전은 승리 또는 패배로 끝난다.
- 보스전 MVP는 보스 유닛과 보스 목표를 표시하고, 보스 처치 시 종료 화면을 보여준다.
- 게임 종료 후 추가 액션 입력은 막힌다.
- action log와 event log가 UI에서 확인 가능하며, replay/hash 시스템과 충돌하지 않는다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/main.ts` | Vite 진입점에서 Phaser 앱 부트스트랩 |
| `src/style.css` | Phaser canvas와 보조 HTML shell 스타일 |
| `src/scenes/boot-scene.ts` | 에셋/manifest preload와 초기 부트 장면 |
| `src/scenes/game-scene.ts` | 실제 PvE 게임 화면, 입력, 렌더링 orchestration |
| `src/scenes/result-scene.ts` | 승리/패배/중단 결과 화면 |
| `src/scenes/index.ts` | Phase13 scene API re-export |
| `src/ui/types.ts` | UI view model, 선택 상태, 렌더링 command 타입 |
| `src/ui/view-model.ts` | `GameState`를 화면 표시 모델로 변환 |
| `src/ui/input.ts` | 포인터/버튼 입력을 후보 `GameAction`으로 변환 |
| `src/ui/layout.ts` | 화면 좌표, 카드/슬롯/패널 위치, responsive scale 정의 |
| `src/ui/card-sprite.ts` | 카드 base image와 runtime number overlay 표시 helper |
| `src/ui/board-view.ts` | 전장 슬롯과 유닛 표시 helper |
| `src/ui/hand-view.ts` | 손패 표시 helper |
| `src/ui/status-view.ts` | HP, 자원, 지배력, 페이즈, 턴 표시 helper |
| `src/ui/log-view.ts` | action/event log 요약 표시 helper |
| `src/ui/index.ts` | Phase13 UI API re-export |
| `src/game/pve.ts` | 최소 PvE game config와 초기 state 생성 helper |
| `src/game/pve-decks.ts` | 플레이어/AI starter deck 목록과 deck 생성 helper |
| `src/game/scenario.ts` | MVP 시나리오/보스 목표 데이터 타입과 로더 |
| `src/assets/cards/runtime.ts` | Phaser UI용 카드 runtime 숫자 값 매핑 |
| `tests/ui-view-model.test.ts` | `GameState` -> UI view model 변환 테스트 |
| `tests/ui-input-actions.test.ts` | 선택 상태와 합법 행동 후보에서 action 생성 테스트 |
| `tests/ui-runtime-card.test.ts` | runtime 숫자 overlay 값 매핑 테스트 |
| `tests/pve-scenario.test.ts` | 일반전/보스전 초기 state와 목표 테스트 |
| `tests/phase13-import-boundary.test.ts` | 룰 엔진 계층이 UI/Phaser를 import하지 않는지 검증 |
| `tests/phase13-smoke.test.ts` | Phaser 부트 구성과 MVP view model smoke test |

기존 Phase3~12 타입 파일은 필요한 경우에만 좁게 보강한다. 특히 Phase13을 위해 룰 엔진 내부에 Phaser 객체, DOM 객체, 브라우저 전역 객체를 넣지 않는다.

## 2. Phaser 장면 구조

Phase13 MVP는 다음 장면 구조를 권장한다.

| 장면 | 책임 |
|---|---|
| `BootScene` | 카드 base asset, 카드 뒷면, manifest, bitmap font 또는 fallback font preload |
| `GameScene` | 현재 `GameState` 표시, 플레이어 입력, AI 턴 실행, 이벤트 연출, 로그 표시 |
| `ResultScene` | 승리/패배/무승부/중단 결과, 재시작 진입 |

정책:

- `BootScene`은 룰 상태를 생성하지 않고 에셋 준비만 담당한다.
- `GameScene`은 `GameState`를 보유할 수 있지만 상태 변경은 룰 엔진 API 결과로만 교체한다.
- Phaser `GameObject`는 UI 계층 내부에만 머무른다.
- 장면 간 전달 데이터는 JSON 직렬화 가능한 최소 정보로 둔다.
- 개발 중 에셋이 없으면 Phase9 placeholder 또는 카드 뒷면을 사용한다.
- 에셋 preload 실패는 화면 전체 중단 대신 명확한 fallback 표시로 처리한다.

## 3. UI View Model

UI는 `GameState`를 직접 복잡하게 순회하지 않고, 화면 전용 view model을 통해 렌더링한다.

권장 타입:

```ts
export interface GameViewModel {
  activePlayerId: PlayerId;
  priorityPlayerId: PlayerId | null;
  phase: Phase;
  turnNumber: number;
  players: PlayerPanelViewModel[];
  hand: CardViewModel[];
  boardSlots: BoardSlotViewModel[];
  selected: UiSelection | null;
  legalTargets: UiTargetViewModel[];
  actionLogItems: LogItemViewModel[];
  eventLogItems: LogItemViewModel[];
  result: GameResultViewModel | null;
}
```

정책:

- View model은 순수 함수로 생성한다.
- View model 생성은 Phaser, DOM, canvas에 의존하지 않는다.
- 표시 문자열이 없으면 `nameKey`, `cardId`, event type 기반 fallback을 사용한다.
- 손패는 기본적으로 플레이어 자기 손패만 앞면으로 표시하고, 상대 손패는 카드 뒷면과 장수만 표시한다.
- 보드 위 공개 유닛은 양측 모두 카드 앞면과 현재 수치를 표시한다.
- 지배력은 `used / limit + temporaryLimit`, `boardValue`, `overloaded`를 구분해 표시한다.
- `GAME_OVER` 상태에서는 `result`가 반드시 채워져야 한다.

## 4. 카드 UI와 Runtime Number Overlay

Phase9 산출물의 정적 카드 base image는 표시 배경이고, 변화 가능한 숫자는 Phase13에서 올린다.

동적 숫자 원천:

| 표시값 | UI 원천 |
|---|---|
| 비용 | 손패 카드의 `CardDefinition.cost`와 이후 비용 modifier 확장점 |
| 지배력 비용 | `CardDefinition.dominanceCost` |
| 지배력 제공값 | `CardDefinition.dominanceValue` |
| 지배력 요구값 | `CardDefinition.dominanceRequirement` |
| 공격력 | `CardInstance.currentAttack` 또는 modifier 계산 helper |
| 체력/HP | `CardInstance.currentHealth - damage` 또는 modifier 계산 helper |

정책:

- 숫자 overlay는 카드 base 이미지의 좌표계를 기준으로 scale 변환한다.
- 숫자 slot이 manifest에 없으면 안전한 fallback 좌표를 사용하거나 해당 숫자를 숨긴다.
- 룰 값이 없는 필드는 `0`으로 오해하게 표시하지 않고 숨기거나 `null` 표시 정책을 따른다.
- 카드 조작 중 hover/selection 상태는 카드 크기와 레이아웃을 밀어내지 않는다.
- 카드 텍스트는 화면 영역 밖으로 넘치지 않아야 한다.
- UI는 원작 카드 프레임, 아이콘, 색상 조합, 문구를 복제하지 않는다.

## 5. 전장 UI

전장은 각 플레이어 2행 x 3열 구조를 명확히 보여준다.

필수 표시:

- 플레이어 전열 3칸
- 플레이어 후열 3칸
- 상대 전열 3칸
- 상대 후열 3칸
- 같은 열 관계
- 빈 슬롯
- 소환/이동 가능한 슬롯 하이라이트
- 공격 가능한 대상 하이라이트
- 후열 보호 또는 직접 공격 차단 상태

정책:

- 슬롯 좌표는 `SlotId`와 1:1로 매핑된다.
- 슬롯 클릭은 현재 선택 상태와 `legalActions` 후보를 기준으로만 action을 만든다.
- 불법 슬롯은 클릭해도 상태를 바꾸지 않고, 필요하면 검증 메시지만 표시한다.
- 전열/후열 라벨은 간결하게 표시하되, 룰 설명문을 화면에 장황하게 넣지 않는다.
- 보스 유닛은 보드 위 유닛으로 표시하고, 추가 보스 HP/목표 패널은 `ScenarioState`에서 읽는다.

## 6. 입력과 Action 변환

UI 입력은 다음 상태 흐름을 따른다.

```text
IDLE
-> HAND_CARD_SELECTED
-> SUMMON_SLOT_SELECTED
-> ACTION_SUBMITTED
-> IDLE

IDLE
-> BOARD_UNIT_SELECTED
-> MOVE_SLOT_SELECTED or ATTACK_TARGET_SELECTED
-> ACTION_SUBMITTED
-> IDLE
```

정책:

- `MAIN` 페이즈 손패 유닛 선택은 `SUMMON_UNIT` 후보를 보여준다.
- `MAIN` 페이즈 보드 유닛 선택은 `MOVE_UNIT` 후보를 보여준다.
- `COMBAT` 페이즈 보드 유닛 선택은 `ATTACK` 후보를 보여준다.
- `END_PHASE`와 `END_TURN`은 명시 버튼으로 제출한다.
- UI가 직접 룰 검증을 재구현하지 않고, `legalActions`와 `applyAction` 결과를 기준으로 처리한다.
- `applyAction` 실패는 UI 오류 메시지로 표시하고 state를 교체하지 않는다.
- 모든 제출 action은 deterministic `actionId` 정책을 따라야 한다.
- 플레이어 입력이 아닌 AI action은 Phase12 API의 action을 그대로 사용한다.

## 7. AI 턴 연결

Phase13 UI는 Phase12 AI public API를 사용해 상대 턴을 진행한다.

정책:

- AI 턴 시작 조건은 `priorityPlayerId`의 `PlayerState.kind === 'AI'` 또는 PvE controller 설정으로 판단한다.
- AI는 `playAiTurn` 또는 `playAiStep`을 통해 action sequence를 만든다.
- AI action마다 `eventLog` delta를 읽어 UI 연출을 큐에 넣을 수 있다.
- AI 사고 시간 연출은 표시 지연일 뿐이며, 룰 결과를 바꾸면 안 된다.
- AI가 action limit에 도달하거나 실패하면 명확한 오류 패널과 action/event log를 보여준다.
- Phase13은 고급 AI 난이도, MCTS, 보스 패턴 DSL을 구현하지 않는다.

## 8. PvE 스테이지와 보스전 MVP

Phase13은 실제 플레이 가능한 최소 PvE 콘텐츠를 포함한다.

필수 콘텐츠:

- 일반전 스테이지 1개
- 보스전 스테이지 1개
- 플레이어 기본 덱 1개
- AI 기본 덱 1개
- 카드 정의에서 `CardInstance`를 생성해 deck/hand/board 초기 상태로 넣는 helper
- deck builder가 아닌 고정 starter deck 선택 흐름
- 보스 유닛 또는 보스 목표 1개
- 승리/패배 결과 화면

정책:

- 스테이지 데이터는 독자 명칭과 독자 카드 데이터만 사용한다.
- Phase13의 덱 생성은 MVP용 starter deck 구성과 초기 상태 생성에 한정한다.
- 스테이지 설정은 `GameConfig`, `ScenarioState`, `WinCondition`으로 변환 가능해야 한다.
- 보스전은 Phase10의 `BOSS_DEFEATED` 또는 HP 기반 종료 조건을 사용한다.
- 보스 특수 패턴은 Phase13 MVP에서 복잡한 DSL로 만들지 않는다. 필요하면 AI 덱/초기 보드/승리 조건만으로 표현한다.
- deck builder, 보상, 진행도 저장, 스테이지 선택 맵, 카드 획득은 범위 밖이다.

## 9. 이벤트 연출과 로그

UI 연출은 `eventLog`를 기준으로 한다.

필수 표시:

- 카드 이동
- 유닛 소환
- 유닛 이동
- 공격 선언
- 피해
- 파괴
- 페이즈 전환
- 턴 시작/종료
- 게임 종료

정책:

- 연출은 event type과 payload를 읽어 표시한다.
- 연출이 끝나지 않았더라도 룰 상태는 이미 확정된 상태로 유지한다.
- 같은 `eventLog` delta는 같은 순서로 표시된다.
- 로그 패널은 디버그용이며 replay 입력이 아니다.
- 긴 로그는 최신 N개만 화면에 표시해도 되지만, `GameState.eventLog` 자체를 잘라내지 않는다.

## 10. 저장/리플레이 연동 경계

Phase13은 Phase11 기능을 UI에서 확인할 수 있는 최소 연결만 둔다.

정책:

- 현재 게임의 action log hash, event log hash, turn, phase를 debug panel에 표시할 수 있다.
- replay file export/import UI는 Phase13 필수가 아니다.
- 저장 슬롯 UI, 파일 다운로드, 클라우드 저장은 Phase14 이후로 남긴다.
- UI용 선택 상태, hover 상태, 애니메이션 큐는 replay hash에 포함하지 않는다.
- 리플레이 재생 전용 scene은 Phase13 선택 사항이며, 필수 범위는 아니다.

## 11. 테스트 요구사항

Phase13 테스트는 최소한 다음을 검증한다.

- `GameState`를 `GameViewModel`로 변환할 수 있다.
- View model은 active player, phase, turn, HP, 자원, 지배력 정보를 포함한다.
- 손패 카드와 보드 카드가 구분되어 표시 모델에 들어간다.
- 상대 손패는 기본 UI에서 숨김/뒷면 표시 정책을 따른다.
- `GAME_OVER` 상태는 결과 view model을 만든다.
- 카드 runtime number overlay 값은 `CardDefinition`과 `CardInstance` 상태에서 계산된다.
- `MAIN` 페이즈 손패 카드 선택은 합법 소환 슬롯 후보만 만든다.
- `MAIN` 페이즈 보드 유닛 선택은 합법 이동 슬롯 후보만 만든다.
- `COMBAT` 페이즈 보드 유닛 선택은 합법 공격 대상 후보만 만든다.
- 보호된 후열과 막힌 직접 공격 대상은 UI 후보에서 제외된다.
- `END_PHASE`, `END_TURN` 버튼 action은 올바른 페이즈에서만 생성된다.
- `applyAction` 실패 시 UI 상태가 기존 `GameState`를 교체하지 않는다.
- AI 턴 연결 helper는 Phase12 API 결과를 사용한다.
- 일반전 PvE 초기 state가 생성된다.
- 보스전 PvE 초기 state와 `BOSS_DEFEATED` 조건이 생성된다.
- Phase13 UI/scene 모듈은 룰 엔진 모듈을 import할 수 있지만, 룰 엔진 모듈은 UI/scene/Phaser를 import하지 않는다.
- 코드와 카드 데이터에 원작 보호 대상 텍스트가 추가되지 않는다.

## 12. 개발 서버 확인

Phase13은 실제 브라우저 화면이 목표이므로 일반 검증 외에 개발 서버 확인이 필요하다.

필수 확인:

- Vite 개발 서버가 시작된다.
- 첫 화면에 Phaser canvas 또는 명확한 game shell이 표시된다.
- 일반전 시작 버튼 또는 자동 시작 흐름으로 `GameScene`에 진입할 수 있다.
- 최소 한 번의 소환, 페이즈 진행, 공격, AI 턴, 게임 종료 흐름을 수동 또는 테스트 helper로 확인한다.

권장 명령:

```bash
npm run dev -- --host 127.0.0.1
```

브라우저 자동 확인을 도입한다면 Playwright 같은 새 의존성은 Phase13 범위와 검증 이득이 명확할 때만 추가한다. 단순 smoke는 Vitest와 view model 테스트로 우선 검증한다.

## 13. 완료 검증 명령

Phase13 완료 전 다음 명령을 모두 통과시킨다.

```bash
npm --silent run build
npm run lint
npm run format:check
npm test -- --reporter=dot
```

개발 서버 확인이 필요한 변경이므로 다음도 실행한다.

```bash
npm run dev -- --host 127.0.0.1
```

추가 감사 명령:

```bash
rg -n "from ['\"]\\.\\.?/.*/(scenes|ui|assets/cards)|from ['\"]phaser|document\\.|window\\." src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai
rg -n "Math\\.random\\(|Date\\.now\\(|new Date\\(" src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai src/scenes src/ui
rg -n "창각|創刻|アテリアル" src tests card-data generated
```

첫 번째 명령은 룰 엔진 계층의 UI/Phaser/DOM/카드 렌더러 의존성이 없어야 한다. 두 번째 명령은 룰과 AI, UI 입력 변환이 현재 시간이나 전역 난수에 직접 의존하지 않는지 확인한다. 세 번째 명령은 문서 외 코드, 카드 데이터, 생성물에 원작 보호 대상 텍스트가 들어가지 않았는지 확인하기 위한 감사다.

## 14. Phase13 완료 후 남겨야 할 경계

Phase13이 끝나도 다음은 아직 미완성으로 남겨야 한다.

- 대규모 통합 테스트 확장
- 장기 밸런스 시뮬레이션과 수치 조정
- 성능 최적화와 메모리 프로파일링
- Docker 배포
- Nginx 배포
- 자동 E2E 브라우저 테스트 체계
- 저장 슬롯 UI와 파일 export/import UX
- 리플레이 전용 관전 화면
- 스테이지 선택 맵과 진행도 저장
- 보상 구조와 카드 획득 시스템
- 덱 빌더
- 고급 보스 패턴 DSL
- 고급 AI 탐색, 난이도별 AI 전략
- 네트워크, PvP, 매치메이킹, 랭킹

이 경계를 넘는 구현은 Phase14 또는 별도 후속 문서에서 다룬다.
