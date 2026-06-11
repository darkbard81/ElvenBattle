# Phase 14 목표 지시문 — 테스트 / 밸런스 / 배포

너는 Node.js + TypeScript + Vite + Phaser 기반 디지털 TCG 게임 엔진의 통합 테스트, 밸런스 검증, 성능 검증, 릴리스 품질 게이트, 정적 배포 산출물 검증을 구현하는 엔지니어다.

아래 문서를 기준으로 Phase 14를 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

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
- `documents/Phase13_Goal.md`
- `AGENTS.md`

## Phase 14의 위치

`documents/Plan.md`에서 Phase 14는 다음 단계다.

- Phase 11: 저장 / 리플레이 / 결정론 시스템 구현
- Phase 12: AI 플레이어 및 시뮬레이션 구현
- Phase 13: Phaser UI 및 PvE 콘텐츠 구현
- Phase 14: 테스트 / 밸런스 / 배포

따라서 Phase 14는 Phase3~13에서 구현한 룰 엔진, 카드 데이터, 카드 에셋 파이프라인, 승리 조건, 리플레이/hash, AI 시뮬레이션, Phaser Playable MVP를 릴리스 후보 수준으로 검증하는 단계다. 새 대형 룰이나 새 콘텐츠를 추가하는 단계가 아니라, 기존 구현이 반복 실행, 자동 검증, 정적 배포, 회귀 방지 기준을 통과하도록 품질 게이트를 구축한다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- PvP, 네트워크 동기화, 계정, 클라우드 저장, 서버 권위 검증은 Phase14 범위 밖이다.
- 룰 엔진은 UI, DOM, Phaser, 브라우저 전역 객체에 의존하지 않는다.
- Phaser UI는 표현 계층이며, 룰 상태 변경은 기존 룰 엔진 public API를 통해서만 일어난다.
- 결정론 검증은 `rngSeed`, action log, event log, rule version, card data version, state hash를 기준으로 한다.
- 밸런스 검증은 PvE 반복 플레이의 난이도 곡선, 승률, 평균 턴 수, 덱 안정성, 보스전 목표 달성률을 중심으로 한다.
- 카드 이미지는 표시용이다. 룰 판정과 밸런스 분석은 항상 `CardDefinition`과 `CardInstance`의 정규 데이터에서 읽는다.
- Docker/Nginx 배포는 정적 `dist/` 산출물을 안전하게 제공하는 범위로 제한한다.
- 새 의존성은 테스트 자동화나 배포 검증에 꼭 필요한 경우에만 추가한다.
- TypeScript strict 설정, ESLint, Prettier, Vitest 기준을 완화하지 않는다.

## Phase 14 최종 목표

다음 기능과 검증 체계를 구현한다.

- Phase3~13 핵심 흐름을 관통하는 통합 테스트
- 일반전과 보스전의 시작, 진행, 종료 회귀 테스트
- 카드 데이터, 덱, 시나리오, 에셋 manifest 일관성 검증
- 리플레이 재생과 상태 hash 결정론 회귀 테스트
- AI 자동 플레이 batch simulation 검증
- PvE 밸런스 지표 산출
- 밸런스 실패 기준과 경고 기준 정의
- 런타임 숫자 overlay와 카드 base asset 참조 검증
- Phaser UI view model, 입력 변환, 합법 행동 하이라이트 회귀 테스트
- production build 산출물 검증
- bundle size와 주요 성능 예산 검증
- 정적 배포 문서 작성
- 필요한 경우 Docker/Nginx 정적 서빙 설정 작성
- 릴리스 체크리스트 작성
- CI에서 그대로 실행 가능한 품질 게이트 npm script 구성

Phase 14 완료 시점에는 다음이 가능해야 한다.

