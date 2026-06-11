# AGENTS.md

이 문서는 ElvenBattle 저장소에서 작업하는 코딩 에이전트를 위한 지속 지침이다. 저장소 루트 기준으로 적용한다.

## 공식 참조

- AGENTS.md 형식: https://agents.md/
- OpenAI Codex `AGENTS.md` 안내: https://developers.openai.com/codex/guides/agents-md.md
- Vite 공식 문서 및 커뮤니티: https://vite.dev/guide/
- TypeScript 공식 문서 및 커뮤니티: https://www.typescriptlang.org/docs/
- Phaser 공식 문서 및 Discord 커뮤니티: https://docs.phaser.io/phaser/getting-started/what-is-phaser
- Vitest 공식 문서: https://vitest.dev/guide/
- ESLint 공식 문서: https://eslint.org/docs/latest/
- Prettier 공식 문서: https://prettier.io/docs/

## 프로젝트 개요

- 이 프로젝트는 창각의 아테리얼식 전장 운영 감각을 일반화한 독자 디지털 TCG 엔진이다.
- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 복제하지 않는다.
- Phase3~14 구현 추적과 회귀 비교는 `documents/Core_Rule_Spec_v0.1.md`를 기준으로 한다.
- Phase15 이후 차기 룰 전환은 `documents/Core_Rule_Spec_v0.2.md`를 기준으로 한다.
- 전체 개발 로드맵은 `documents/Plan.md`를 기준으로 한다.
- 현재 전환 목표와 완료 조건은 `documents/Phase15_Goal.md`를 기준으로 한다.
- PvE 중심 구조, 보드 위치 전략, 지배력 시스템, 이벤트 기반 효과 처리, 결정론적 리플레이를 핵심 축으로 유지한다.

## 현재 기술 스택

- Node.js + TypeScript
- Vite
- Phaser
- ESLint
- Prettier
- Vitest
- npm

## 주요 명령

- 의존성 설치: `npm install`
- 개발 서버: `npm run dev`
- 프로덕션 빌드: `npm run build`
- 린트: `npm run lint`
- 포맷 적용: `npm run format`
- 포맷 검사: `npm run format:check`
- 테스트: `npm test`
- 테스트 감시 모드: `npm run test:watch`

작업 완료 전에는 변경 범위에 맞게 최소한 다음을 실행한다.

```bash
npm --silent run build
npm run lint
npm run format:check
npm test -- --reporter=dot
```

개발 서버 확인이 필요한 작업이면 다음도 실행한다.

```bash
npm run dev -- --host 127.0.0.1
```

## 디렉터리 역할

- `src/core/`: 룰 엔진 공통 타입, 버전, 순수 코어 유틸리티
- `src/game/`: 게임 세션과 상위 진행 모델
- `src/rules/`: 검증 규칙과 룰 정책
- `src/cards/`: 카드 정의, 카드 인스턴스, 카드 데이터 로더
- `src/zones/`: 덱, 패, 전장, 묘지 등 카드 영역 모델
- `src/board/`: 전열/후열 슬롯, 전장 좌표, 리더 위치, 인접 칸 모델
- `src/dominance/`: v0.1 지배력 한계/점유/장악 점수와 v0.2 칸별 지배력 계산
- `src/battle/`: 공격 선언, 인접 공격 검증, 피해 계산, 파괴 처리, 리더 공격 처리
- `src/events/`: 이벤트 모델과 이벤트 큐
- `src/effects/`: 효과 스택, 트리거, 지속 효과
- `src/replay/`: 액션 로그, 이벤트 로그, 상태 해시, 리플레이
- `src/ai/`: 합법 행동 조회, 상태 평가, 시뮬레이션 인터페이스
- `src/scenes/`: Phaser 장면
- `src/ui/`: UI 표현 계층
- `src/assets/`: 직접 관리하는 독자 에셋 설명 및 원천 자료
- `card-data/`: 독자 카드 정의 JSON
- `generated/`: 자동 생성 산출물
- `tests/`: Vitest 테스트

## 아키텍처 원칙

- 룰 엔진은 UI, DOM, Phaser, 네트워크에 의존하지 않는 순수 TypeScript 모듈로 유지한다.
- `src/core`, `src/rules`, `src/cards`, `src/zones`, `src/board`, `src/dominance`, `src/battle`, `src/events`, `src/effects`, `src/replay`, `src/ai`는 `src/scenes`나 `src/ui`를 import하지 않는다.
- Phaser는 표현 계층이다. 룰 상태 변경은 룰 엔진 API를 통해서만 일어나야 한다.
- 상태 변경 함수는 가능한 한 순수 함수 형태를 따른다.
- 결정론이 필요한 로직은 `Math.random()`과 현재 시간에 직접 의존하지 않는다.
- 리플레이 가능한 로직은 `rngSeed`, 액션 로그, 이벤트 로그, 룰 버전, 카드 데이터 버전을 기준으로 재현 가능해야 한다.
- 카드 이미지는 표시용이다. 룰 판정은 항상 `CardDefinition` 원본 데이터를 기준으로 한다.

## 룰 설계 원칙

