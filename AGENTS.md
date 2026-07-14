# ElvenBattle Agent Guide

이 문서는 ElvenBattle 저장소에서 작업하는 사람과 에이전트의 기본 개발 규칙이다. 작업 전 현재 브랜치, 작업 트리, 관련 이슈와 실제 구현을 먼저 확인하고, 기존 사용자 변경을 보존한다.

규칙의 우선순위는 다음과 같다.

1. 사용자의 현재 요청과 이슈의 명시적 범위
2. 저장소의 실제 설정과 스키마: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `cards/*.schema.json`
3. `assets/README.md`, `documents/Comment_Rule.md`, 이 문서
4. 적용 중인 외부 스킬이나 일반적인 프레임워크 관례

충돌하거나 오래된 설명이 있으면 추측하지 말고 위의 상위 source of truth를 따른다.

## Repository Map

- `src/game/`: Phaser에 의존하지 않는 전투 규칙, 카드·덱·장비·성장, 저장 상태, 스테이지 진행, 자산 manifest 해석
- `src/phaser/scenes/`: Phaser Scene과 도메인 상태의 통합, 화면 전환, 입력 전달, 월드 렌더링
- `src/phaser/ui/`: Canvas UI 생성 경계와 UI 아키텍처 테스트. 중심 API는 `CanvasUiFactory.ts`
- `src/phaser/plugins/sequence/`: 범용 연출 시퀀스. `SequencePlugin.ts`, `AnimationSequence.ts`, `sequence-types.ts`가 한 계약을 이룬다.
- `src/phaser/config/`: 1920x1280 가상 해상도, FIT 스케일, Scene 및 rexUI 등록
- `src/theme.ts`: Canvas UI와 DOM UI가 공유하는 semantic 색상·텍스트·surface 토큰
- `src/server/`: `/tcg` 자산과 `/api/save-slots` 서버 미들웨어
- `src/tools/card-text/`, `tools/card-text/`: 카드 텍스트 도구의 서버·클라이언트와 별도 HTML 진입점
- `src/config.ts`: `ELVEN_BATTLE_*` 환경 변수와 서버·캡처·자산 기본 설정
- `cards/`: 카드·덱 정의, 스테이지 JSON, `card.schema.json`, `stage.schema.json`. `cards/temp/`는 임시 산출물이다.
- `assets/`: 로컬 런타임 자산. Git에는 `assets/README.md`만 유지하며 `assets/assets.json`은 생성물이다.
- `.data/save-slots/`: 로컬 저장 슬롯 상태. 소스나 테스트 fixture로 간주하지 않는다.
- `documents/`: 프로젝트 규칙과 참고 문서
- `index.html`, `tools/card-text/index.html`: Vite가 함께 빌드하는 두 진입점

## Setup and Run

의존성은 root의 `package-lock.json`을 기준으로 설치한다.

```bash
npm ci
npm run dev
```

- 개발 서버는 기본적으로 `0.0.0.0:3010`을 strict port로 사용한다.
- 서버 값은 `.env`의 `ELVEN_BATTLE_HOST`, `ELVEN_BATTLE_PORT`, `ELVEN_BATTLE_STRICT_PORT`, `ELVEN_BATTLE_ALLOWED_HOSTS`, `ELVEN_BATTLE_CAPTURE_HOST`, `ELVEN_BATTLE_ASSET_BASE_URL`, `ELVEN_BATTLE_DATA_ROOT`로 덮어쓸 수 있다.
- 게임은 `/`, 카드 텍스트 도구는 `/tools/card-text/index.html`에서 실행한다.
- production 결과 확인은 `npm run preview`를 사용한다.
- fresh clone에는 런타임 `assets/`와 `.data/`가 없을 수 있다. 존재한다고 가정하거나 임의 fixture로 커밋하지 않는다.

## Commands