- `npm --silent run build`가 성공하고 `dist/` 산출물이 생성된다.
- `npm run lint`, `npm run format:check`, `npm test -- --reporter=dot`가 모두 성공한다.
- 카드 데이터, 덱, 시나리오, manifest 검증 명령이 성공한다.
- 같은 seed와 같은 action log는 항상 같은 state hash와 event log 요약을 만든다.
- AI batch simulation은 deterministic seed 목록에서 재현 가능한 결과를 낸다.
- 기본 플레이어 덱과 AI 덱의 승률, 평균 턴 수, 게임 종료 사유가 문서화된다.
- 보스전 MVP는 목표 달성률과 평균 종료 턴이 허용 범위 안에 있다.
- 빌드 산출물은 누락된 asset 없이 정적 서버에서 제공될 수 있다.
- Docker/Nginx 설정을 추가한 경우, 해당 설정은 `dist/` 정적 서빙 외의 서버 로직을 만들지 않는다.
- 룰 엔진 계층이 UI/Phaser를 import하지 않는 boundary 테스트가 유지된다.
- 원작 보호 대상 문자열이나 리소스가 새 산출물에 포함되지 않는다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `tests/phase14-integration.test.ts` | Phase3~13 핵심 흐름 통합 테스트 |
| `tests/phase14-regression.test.ts` | 리플레이, state hash, deterministic 회귀 테스트 |
| `tests/phase14-balance.test.ts` | AI simulation 기반 밸런스 지표 테스트 |
| `tests/phase14-performance.test.ts` | build artifact, bundle, 성능 예산 검증 |
| `tests/phase14-deploy.test.ts` | 정적 배포 산출물과 설정 파일 smoke test |
| `scripts/check-balance.ts` | batch simulation 실행과 밸런스 요약 출력 |
| `scripts/check-build-artifacts.ts` | `dist/` 산출물, asset 참조, manifest 검증 |
| `scripts/check-performance-budget.ts` | bundle size와 주요 예산 검사 |
| `scripts/check-release.ts` | 릴리스 전 품질 게이트 통합 실행 |
| `documents/Balance_Report.md` | 현재 카드/덱/시나리오 기준 밸런스 결과 기록 |
| `documents/Release_Checklist.md` | 릴리스 후보 검증 체크리스트 |
| `documents/Deployment.md` | 정적 build, Docker, Nginx 배포 방법 |
| `package.json` | Phase14 검증 npm script 추가 |
| `Dockerfile` | 필요한 경우 `dist/` 정적 서빙 이미지 정의 |
| `.dockerignore` | 필요한 경우 Docker build context 제외 목록 |
| `nginx.conf` | 필요한 경우 Vite SPA 정적 서빙 설정 |

기존 Phase3~13 파일은 테스트 가능성 보강이 필요한 경우에만 좁게 수정한다. Phase14를 이유로 룰 구조, 카드 데이터 포맷, UI 구조를 대규모로 재작성하지 않는다.

## 2. 통합 테스트 범위

통합 테스트는 단일 모듈의 함수 테스트가 아니라 실제 게임 흐름을 검증해야 한다.

필수 시나리오:

- 기본 PvE 일반전 생성
- 플레이어 시작 손패와 덱 검증
- 자원과 지배력 증가
- 유닛 소환
- 전열/후열 슬롯 배치
- 후열 보호 규칙
- 유닛 이동
- 공격 선언과 피해 처리
- 파괴와 묘지 이동
- 이벤트 큐와 효과 스택 처리
- HP 기반 승패
- 덱 아웃 패배
- 보스 목표 달성
- AI 턴 자동 진행
- UI view model 갱신
- action log와 event log 기록

정책:

- 테스트는 가능한 한 public API만 사용한다.
- 룰 엔진 내부 구현 세부에 직접 의존하지 않는다.
- 랜덤 요소는 고정 seed를 사용한다.
- 실패 케이스는 검증 오류 타입이나 message key를 확인한다.
- UI 관련 테스트는 Phaser 객체보다 pure view model과 입력 변환 helper를 우선 검증한다.

## 3. 밸런스 검증 기준

Phase14의 밸런스 검증은 완성형 밸런싱이 아니라 회귀를 감지할 수 있는 자동 지표를 만드는 것이 목적이다.

필수 지표:

| 지표 | 목적 |
|---|---|
| playerWinRate | 기본 덱 기준 플레이어 승률 |
| averageTurnCount | 전투가 너무 빠르거나 길어지는지 확인 |
| medianTurnCount | 극단값 영향을 줄인 종료 턴 기준 |
| deckOutRate | 덱 아웃이 과도하게 자주 발생하는지 확인 |
| bossClearRate | 보스전 목표 난이도 확인 |
| averageRemainingHp | 승패와 별개로 체감 난이도 확인 |
| dominanceOverloadRate | 지배력 한계 초과가 과도한지 확인 |
| illegalActionRate | AI나 시나리오가 불법 행동을 생성하는지 확인 |
| replayMismatchCount | simulation 결과가 재생과 일치하는지 확인 |

권장 기본 허용 범위:

- 일반전 플레이어 승률: 45% 이상 75% 이하
- 보스전 클리어율: 25% 이상 60% 이하
- 일반전 평균 종료 턴: 5턴 이상 14턴 이하
- 보스전 평균 종료 턴: 7턴 이상 20턴 이하
- deterministic replay mismatch: 0건
- AI illegal action: 0건

