# ElvenBattle 개발 규칙

이 문서는 현재 작업 디렉토리의 개발 진행 방법을 최우선 기준으로 삼고, 그 다음 기준으로 `game-studio:phaser-2d-game` 스킬의 Phaser 2D 게임 구조 원칙을 적용한다.

규칙이 충돌하면 이 저장소의 `package.json`, `vite.config.ts`, `tsconfig*.json`, `assets/README.md`, `documents/Comment_Rule.md`를 먼저 따른다.

## Overview

- 기본 스택은 Phaser, TypeScript, Vite이다.
- TypeScript는 `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` 기준을 지킨다.
- 개발 서버는 Vite를 사용하며 `npm run dev`로 실행한다.
- 기본 서버 설정은 `src/config.ts`의 `ELVEN_BATTLE_*` 환경 변수 규칙을 따른다.
- 빌드는 `npm run build`로 검증한다. 이 명령은 `tsc -b`와 `vite build`를 함께 수행한다.
- 린트는 `npm run lint`, 포맷은 `npm run format` 또는 `npm run format:check`를 사용한다.
- 테스트가 필요한 변경은 Vitest 기준으로 작성하고, 현재 스크립트가 없으면 `npx vitest run`으로 실행한다.
- 클래스, public 메서드, 의미 있는 top-level 함수에는 한국어 TSDoc을 작성한다.
- 단순 private/helper 함수와 함수 본문 내부에는 불필요한 주석을 추가하지 않는다.

## Development Workflow

- 변경 전에는 관련 파일과 기존 패턴을 먼저 읽는다.
- 작은 기능도 기존 모듈 경계와 이름 규칙을 우선한다.
- 실행 흐름을 바꾸는 변경은 `npm run lint`, `npm run build`, 관련 Vitest 테스트로 확인한다.
- 자산이 바뀌면 `npm run assets:build`로 `assets/assets.json`을 다시 생성한다.
- `assets/`의 런타임 자산은 로컬 생성물이다. fresh clone에 존재한다고 가정하지 않는다.
- 저장 슬롯 데이터는 `.data/save-slots` 아래 로컬 상태로 취급한다.
- 카드 정의는 `cards/*.json`과 `cards/card.schema.json`의 구조를 우선한다.
- Vite 플러그인에 붙은 `/tcg`, `/api/save-slots`, `/api/card-text-tool` 흐름을 수정할 때는 서버 미들웨어 테스트를 함께 확인한다.

## Architecture

- 게임 규칙과 저장 가능한 상태는 Phaser Scene 밖에 둔다.
- Scene은 자산 로딩, 화면 전환, 스프라이트 배치, 입력 전달, 효과 재생을 담당한다.
- 전투, 턴 순서, 카드 효과, 이동, 저장 상태, 진행도는 별도 시스템이나 도메인 모듈이 소유한다.
- Scene과 도메인 상태 사이에는 명확한 통합 지점을 둔다.
- 스프라이트, 컨테이너, tween, emitter, 카메라 rig는 렌더링 상태이며 source of truth가 아니다.
- 자산은 파일 경로를 직접 흩뿌리지 말고 manifest key를 기준으로 참조한다.
- 장기적으로 모듈을 나눌 때는 `src/game`, `src/phaser`, `src/ui` 역할을 분리한다.
- `src/game`은 시뮬레이션, 저장 상태, 카드/덱 규칙, authored content를 담당한다.
- `src/phaser`는 Boot/Menu/Battle 같은 Scene, view helper, camera, adapter를 담당한다.
- `src/ui`는 DOM HUD, 메뉴, 오버레이, 설정 화면을 담당한다.

## Implementation Guidance

- Scene의 `update()`에 게임 규칙을 직접 누적하지 않는다.
- 입력은 action으로 변환해서 시스템에 전달하고, Scene은 시스템 상태를 읽어 표시한다.
- 비동기 로딩 실패는 가능한 범위에서 복구 가능하게 처리하고, 사용자 흐름을 불필요하게 끊지 않는다.
- 저장 데이터는 schema version과 validation을 유지한다.
- JSON 입출력, 경로 처리, URL 처리에는 표준 API를 사용한다.
- 타입 단언은 최소화하고, 외부 입력은 런타임 검증 후 사용한다.
- 새 public API나 중요한 도메인 함수에는 한국어 TSDoc으로 의도, 부작용, 예외 조건을 설명한다.
- Phaser Scene 클래스는 클래스 역할과 lifecycle 메서드의 책임을 한국어 TSDoc으로 설명한다.
- 현재처럼 초기 Scene이 한 파일에 모여 있을 수 있지만, 기능이 커지면 Scene, 도메인 시스템, UI를 분리한다.

## Camera and Presentation

- 카메라 모델은 기능 초기에 정한다. 예: 고정, follow, room 기반, tactical pan.
- 카메라 로직은 전투 규칙이나 이동 규칙과 분리한다.
- 화면 흔들림, hit-stop, parallax는 가독성을 해치지 않는 수준으로만 사용한다.
- Phaser canvas는 세계, 전투 가독성, 모션, 카드/캐릭터 표현을 담당한다.
- 텍스트가 많은 정보 화면은 canvas에 억지로 그리지 않는다.
- 1280x800 가상 해상도와 FIT scale 정책을 유지하는 변경은 모바일/데스크톱 표시를 함께 확인한다.

## UI Integration

- HUD, 명령 메뉴, 설정, 서사 패널처럼 텍스트 밀도가 높은 UI는 DOM overlay를 우선한다.
- Phaser 내부 UI는 월드 표현, 카드 배치, 전투 피드백처럼 canvas가 더 적합한 경우에 사용한다.
- Phaser Scene 내부 레이아웃 구성은 rexUI plugin의 Sizer/GridSizer/OverlapSizer를 직접 사용한다.
- 카드 텍스트 도구는 `tools/card-text/index.html`과 `src/tools/card-text` 흐름을 유지한다.
- Vite build input은 `index.html`과 `tools/card-text/index.html` 두 진입점을 고려한다.
- 버튼, 저장 슬롯, 메뉴 등 사용자 입력 흐름은 실패 상태와 재시도 상태를 포함한다.

## Asset Organization

- `assets/README.md`만 추적 대상으로 두는 현재 운영 원칙을 유지한다.
- `assets/assets.json`은 생성물이며, 로컬 자산 변경 후 재생성한다.
- 텍스처 key는 사람이 읽을 수 있고 안정적인 이름으로 유지한다.
- 이미지, 폰트, 카드 산출물은 `assets/`의 기대 레이아웃을 따른다.
- 생성 카드 이미지는 `cards/temp` 같은 임시 경로를 사용하고, 원본 카드 정의 JSON과 분리한다.

## Anti-Patterns

- Phaser Scene의 `update()`에 전투 규칙과 상태 변경을 직접 넣는 방식.
- Scene 사이에 mutable global object로 상태를 전달하는 방식.
- 스프라이트나 tween의 생명주기에 게임 상태 변경을 의존시키는 방식.
- 자산 파일 경로를 여러 곳에 직접 하드코딩하는 방식.
- 복잡한 HUD나 설정 화면을 편의상 Phaser Text로만 처리하는 방식.
- fresh clone에 로컬 `assets/` 파일이나 `.data/` 저장 데이터가 있다고 가정하는 방식.
- 타입 오류를 감추기 위해 불필요한 `any` 또는 넓은 타입 단언을 추가하는 방식.
- 기존 저장 슬롯 schema와 카드 schema를 우회해서 임의 JSON을 저장하는 방식.