- `npm run dev`: Vite 개발 서버
- `npm run build`: `tsc -b`와 `vite build`를 실행하는 필수 production 검증
- `npm run lint`: 전체 ESLint 검사
- `npm run format`: 전체 파일에 Prettier 적용
- `npm run format:check`: 포맷 변경 없이 전체 검사
- `npx vitest run`: 전체 Vitest 실행. 현재 별도 `npm test` script는 없다.
- `npx vitest run <test-file...>`: 변경 범위의 테스트만 빠르게 실행
- `npm run assets:build`: 로컬 자산을 스캔해 `assets/assets.json` 재생성

무관한 파일까지 바꾸는 전체 포맷은 피한다. 필요하면 먼저 수정 파일만 Prettier로 정리하고, 최종 gate에서 `npm run format:check`를 실행한다.

## Working Method

1. `git status --short --branch`로 브랜치와 기존 변경을 확인한다.
2. 관련 이슈 본문·댓글, 구현, 테스트, 설정을 읽어 현재 동작과 책임 모듈을 찾는다.
3. 가장 좁은 소유 모듈에서 변경하고, 중복 Helper나 우회 경로를 만들지 않는다.
4. 동작 변경과 함께 같은 경계의 테스트를 추가하거나 갱신한다.
5. 변경 범위에 맞는 테스트를 먼저 실행한 뒤 lint, build, format 검사를 수행한다.
6. 최종 diff와 `git status`를 확인해 생성물·로컬 데이터·무관한 변경이 섞이지 않았는지 검토한다.

요청이 진단이나 확인만을 요구하면 코드를 수정하지 않는다. 구현 요청이어도 명시된 범위를 넘어서는 리팩터링, 의존성 추가, 외부 상태 변경은 하지 않는다.

## Shared Helper First

저장소 공용 Helper가 책임지는 기능을 Scene이나 기능 파일에서 다시 구현하지 않는다. 먼저 기존 API를 사용하고, 현재 API가 재사용 가능한 요구를 표현하지 못할 때는 소유 모듈의 타입·구현·테스트를 함께 확장한다. 한 화면에만 필요한 도메인 규칙을 억지로 전역화하지 않으며 mutable singleton도 만들지 않는다.

### Canvas UI

- Canvas UI 생성, 입력 표면, semantic 스타일, rexUI layout 조립은 `src/phaser/ui/CanvasUiFactory.ts`를 사용한다.
- Scene은 `CanvasUiFactory`가 반환한 구체 GameObject를 배치·갱신할 수 있지만 `this.rexUI.add.*`나 `this.add.text()`를 직접 호출하지 않는다.
- Battlefield의 보드, 카드, 드래그 프리뷰, 월드 이펙트 같은 월드 렌더링만 Phaser GameObject 직접 생성을 허용한다. Canvas UI에는 이 예외를 적용하지 않는다.
- 새 UI 표현은 Scene에 raw 색상, 폰트, `TextStyle`을 넣기 전에 `src/theme.ts`의 semantic variant를 추가한다.
- 필요한 UI primitive나 rexUI 옵션이 없으면 Scene 로컬 wrapper를 만들지 말고 `CanvasUiFactory`의 config 타입과 메서드를 확장한다. `CanvasUiFactory.test.ts`와 `ui-boundary.test.ts`도 함께 갱신한다.
- 텍스트가 많고 반응형 상호작용이 중요한 HUD·설정·서사 화면은 DOM overlay가 더 적합한지 먼저 판단한다. DOM UI는 Factory로 감싸지 않되 Theme 토큰을 공유한다.

### Animation and Presentation Sequences