정책:

- 허용 범위는 `documents/Balance_Report.md`에 이유와 함께 기록한다.
- 밸런스 test는 작은 sample로 빠르게 실패를 감지하고, `check-balance` script는 더 큰 sample을 실행할 수 있게 분리한다.
- simulation 결과는 seed 목록, 덱 ID, 시나리오 ID, rule version, card data version을 함께 남긴다.
- 밸런스 지표가 실패하면 카드 수치, AI 평가 함수, 시나리오 목표 중 어느 영역이 원인인지 로그로 추적 가능해야 한다.
- 밸런스 조정은 독자 카드 데이터만 대상으로 하며 원작 카드 수치를 참고하거나 복제하지 않는다.

## 4. 성능과 번들 예산

Phase14에서는 production build가 실제 배포 후보로 사용할 수 있는지 검증한다.

필수 검증:

- `dist/index.html` 존재
- JS/CSS asset 존재
- 카드 base asset과 manifest 참조 유효성
- source map 생성 정책 확인
- bundle size 예산 확인
- 초기 로드에 필요한 asset 누락 여부 확인
- Phaser canvas bootstrap smoke 확인

권장 예산:

| 항목 | 기준 |
|---|---:|
| gzip 전 메인 JS chunk | 1.5 MB 이하 |
| gzip 전 전체 JS 합계 | 2.5 MB 이하 |
| gzip 전 CSS 합계 | 250 KB 이하 |
| 카드 manifest JSON | 2 MB 이하 |
| production build 시간 | 로컬 기준 30초 이하 |

정책:

- Phaser 의존성으로 인한 Vite chunk size warning은 즉시 실패가 아니라 예산 검사에서 별도로 판단한다.
- 예산 초과 시 실패 메시지는 실제 크기, 기준, 가장 큰 asset을 함께 보여준다.
- 성능 최적화는 측정 결과에 근거해 좁게 수행한다.
- 렌더링 성능은 Phase13 UI 구조를 유지하면서 object churn과 불필요한 redraw를 줄이는 방향으로만 개선한다.

## 5. 배포 산출물

Phase14의 배포 대상은 Vite production build의 정적 산출물이다.

필수 문서:

- 로컬 build 절차
- 정적 파일 서버 확인 절차
- cache header 권장값
- SPA fallback 필요 여부
- asset 경로와 base path 주의사항
- 배포 전 검증 명령
- rollback 기준

Docker/Nginx를 추가하는 경우:

- Docker image는 build 결과물 또는 build stage를 포함해 `dist/`를 서빙한다.
- Nginx는 정적 파일 제공, `index.html` fallback, 장기 cache asset header만 담당한다.
- 컨테이너는 게임 서버, 계정 서버, PvP 서버 역할을 하지 않는다.
- 런타임 환경 변수는 정적 base path처럼 꼭 필요한 값만 둔다.
- `node_modules`, `generated/` 대형 산출물, cache, `dist` 중복 복사는 `.dockerignore`로 제한한다.

## 6. 회귀와 결정론 검증

리플레이와 결정론은 Phase14의 핵심 품질 기준이다.

필수 검증:

- 같은 seed와 같은 초기 덱은 같은 초기 state hash를 만든다.
- 같은 action log를 재생하면 같은 final state hash를 만든다.
- event log의 핵심 이벤트 순서가 재현된다.
- AI simulation은 seed별 선택 action이 재현된다.
- 저장된 replay sample은 rule version과 card data version 불일치 시 명확히 실패한다.
- `Math.random()`, `Date.now()`, `new Date()`는 결정론이 필요한 경로에서 직접 사용하지 않는다.

정책:

- replay sample은 작고 읽기 쉬운 fixture로 유지한다.
- state hash에는 UI-only 상태나 Phaser 객체가 들어가지 않는다.
- event log 검증은 모든 렌더링 문구가 아니라 룰 의미가 있는 event type과 payload를 중심으로 한다.
- 결정론 검증 실패 시 첫 불일치 action index와 event index를 출력한다.

## 7. 품질 게이트 npm script

`package.json`에는 필요에 따라 다음 script를 추가한다.

```json
{
  "scripts": {
    "test:integration": "vitest run tests/phase14-integration.test.ts tests/phase14-regression.test.ts",
    "check:balance": "tsx scripts/check-balance.ts",
    "check:artifacts": "tsx scripts/check-build-artifacts.ts",
    "check:performance": "tsx scripts/check-performance-budget.ts",
    "check:release": "tsx scripts/check-release.ts"
  }
}
```

