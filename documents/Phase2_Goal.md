# Phase 2 목표 지시문 — 프로젝트 구조 및 개발 환경 구축

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 초기 프로젝트를 구축하는 시니어 엔진 개발자다.

아래 문서를 기준으로 Phase 2를 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

## 기준 문서

- `Plan.md`
- `Core_Rule_Spec_v0.1.md`

## Phase 2의 위치

`Plan.md`에서 Phase 2는 다음 단계다.

- Phase 1: Core Rule Spec v0.1 설계
- Phase 2: 프로젝트 구조 및 개발 환경 구축
- Phase 3: 핵심 데이터 모델 설계
- Phase 4 이후: 턴, 카드, 전장, 전투, 효과, 리플레이, AI 구현

따라서 Phase 2는 게임 룰을 본격 구현하는 단계가 아니라, 이후 Phase 3~14가 안정적으로 진행될 수 있도록 프로젝트 골격과 개발 품질 기준을 확정하는 단계다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- 룰 엔진은 Phaser, DOM, 네트워크와 분리된 순수 TypeScript 모듈로 작성될 수 있어야 한다.
- Phaser는 클라이언트 표현 계층으로만 취급한다.
- Core Rule Spec의 지배력 시스템, 전열/후열 전장, 이벤트 기반 효과 처리, 결정론적 리플레이 설계를 수용할 수 있는 구조를 만든다.
- Phase 2에서는 복잡한 룰 구현을 완료하려 하지 않는다. 대신 타입/모듈/테스트/빌드가 놓일 자리를 만든다.
- 이후 카드 Asset Pipeline을 고려해 `assets`, `card-data`, `generated` 계층도 초기 구조에 포함한다.

## Phase 2 최종 목표

다음 명령으로 설치, 개발, 빌드, 검사, 테스트가 가능한 TypeScript 프로젝트 초기 구조를 완성한다.

```bash
npm install
npm run dev
npm run build
npm run lint
npm run format:check
npm test
```

Phase 2 완료 시점에는 최소한 다음이 가능해야 한다.

- Vite 개발 서버가 실행된다.
- TypeScript 빌드가 통과한다.
- ESLint 검사가 통과한다.
- Prettier 포맷 검사가 통과한다.
- 테스트 러너가 실행되고 샘플 테스트가 통과한다.
- `src/` 하위에 Core Rule Spec과 Plan의 Phase 구조를 반영한 모듈 디렉터리가 존재한다.
- 룰 엔진 코드가 UI 계층과 분리될 수 있도록 import 경계가 명확하다.

## 1. 프로젝트 패키지 구성

### 필수 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `package.json` | npm scripts, dependencies, devDependencies 정의 |
| `package-lock.json` | 의존성 잠금 |
| `tsconfig.json` | TypeScript 공통 컴파일 설정 |
| `tsconfig.node.json` | Vite/Node 설정용 TypeScript 구성 |
| `vite.config.ts` | Vite 개발/빌드 구성 |
| `eslint.config.js` | ESLint flat config |
| `.prettierrc` | Prettier 규칙 |
| `.prettierignore` | 생성물/의존성 포맷 제외 |
| `.gitignore` | `node_modules`, `dist`, `coverage`, generated artifacts 제외 |
| `index.html` | Vite 진입 HTML |
| `src/main.ts` | 클라이언트 진입점 |
| `src/style.css` | 최소 전역 스타일 |
| `src/env.d.ts` | Vite 타입 선언 |

### 권장 패키지

Phase 2에서는 다음 패키지 사용을 기본으로 한다.

| 분류 | 패키지 |
|---|---|
| Runtime | `@vitejs/plugin-basic-ssl`은 필요 시만 사용, 기본은 Vite 자체 |
| Client | `vite`, `typescript` |
| Phaser | `phaser` |
| Lint | `eslint`, `@eslint/js`, `typescript-eslint` |
| Format | `prettier` |
| Test | `vitest` |

Phaser는 Phase 13에서 본격 사용하지만, Phase 2에서 의존성을 추가하고 최소 진입점이 깨지지 않는지 확인한다.

## 2. npm scripts

`package.json`에는 최소한 다음 scripts를 포함한다.

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

완료 기준:

- 모든 script가 존재해야 한다.
- `npm run build`, `npm run lint`, `npm run format:check`, `npm test`가 통과해야 한다.
- `npm run dev`는 로컬 개발 서버를 시작해야 한다.

## 3. 권장 프로젝트 구조

`Plan.md`와 `Core_Rule_Spec_v0.1.md`를 반영해 다음 구조를 만든다.