- 시간축이 있는 wait, shake, video, custom 연출, 입력 잠금, 공통 재생속도는 `src/phaser/plugins/sequence/SequencePlugin.ts`와 `AnimationSequence`를 사용한다.
- 재사용 가능한 새 step은 Scene의 `delayedCall`·Tween 체인으로 복제하지 말고 `sequence-types.ts`의 계약, `SequencePlugin`, builder, 테스트를 함께 확장한다.
- `SequencePlugin`은 전투 판정이나 저장 상태를 소유하지 않는다. Scene이 확정된 GameObject, 좌표, 안정적인 manifest key와 실행 순서만 전달한다.
- plugin은 사용하는 Scene의 lifecycle에 맞춰 한 번 만들고, Scene `SHUTDOWN`에서 `destroy()`해 timer, tween, 대기 중 Promise를 정리한다.
- 브라우저별 자산 선택이나 파일 경로 분기는 Sequence step과 gameplay ID에 넣지 않는다. manifest·Loader 경계에서 같은 안정적 key에 맞는 자산을 선택한다.
- Sequence 계약 변경은 `SequencePlugin.test.ts`와 실제 Scene 통합 테스트를 함께 확인한다.

### Other Shared Boundaries

- 서버·자산 설정은 `src/config.ts`의 `appConfig`를 사용하고 환경 변수를 다른 파일에서 다시 파싱하지 않는다.
- 자산 URL과 manifest 호환 처리는 `src/game/assets/manifest.ts`, 정적 제공은 `src/server/assets-middleware.ts`를 확장한다. Scene에 URL 조합을 복제하지 않는다.
- 저장 슬롯 HTTP 흐름은 `src/game/save/client-api.ts`와 `src/server/save-slots-api.ts`의 기존 validation·오류 계약을 따른다.
- 같은 계산이나 정책이 두 곳 이상에서 필요하면 책임이 맞는 `src/game`, `src/phaser`, `src/server` 모듈로 올리고 공개 API와 테스트를 함께 추가한다.

## Engineering Conventions

- TypeScript는 `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`를 지킨다.
- `any`와 넓은 타입 단언으로 오류를 숨기지 않는다. 외부 JSON, URL, 저장 데이터는 런타임 검증 후 좁힌다.
- 클래스, public 메서드, 의미 있는 top-level 함수와 새 public API에는 `documents/Comment_Rule.md`에 맞는 간결한 한국어 TSDoc을 작성한다.
- 단순 private/helper와 함수 본문에는 설명을 반복하는 주석을 추가하지 않는다.
- 게임 규칙과 저장 가능한 상태는 `src/game`이 소유한다. Scene은 입력을 action으로 전달하고 상태를 읽어 렌더링한다.
- Scene `update()`에 전투 규칙이나 영속 상태 변경을 누적하지 않는다.
- Sprite, Container, Tween, emitter, camera rig는 disposable view state이며 source of truth가 아니다.
- Scene 간 데이터는 명시적인 scene-data나 저장·도메인 API로 전달하고 mutable global object를 사용하지 않는다.
- 카메라, hit-stop, 흔들림, parallax는 규칙과 분리하고 전투 가독성을 우선한다.
- 기존 파일명, export 이름, 도메인 용어, manifest key를 우선하며 불필요한 호환 alias나 dead code를 남기지 않는다.

## Data, Assets, and Server Constraints

- 카드 변경은 `cards/card.schema.json`, 스테이지 변경은 `cards/stage.schema.json`과 기존 loader를 따른다.
- 저장 데이터는 schema version과 validation을 유지한다. 전투 중 mutation을 위해 저장 세션의 카드 인스턴스 참조를 공유하지 않는다.
- `assets/` 파일 경로를 gameplay 코드에 하드코딩하지 않고 사람이 읽을 수 있는 안정적인 manifest key를 사용한다.
- 자산 변경 후에만 `npm run assets:build`를 실행한다. `assets/assets.json`, 로컬 이미지·폰트·영상은 커밋 대상으로 취급하지 않는다.
- `/tcg`, `/api/save-slots`, `/api/card-text-tool` 또는 Vite middleware 순서를 바꾸면 해당 서버 테스트와 두 HTML build input을 모두 확인한다.
- 경로, URL, JSON 입출력에는 Node·Web 표준 API를 사용하고 traversal, malformed input, 네트워크 실패를 명시적으로 처리한다.
- 비동기 로딩 실패는 가능한 범위에서 복구·재시도 가능하게 만들고 사용자 흐름을 불필요하게 끊지 않는다.

## Do Not