정책:

- 기존 test/lint/build script 이름을 깨지 않는다.
- `check:release`는 로컬과 CI에서 같은 순서로 실행 가능해야 한다.
- 새 script가 외부 네트워크에 의존하지 않게 한다.
- 장시간 batch simulation은 기본 test와 분리하고, sample 수를 옵션으로 조절할 수 있게 한다.
- Windows shell 전용 또는 POSIX shell 전용 문법을 npm script에 직접 넣지 않는다.

## 8. 문서 산출물

### `documents/Balance_Report.md`

다음을 기록한다.

- 검증 날짜
- rule version
- card data version
- 사용한 deck ID
- 사용한 scenario ID
- seed 목록 또는 seed 생성 정책
- sample 수
- 승률
- 평균/중앙 종료 턴
- 종료 사유 분포
- 지배력 overload 비율
- AI illegal action 건수
- replay mismatch 건수
- 조정 필요 카드나 시나리오

### `documents/Release_Checklist.md`

다음을 체크리스트로 기록한다.

- build 통과
- lint 통과
- format check 통과
- unit/integration test 통과
- 카드 데이터 검증 통과
- generated asset 검증 통과
- replay deterministic 검증 통과
- balance 검증 통과
- performance budget 검증 통과
- 정적 배포 smoke 통과
- 원작 보호 대상 문자열 audit 통과
- import boundary audit 통과

### `documents/Deployment.md`

다음을 기록한다.

- `npm install`
- `npm --silent run build`
- 정적 서버로 `dist/` 확인
- Docker image build/run 절차
- Nginx 설정 배치 절차
- base path 변경 시 주의사항
- cache invalidation 기준
- rollback 기준

## 9. 테스트 요구사항

Phase14에서 추가하거나 보강하는 테스트는 다음을 만족해야 한다.

- 정상 케이스와 실패 케이스를 모두 포함한다.
- seed 기반 deterministic 케이스를 포함한다.
- replay 재생과 state hash 검증을 포함한다.
- AI가 불법 행동을 만들지 않는지 확인한다.
- Phaser가 필요한 검증은 smoke 수준으로 제한하고, 대부분은 pure helper로 검증한다.
- 배포 관련 테스트는 build 후 산출물을 읽어 asset 누락을 확인한다.
- 보호 대상 문자열 audit을 포함한다.
- 룰 엔진 import boundary audit을 유지한다.

## 10. 완료 검증 명령

Phase14 완료 전 다음 명령을 실행하고 결과를 기록한다.

```bash
npm --silent run build
npm run lint
npm run format:check
npm test -- --reporter=dot
npm run generate:cards:check
npm run check:balance
npm run check:artifacts
npm run check:performance
npm run check:release
```

개발 서버 확인이 필요한 경우 다음을 실행한다.

```bash
npm run dev -- --host 127.0.0.1
```

정적 배포 smoke가 필요한 경우 production build 이후 `dist/`를 정적 서버로 제공하고 브라우저에서 초기 화면이 열리는지 확인한다.

추가 audit:

```bash
rg -n "from ['\"]\\.\\.?/.*/(scenes|ui|assets/cards)|from ['\"]phaser|document\\.|window\\." src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai
rg -n "Math\\.random\\(|Date\\.now\\(|new Date\\(" src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai src/scenes src/ui
rg -n "창각|創刻|アテリアル" src tests card-data generated
```

첫 번째와 두 번째 audit은 허용된 테스트 fixture나 문서 외에는 매치가 없어야 한다. 세 번째 audit은 보호 대상 문자열이 코드, 테스트, 카드 데이터, 생성 산출물에 새로 들어가지 않았는지 확인한다.

## 11. Phase14 완료 후 남겨야 할 경계

Phase14가 끝나도 다음은 범위 밖으로 유지한다.

- PvP matchmaking
- 실시간 네트워크 동기화
- 서버 권위 판정
- 계정, 결제, 클라우드 저장
- 장기 성장/보상 시스템
- 고급 덱 빌더
- 대규모 카드 팩 제작
- 원작 데이터 기반 밸런스 복제
- 복잡한 라이브 운영 도구

Phase14 완료 산출물은 “로컬/정적 배포 가능한 릴리스 후보”다. 이후 단계가 있다면 새 콘텐츠 확장, 덱 빌더, 캠페인 진행도, 고급 연출, 접근성, 장기 운영 도구를 별도 Phase로 분리한다.