```text
src/
├─ core/
│  ├─ index.ts
│  ├─ types.ts
│  └─ version.ts
├─ game/
│  └─ index.ts
├─ rules/
│  └─ index.ts
├─ cards/
│  └─ index.ts
├─ zones/
│  └─ index.ts
├─ board/
│  └─ index.ts
├─ dominance/
│  └─ index.ts
├─ battle/
│  └─ index.ts
├─ events/
│  └─ index.ts
├─ effects/
│  └─ index.ts
├─ replay/
│  └─ index.ts
├─ ai/
│  └─ index.ts
├─ scenes/
│  └─ index.ts
├─ ui/
│  └─ index.ts
├─ assets/
│  └─ README.md
├─ main.ts
├─ style.css
└─ env.d.ts

card-data/
├─ README.md
└─ examples/
   └─ basic-unit.example.json

generated/
└─ README.md

tests/
├─ smoke.test.ts
└─ core-version.test.ts
```

구조 원칙:

- `core`, `game`, `rules`, `cards`, `zones`, `board`, `dominance`, `battle`, `events`, `effects`, `replay`, `ai`는 룰 엔진 또는 룰 주변 모듈이다.
- `scenes`, `ui`, `assets`는 Phaser 및 표현 계층이다.
- 룰 엔진 계층은 `scenes`와 `ui`를 import하지 않아야 한다.
- `card-data`는 카드 정의 원본 JSON을 두는 위치다.
- `generated`는 카드 이미지, 빌드 산출물, 자동 생성 파일의 위치다. 생성 파일은 기본적으로 git 추적 대상에서 제외한다.

## 4. Core Rule Spec 반영용 최소 스텁

Phase 2는 실제 룰 구현을 완료하지 않지만, Phase 3에서 타입 구현을 바로 시작할 수 있도록 최소 스텁을 둔다.

### `src/core/version.ts`

다음 상수를 제공한다.

```ts
export const RULE_VERSION = 'core-rule-v0.1';
export const ENGINE_VERSION = 'phase2-dev';
```

### `src/core/types.ts`

Core Rule Spec에서 요구한 핵심 타입 이름을 placeholder 수준으로 선언한다.

필수 export:

- `GameId`
- `PlayerId`
- `CardId`
- `InstanceId`
- `EffectId`
- `Phase`
- `GameStatus`

Phase 2에서는 전체 `GameState`를 구현하지 않아도 된다. 단, Phase 3에서 확장할 위치를 명확히 해야 한다.

### `src/core/index.ts`

`version.ts`와 `types.ts`를 re-export한다.

### 테스트 요구

`tests/core-version.test.ts`에서 다음을 검증한다.

- `RULE_VERSION === 'core-rule-v0.1'`
- `ENGINE_VERSION`이 빈 문자열이 아니다.

## 5. TypeScript 설정 기준