- 기존 사용자 변경을 덮어쓰거나 요청 없이 `git reset --hard`, checkout 복원, 대량 삭제를 실행하지 않는다.
- 요청 없이 commit, push, branch 생성, PR 작성 또는 이슈 수정을 하지 않는다.
- `.env`, credential, `.data/`, `dist/`, coverage, 임시 캡처, 로컬 runtime asset을 커밋하지 않는다.
- 의존성 변경 없이 `package-lock.json`을 갱신하지 않는다.
- Scene에서 rexUI를 직접 import하거나 `this.rexUI.add.*`, 직접 `this.add.text()`, raw Canvas UI 스타일로 Factory 경계를 우회하지 않는다.
- Scene 로컬 timer/Tween 조합으로 이미 `SequencePlugin`이 소유하는 연출 정책을 중복 구현하지 않는다.
- 스프라이트·Tween 완료 여부에 게임 규칙의 정답을 의존시키지 않는다.
- fresh clone에 ignored asset이나 save slot이 있다고 가정하지 않는다.
- schema를 우회한 임의 JSON, 무검증 저장 데이터, 브라우저별로 달라지는 gameplay key를 도입하지 않는다.

## Tests and Verification

변경과 가장 가까운 테스트를 실행하고, 위험 경계에 따라 검증을 확장한다.

- 전투·턴·카드 효과: 관련 `src/game/**/*.test.ts`
- 저장·덱·장비·성장: 관련 save 모듈 테스트와 필요 시 save-slot API 테스트
- Canvas UI·Scene 경계: `npx vitest run src/phaser/ui/CanvasUiFactory.test.ts src/phaser/ui/ui-boundary.test.ts`
- 전투 Scene 통합: `src/phaser/scenes/BattlefieldScene.test.ts`
- Sequence: `src/phaser/plugins/sequence/SequencePlugin.test.ts`
- manifest·자산 URL: `src/game/assets/manifest.test.ts`와 자산 middleware 동작
- Vite API·도구: 관련 server 테스트, main과 card-text 두 build entry

화면 배치, 입력, 카메라, 영상처럼 단위 테스트만으로 증명할 수 없는 변경은 1920x1280 가상 해상도의 desktop·mobile FIT 표시와 실패·재시도 흐름을 수동 또는 브라우저 테스트로 확인한다.

## Definition of Done

작업 완료는 다음 조건을 모두 만족할 때만 선언한다.

- 요청과 이슈의 완료 조건을 빠짐없이 구현했고 범위 밖 동작은 바뀌지 않았다.
- 새 동작과 회귀 위험을 검증하는 관련 Vitest가 통과한다.
- `npm run lint`, `npm run build`, `npm run format:check`가 통과한다.
- 자산 변경 시 `npm run assets:build`, schema·서버·UI·Sequence 변경 시 위의 전용 검증을 수행했다.
- public API, schema, manifest key 또는 저장 형식의 호환 영향과 migration 필요 여부를 검토했다.
- 최종 diff에 dead code, 우회 Helper, 무관한 포맷 변경, generated/local 파일, 비밀정보가 없다.
- 사용자에게 변경 요약, 실행한 검증, 남은 수동 확인이나 알려진 제한을 정확히 전달한다.

## PR Expectations

- PR은 하나의 이슈·목적에 집중하고 drive-by 리팩터링을 섞지 않는다.
- 제목과 commit은 기존처럼 `feat:`, `fix:`, `test:`, `docs:`, `refactor:` 등 명확한 type과 짧은 요약을 사용한다.
- 본문에는 사용자 관점의 변화, 책임 모듈과 공용 Helper 변경, 호환성·schema·asset 영향, 실행한 명령과 결과를 적는다.
- 시각 변경에는 필요한 경우 before/after 캡처나 재현 절차를 제공하되 로컬 캡처 파일 자체를 소스에 남기지 않는다.
- 리뷰 전에 전체 diff와 새 파일을 확인하고, 관련 이슈의 완료 조건과 Definition of Done을 체크한다.