- `documents/Core_Rule_Spec_v0.1.md`는 Phase3~14 구현 기준으로 보존하고, 임의로 v0.2 내용과 섞지 않는다.
- `documents/Core_Rule_Spec_v0.2.md`는 Phase15 이후 리더, 칸별 지배력, 인접 전투 전환의 목표 기준으로 사용한다.
- `GameState`, `PlayerState`, `CardDefinition`, `CardInstance`는 원본 데이터와 런타임 상태를 분리한다.
- `energy`는 카드 사용 비용으로 남길 수 있지만, v0.2의 보드 배치 조건은 `card.cost <= slotDominance`를 우선한다.
- `dominance`는 v0.1에서 전장 유지 한계와 장악 점수로 사용되며, v0.2에서는 칸별 배치 가능 수치로 전환한다.
- 전장은 v0.1에서 각 플레이어 2행 x 3열 구조를 따르며, v0.2 전환에서는 리더 위치와 인접 칸 모델을 추가한다.
- 후열이 같은 열 전열에 의해 보호되는 규칙은 v0.1 기준이다. v0.2 전환에서는 기본 공격 규칙을 인접 공격으로 재정의한다.
- 리더는 v0.2에서 보드 위 위치를 가진 핵심 객체이며, 리더 주변 칸에 기본 지배력 1을 제공한다.
- 상대 리더 체력 0 이하 승리 조건은 v0.2 전환의 최우선 종료 조건이다.
- 효과 처리는 이벤트 큐, 효과 스택, 지속 효과 레이어를 분리한다.
- PvP, 원작 서버 프로토콜, 원작 리소스 복제는 범위 밖이다.

## 코드 스타일

- TypeScript `strict` 설정을 유지한다.
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`를 약화하지 않는다.
- 파일명과 타입명, 함수명, npm script 이름은 영어를 사용한다.
- 문서와 설명은 한국어를 기본으로 작성한다.
- 코드 주석은 한국어로 작성한다.
- 주석은 복잡한 룰 판단, 결정론, 지배력 계산, 이벤트 처리 순서를 설명할 때만 추가한다.
- 단순히 코드가 하는 일을 반복하는 주석은 쓰지 않는다.
- Prettier 설정은 `.prettierrc`를 따른다.
- ESLint 오류를 무시하지 않는다. 예외가 필요하면 이유를 한국어 주석으로 남긴다.

## 테스트 지침

- 새 타입, 룰 함수, 상태 변환 함수, 카드 데이터 로더를 추가하면 관련 테스트를 추가한다.
- 룰 변경은 정상 케이스와 실패 케이스를 모두 테스트한다.
- 결정론 관련 기능은 같은 입력에서 같은 결과가 나오는지 테스트한다.
- 리플레이 관련 기능은 상태 해시 또는 로그 재생 검증을 포함한다.
- 테스트 이름은 동작이 드러나게 작성한다.

## 에셋과 카드 데이터 지침

- `card-data/`의 예시 카드는 독자 데이터만 사용한다.
- 원작 카드명, 캐릭터명, 설명문, 이미지, UI 표현을 복제하지 않는다.
- 카드 데이터에는 룰 처리에 필요한 값을 명시하고, 렌더링용 텍스트와 룰 값을 혼동하지 않는다.
- `generated/`의 자동 생성 산출물은 기본적으로 추적하지 않는다. README처럼 필요한 안내 파일만 추적한다.
- 카드 WebP 생성 파이프라인은 Phase 9 전까지 임의로 확장하지 않는다.

## 작업 절차

1. 변경 전 `documents/Plan.md`, 현재 작업 기준 룰 문서, 관련 Phase 목표 문서를 확인한다.
2. Phase3~14 회귀 수정은 `documents/Core_Rule_Spec_v0.1.md`를 기준으로 한다.
3. Phase15 이후 룰 전환 작업은 `documents/Core_Rule_Spec_v0.2.md`와 `documents/Phase15_Goal.md`를 기준으로 한다.
4. 기존 모듈 경계를 먼저 따른다.
5. 새 의존성은 필요한 이유가 명확할 때만 추가한다.
6. 파일을 수정한 뒤 `npm run format:check`, `npm run lint`, `npm test`를 우선 확인한다.
7. 타입 또는 번들 영향이 있으면 `npm run build`까지 실행한다.
8. UI 또는 Vite 진입점이 바뀌면 개발 서버 응답을 확인한다.

## 금지 사항

- 원작 보호 대상 데이터를 추가하지 않는다.
- 룰 엔진에서 Phaser, DOM, 브라우저 전역 객체를 직접 참조하지 않는다.
- 테스트 실패를 남긴 채 완료 처리하지 않는다.
- `tsconfig`의 엄격한 옵션을 완화하지 않는다.
- 생성물, 캐시, `dist`, `node_modules`를 의도 없이 커밋 대상으로 만들지 않는다.
- 사용자 변경사항을 임의로 되돌리지 않는다.
- 범위 밖 리팩터링을 함께 진행하지 않는다.

## 공식 자료 사용 기준

- Codex 또는 `AGENTS.md` 동작은 OpenAI Codex 공식 매뉴얼과 https://agents.md/를 우선 참조한다.
- Vite, Phaser, TypeScript, Vitest, ESLint, Prettier 관련 판단은 각 공식 문서를 우선 참조한다.
- 창각의 아테리얼식 전장 운영 감각, 지배력, 리더, 코스트, 배치, 이동, 공격 흐름 중 문서에 부족한 정보가 있으면 웹검색 도구를 사용해 게임 후기, 리뷰, 공략 글을 확인한다.
- 웹검색으로 확인한 정보는 구조적 룰 감각만 일반화하여 반영하고, 원작 카드명, 캐릭터명, 카드 수치, 설명문, 이미지, UI 표현은 복제하지 않는다.
- 창각의 아테리얼 관련 웹 자료는 공식/준공식 자료가 있으면 우선 확인하고, 후기와 공략 글은 공개적으로 관찰 가능한 전투 흐름을 교차 확인하는 보조 자료로만 사용한다.
- 커뮤니티 답변은 공식 문서로 확인되지 않는 문제를 보조적으로 조사할 때만 사용한다.
- 공식 문서와 현재 저장소 설정이 다르면 현재 저장소 설정을 먼저 따르고, 필요한 경우 변경 이유를 명시한다.