`tsconfig.json`은 다음 기준을 만족해야 한다.

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noFallthroughCasesInSwitch: true`
- `moduleResolution: "Bundler"`
- `target`은 현대 브라우저와 Node 개발 환경에 맞춘다.
- `src`, `tests`, `vite.config.ts`를 타입 검사 범위에 포함한다.

이 설정은 Core Rule Spec의 결정론적 시뮬레이션과 상태 모델 구현에서 암묵적 `undefined`, 느슨한 optional 처리, switch 누락을 줄이기 위한 최소 안전장치다.

## 6. ESLint / Prettier 기준

ESLint는 TypeScript 소스와 테스트 파일을 검사해야 한다.

필수 기준:

- TypeScript parser/config 적용
- browser/global 환경 또는 Vite 클라이언트 환경 대응
- `dist`, `node_modules`, `coverage`, `generated` 제외
- formatting은 Prettier가 담당하고, ESLint는 코드 품질 위주로 둔다.

Prettier 권장 기준:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

## 7. Vite / Phaser 클라이언트 최소 구성

Phase 2의 클라이언트는 플레이 가능한 게임을 만들 필요는 없다.

필수 요구:

- `index.html`이 `src/main.ts`를 로드한다.
- `src/main.ts`는 최소 DOM 렌더링 또는 Phaser 초기화 준비 코드를 포함한다.
- 개발 서버 실행 시 빈 화면이 아니라 프로젝트명, 엔진 버전, 룰 버전이 표시되어야 한다.
- Phaser를 바로 초기화하지 않는 경우에도 Phase 13에서 연결할 위치를 주석 또는 함수 경계로 남긴다.

금지:

- 룰 엔진 모듈이 Phaser 객체를 import하는 구조
- Phase 2에서 카드/전투/효과 룰을 임의로 축약 구현하는 것

## 8. 카드 데이터와 에셋 준비 구조

Core Rule Spec의 카드 에셋 파이프라인 요구를 반영해 다음을 준비한다.

### `card-data/examples/basic-unit.example.json`

원작 데이터를 사용하지 않는 독자 예시 카드 1장을 둔다.

필수 필드:

- `cardId`
- `nameKey`
- `type`
- `cost`
- `dominanceCost`
- `dominanceValue`
- `baseAttack`
- `baseHealth`
- `rowRestriction`
- `tags`
- `abilities`
- `rarity`

### `src/assets/README.md`

다음을 명시한다.

- 원작 리소스 사용 금지
- 카드 이미지는 Phase 9에서 데이터 기반 생성
- 룰 처리는 이미지가 아니라 `CardDefinition` 데이터를 기준으로 수행

### `generated/README.md`

다음을 명시한다.

- 자동 생성물 위치
- 기본적으로 git 추적 제외
- 카드 WebP, 리포트, 시뮬레이션 산출물이 들어갈 수 있음

## 9. 테스트 전략

Phase 2의 테스트는 룰 정확성 검증이 아니라 환경 정상성을 검증한다.

필수 테스트:

| 테스트 | 목적 |
|---|---|
| smoke test | Vitest가 실행되는지 확인 |
| core version test | 룰 버전과 엔진 버전 export 확인 |
| import boundary smoke | core 모듈이 정상 import되는지 확인 |

권장 테스트:

- `card-data/examples/basic-unit.example.json`을 JSON import 또는 fs 기반으로 읽을 수 있는지 확인
- 단, Phase 2에서 카드 스키마 검증까지 구현하지 않아도 된다.

## 10. 완료 조건

Phase 2는 다음 조건을 모두 만족해야 완료로 본다.

- [ ] `package.json`과 lockfile이 존재한다.
- [ ] Vite + TypeScript 프로젝트가 실행 가능하다.
- [ ] Phaser 의존성이 설치되어 있다.
- [ ] ESLint와 Prettier 설정이 존재한다.
- [ ] Vitest 설정 또는 기본 실행 구성이 동작한다.
- [ ] `src/` 하위에 Plan의 권장 구조와 Core Rule Spec 모듈 경계가 반영되어 있다.
- [ ] `dominance/`, `board/`, `battle/`, `events/`, `effects/`, `replay/`, `ai/` 디렉터리가 존재한다.
- [ ] `card-data/examples/basic-unit.example.json`이 존재하고 원작 데이터를 포함하지 않는다.
- [ ] `generated/README.md`가 존재한다.
- [ ] `npm run build`가 통과한다.
- [ ] `npm run lint`가 통과한다.
- [ ] `npm run format:check`가 통과한다.
- [ ] `npm test`가 통과한다.
- [ ] `npm run dev`가 실행 가능한 상태다.

## 11. 제외 범위

Phase 2에서 다음은 구현하지 않는다.

- 완전한 `GameState` 구현
- 카드 효과 DSL 구현
- 턴/페이즈 reducer 구현
- 덱 셔플/드로우 구현
- 전열/후열 소환 검증 구현
- 지배력 재계산 로직 구현
- 전투 엔진 구현
- 리플레이 runner 구현
- AI 행동 탐색 구현
- 카드 WebP 생성 파이프라인 구현
- 보스전/스테이지 콘텐츠 구현

단, 위 기능을 구현할 모듈 위치와 import 경계는 Phase 2에서 반드시 마련한다.

## 12. Phase 3로 넘길 준비물

Phase 2 완료 후 Phase 3은 다음 작업을 바로 시작할 수 있어야 한다.

- `src/core/types.ts`에 `GameState`, `PlayerState`, `CardDefinition`, `CardInstance` 추가
- `src/cards/`에 카드 정의 로더와 타입 추가
- `src/zones/`에 Zone 모델과 이동 API 추가
- `src/dominance/`에 `DominanceState`, `DominanceConfig`와 재계산 함수 추가
- `tests/`에 타입/데이터 모델 테스트 추가

## 13. 최종 산출물

Phase 2 결과로 다음을 제출해야 한다.

1. 초기 Node.js + TypeScript + Vite 프로젝트
2. ESLint / Prettier / Vitest 설정
3. Phase별 확장을 고려한 `src/` 모듈 구조
4. 최소 core version/type 스텁
5. 독자 예시 카드 JSON
6. 에셋/생성물 관리 README
7. 통과한 검증 명령 목록
8. Phase 3 착수 시 남은 TODO 목록

## 작성 및 구현 방식

- 설명과 문서는 한국어로 작성한다.
- 코드, 파일명, npm script, 타입명은 영어를 사용한다.
- 기존 `Plan.md`와 `Core_Rule_Spec_v0.1.md`의 방향을 좁히거나 바꾸지 않는다.
- 지배력 시스템은 Phase 2에서 구현하지 않더라도 구조상 독립 모듈로 반드시 반영한다.
- 개발 환경 변경은 이후 Phase에서 큰 마이그레이션이 필요 없도록 보수적으로 선택한다.
- 테스트 가능한 상태를 완료 기준으로 삼고, 단순 파일 생성만으로 Phase 2를 완료 처리하지 않는다.
