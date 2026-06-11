# Phase 9 목표 지시문 — 카드 Asset Pipeline 및 카드 렌더러 구축

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 카드 비주얼 규격, 카드 렌더러, 카드 데이터 기반 이미지 생성 파이프라인을 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 9를 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

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
- `AGENTS.md`

## Phase 9의 위치

`documents/Plan.md`에서 Phase 9는 다음 단계다.

- Phase 7: 전투 엔진 구현
- Phase 8: 효과 처리 엔진 구현
- Phase 9: 카드 Asset Pipeline 및 카드 렌더러 구축
- Phase 10: 승리 조건 및 게임 종료 구현
- Phase 11 이후: 저장/리플레이, AI, Phaser UI 및 PvE 구현

따라서 Phase 9는 Phase5에서 확정한 `CardDefinition` 데이터와 Phase8까지 구현한 룰 정보를 화면 표시용 카드 이미지로 변환하는 단계다. 승리 조건 확정, 저장 파일 포맷, 리플레이 재생기, AI 행동 탐색, Phaser 게임 UI 완성은 이후 Phase로 남긴다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- `card-data/`에는 독자 카드 정의 JSON만 둔다.
- `src/assets/`와 `generated/`에는 독자 제작 에셋과 자동 생성 산출물만 둔다.
- 카드 이미지는 표시용이다. 룰 판정은 항상 `CardDefinition` 원본 데이터와 런타임 `CardInstance` 상태를 기준으로 한다.
- 게임 중 변할 수 있는 코스트, 지배력, 공격력, 체력/HP 숫자는 최종 WebP에 고정하지 않고 Phaser UI의 `BitmapText`로 실시간 표시한다.
- 룰 엔진 계층은 Phaser, DOM, 브라우저 전역 객체, 이미지 생성 라이브러리에 의존하지 않는다.
- 카드 렌더러는 룰 엔진을 호출하지 않고, 정규화된 카드 정의와 로컬라이즈된 표시 문자열만 입력받는다.
- 카드 이미지 생성 결과는 같은 입력 데이터, 같은 렌더러 버전, 같은 에셋 원천에서 항상 같은 파일명과 manifest를 만든다.
- `generated/`의 자동 생성 산출물은 기본적으로 추적하지 않는다. 필요한 안내 파일과 manifest 정책만 명확히 한다.
- Phase9에서는 카드 WebP 생성 파이프라인을 구축하되, 대량 일러스트 제작이나 외부 이미지 생성 API 연동은 범위 밖이다.
- 기본 카드 프레임은 2:3 비율을 기준으로 한다. 기준 작업 해상도는 1024 x 1536 px이고, 축소 출력은 512 x 768 px을 사용한다.
- 새 의존성은 WebP 변환이나 이미지 합성처럼 현재 표준 도구만으로 처리하기 어려운 경우에만 추가하고, 추가 이유를 문서나 커밋 설명에 남긴다.

## Phase 9 최종 목표

다음 기능을 구현한다.

- 카드 비주얼 규격 정의
- 카드 표시 데이터 정규화
- 카드 타입, 희귀도, 지배력, 전투 수치의 표시 규칙 정의
- 카드 프레임 테마와 레이아웃 토큰 정의
- 풀 일러스트 창, 숫자 배지, 스킬 텍스트 overlay 레이어의 고정 좌표 정의
- Phaser `BitmapText`용 동적 숫자 오버레이 슬롯 정의
- 독자 일러스트 원천 파일 관리 구조 정의
- 일러스트가 없을 때 사용할 deterministic placeholder 생성
- `CardDefinition` 기반 카드 SVG 또는 중간 렌더 결과 생성
- WebP 카드 이미지 생성 파이프라인 구축
- 생성 산출물 manifest 작성
- 카드 이미지 파일명과 경로 규칙 고정
- 렌더러 단위 테스트와 파이프라인 smoke test 작성
- Phaser UI가 나중에 사용할 수 있는 asset manifest 확장 지점 준비

Phase 9 완료 시점에는 다음이 가능해야 한다.

- `card-data/examples/*.json`의 독자 카드 정의를 읽어 카드 표시 모델로 변환할 수 있다.
- 카드 표시 모델은 `cardId`, 카드명 표시 문자열, 비용, 지배력, 공격력, 체력, 스킬 텍스트, 카드 타입, 희귀도를 포함한다.
- 변화 가능한 숫자는 정적 카드 베이스 이미지와 분리되어 `BitmapText` overlay slot으로 표현된다.
- `UNIT`, `TACTIC`, `ONGOING`, `TOKEN` 카드 타입별로 표시 레이아웃이 깨지지 않는다.
- `UNIT`이 아닌 카드는 공격력/체력 영역을 비우거나 타입에 맞는 대체 표시를 한다.
- 지배력 비용, 지배력 제공값, 지배력 요구값을 서로 혼동하지 않고 구분해 표시한다.
- `abilities[].textKey`와 `effectScript`는 룰 값과 표시 텍스트를 분리해 처리한다.
- 표시 문자열이 없는 경우에도 렌더러가 실패하지 않고 명확한 fallback 문자열을 사용한다.
- 같은 입력에서 같은 SVG 또는 중간 렌더 결과와 같은 WebP 파일명이 생성된다.
- 생성 결과는 `generated/cards/` 아래에 저장된다.
- 생성 산출물 manifest는 카드 ID, 카드 데이터 버전, 렌더러 버전, 파일 경로, 크기, 해시를 포함한다.
- WebP 생성 명령을 반복 실행해도 불필요한 변경이나 비결정적 파일명이 생기지 않는다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/assets/cards/types.ts` | 카드 렌더링 입력, 표시 모델, manifest 타입 |
| `src/assets/cards/display.ts` | `CardDefinition`을 표시 모델로 정규화 |
| `src/assets/cards/layout.ts` | 카드 크기, 안전 영역, 텍스트 영역, 아이콘 위치 정의 |
| `src/assets/cards/theme.ts` | 타입/희귀도별 색상, 프레임, 텍스트 스타일 토큰 |
| `src/assets/cards/overlay.ts` | Phaser `BitmapText`용 동적 숫자 슬롯 정의 |
| `src/assets/cards/text.ts` | nameKey/textKey fallback과 표시 문자열 포맷 |
| `src/assets/cards/svg.ts` | 카드 SVG 또는 중간 렌더 마크업 생성 |
| `src/assets/cards/placeholder.ts` | 일러스트 미지정 카드의 deterministic placeholder 생성 |
| `src/assets/cards/manifest.ts` | 생성 산출물 manifest 작성과 검증 |
| `src/assets/cards/index.ts` | Phase9 Card Asset API re-export |
| `src/assets/README.md` | 카드 에셋 원칙과 원천 파일 구조 보강 |
| `card-data/README.md` | 표시 텍스트와 룰 값 분리 원칙 보강 |
| `scripts/generate-card-assets.*` | 카드 데이터에서 WebP와 manifest를 생성하는 CLI |
| `generated/README.md` | `generated/cards/` 산출물 정책 보강 |
| `tests/card-display-model.test.ts` | 카드 표시 모델 변환 테스트 |
| `tests/card-renderer.test.ts` | SVG 또는 중간 렌더 결과 안정성 테스트 |
| `tests/card-asset-manifest.test.ts` | manifest 경로, 해시, 버전 테스트 |
| `tests/card-asset-pipeline.test.ts` | 예시 카드 기반 생성 파이프라인 smoke test |

`scripts/generate-card-assets.*`의 확장자는 저장소 설정에 맞게 선택한다. TypeScript 실행을 위해 새 실행 도구를 추가해야 한다면 이유를 명시하고, 불필요한 런타임 의존성은 추가하지 않는다.

## 2. 카드 표시 모델

렌더러는 `CardDefinition`을 직접 화면에 그리지 않고 표시 전용 모델을 입력받는다.

권장 타입:

```ts
export interface CardDisplayModel {
  cardId: string;
  name: string;
  type: 'UNIT' | 'TACTIC' | 'ONGOING' | 'TOKEN';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'BOSS' | 'TOKEN';
  cost: number;
  dominanceCost: number;
  dominanceValue: number;
  dominanceRequirement: number | null;
  attack: number | null;
  health: number | null;
  faction: string | null;
  attribute: string | null;
  tags: string[];
  rulesText: string[];
  artKey: string;
  runtimeNumberSlots: CardRuntimeNumberSlot[];
}

export interface CardRuntimeNumberSlot {
  field:
    | 'COST'
    | 'DOMINANCE_COST'
    | 'DOMINANCE_VALUE'
    | 'DOMINANCE_REQUIREMENT'
    | 'ATTACK'
    | 'HEALTH';
  x: number;
  y: number;
  anchor: 'CENTER' | 'LEFT' | 'RIGHT';
  align: 'CENTER' | 'LEFT' | 'RIGHT';
  fontKey: string;
  maxDigits: number;
}
```

변환 정책:

- `nameKey`는 표시 문자열 조회의 key로 사용한다.
- 표시 문자열 사전이 없으면 `nameKey` 자체 또는 `cardId` 기반 fallback을 사용한다.
- `abilities[].textKey`가 있으면 표시 문자열 조회 대상으로 사용한다.
- 표시 문자열이 없는 ability는 `effectScript.id` 또는 `abilityId` 기반 fallback을 사용한다.
- `rarity`가 없으면 `COMMON`으로 표시한다.
- `dominanceCost`, `dominanceValue`가 없으면 0으로 표시한다.
- `dominanceRequirement`가 없으면 `null`로 표시하고 요구값 영역은 숨긴다.
- `UNIT` 카드만 `attack`, `health`를 숫자로 표시한다.
- `TACTIC`, `ONGOING`, `TOKEN`의 전투 수치는 `null`로 정규화한다. 단, `TOKEN`이 유닛 토큰으로 확장될 수 있는 여지는 남긴다.
- 룰 텍스트와 렌더링 텍스트는 카드 데이터의 숫자 룰 값을 대체하지 않는다.
- `runtimeNumberSlots`는 Phaser UI가 현재 `CardInstance`와 룰 상태에서 읽은 값을 `BitmapText`로 표시하기 위한 좌표와 렌더링 metadata다.
- 기본 카드 WebP에는 `runtimeNumberSlots`의 숫자값을 굽지 않는다. 필요한 경우에만 개발용 preview 렌더에서 기본값을 합성할 수 있다.

## 3. 카드 비주얼 규격

Phase9 카드 이미지는 MVP에서 다음 규격을 따른다.

| 항목 | 기준 |
|---|---|
| 기본 비율 | 2:3 |
| 기준 작업 크기 | 1024 x 1536 px |
| 축소 출력 크기 | 512 x 768 px |
| 출력 형식 | WebP |
| 중간 형식 | SVG 또는 renderer 내부 모델 |
| 안전 영역 | 바깥 24 px 이내 주요 텍스트 배치 금지 |
| 일러스트 영역 | 중앙 대부분을 차지하는 풀 일러스트 창, `#FF00FF` overlay 창으로 관리 |
| 스킬 텍스트 overlay | 기본 프레임에는 패널을 만들지 않고, Phaser UI에서 반투명 레이어로 표시 |
| 이름 영역 | 일러스트 위 또는 별도 UI 레이어에 1줄 우선, 긴 텍스트는 축소 또는 줄바꿈 |
| 비용 영역 | 좌상단 고정, 숫자는 `BitmapText` overlay |
| 지배력 영역 | 비용과 구분되는 별도 위치, 숫자는 `BitmapText` overlay |
| 공격/체력 영역 | 유닛 카드 하단 좌우 고정, 숫자는 `BitmapText` overlay |
| 스킬 텍스트 영역 | 풀 일러스트 위 반투명 overlay 내부, 최대 줄 수와 overflow 정책 고정 |
| 카드 타입/희귀도 | 프레임 또는 하단 라벨로 표시 |

레이아웃 정책:

- 카드 프레임은 타입과 희귀도에 따라 구분하되, 한 가지 색상 계열만으로 전체를 채우지 않는다.
- 카드명, 비용, 지배력, 공격력, 체력은 작은 크기에서도 읽을 수 있어야 한다.
- 긴 `name`과 긴 `rulesText`는 카드 영역 밖으로 넘치지 않아야 한다.
- 아이콘이나 숫자 배지는 레이아웃을 밀어내지 않는 고정 크기 영역을 사용한다.
- 기본 프레임 이미지에는 스킬 텍스트 전용 하단 패널을 만들지 않는다.
- 스킬 텍스트는 일러스트 위에 얹는 반투명 overlay 레이어로 처리하며, 카드 타입별 프레임 변형이 있어도 기본 좌표계는 유지한다.
- 변화 가능한 숫자 영역은 배경, 아이콘, 장식만 정적 이미지에 포함하고 숫자 glyph 자체는 Phaser `BitmapText`가 그린다.
- 원작 UI, 프레임, 심볼, 색상 조합을 복제하지 않는다.

## 4. 동적 숫자 Overlay 정책

Phase9 manifest는 Phase13 Phaser UI가 카드 위에 `BitmapText`를 올릴 수 있도록 숫자 슬롯 metadata를 제공한다.

동적 숫자 필드:

| 필드 | 런타임 원천 | 설명 |
|---|---|---|
| `COST` | `CardDefinition.cost`와 효과로 조정된 사용 비용 | 손패/선택 UI에서 변할 수 있는 카드 사용 비용 |
| `DOMINANCE_COST` | `CardDefinition.dominanceCost`와 modifier | 전장 유지 점유량 |
| `DOMINANCE_VALUE` | `CardDefinition.dominanceValue`와 modifier | 전장 장악 점수 |
| `DOMINANCE_REQUIREMENT` | `CardDefinition.dominanceRequirement`와 조건 효과 | 사용 또는 효과 조건 |
| `ATTACK` | `CardInstance.currentAttack` 및 modifier 계산값 | 현재 공격력 |
| `HEALTH` | `CardInstance.currentHealth`, damage, modifier 계산값 | 현재 남은 체력 또는 HP 표시 |

정책:

- `runtimeNumberSlots`는 카드 좌상단 기준 좌표계를 사용한다.
- 좌표는 기준 작업 크기 1024 x 1536 px 기준으로 정의한다.
- 512 x 768 px 축소 출력에서는 좌표를 0.5배로 스케일링한다.
- manifest에는 field, x, y, anchor, align, fontKey, maxDigits를 포함한다.
- 숫자 배경과 아이콘은 정적 WebP에 포함할 수 있다.
- 실제 숫자 glyph는 Phaser UI가 현재 상태를 읽어 `BitmapText`로 렌더링한다.
- preview용 이미지가 필요하면 `includeRuntimeDefaults` 같은 명시 옵션으로만 기본 숫자를 합성한다.
- 룰 엔진은 overlay metadata를 사용하지 않는다.

스킬 텍스트 overlay 정책:

- 기본 카드 프레임 WebP에는 스킬 텍스트 패널, 문구, 가짜 줄글을 굽지 않는다.
- 스킬 텍스트는 Phaser UI가 일러스트 위에 반투명 배경 레이어와 텍스트 레이어를 별도로 올린다.
- manifest에는 skillTextOverlay의 x, y, width, height, padding, backgroundColor, backgroundAlpha, fontKey, maxLines를 포함할 수 있다.
- overlay 기본 위치는 카드 하단부를 권장하지만, 일러스트 영역 위에 겹치는 UI 레이어로 취급한다.
- overlay는 표시 레이어이므로 룰 엔진과 카드 이미지 생성 파이프라인의 판정 기준이 아니다.

## 5. 독자 일러스트와 Placeholder

Phase9는 일러스트 관리 구조를 만들지만, 대량 일러스트 제작은 목표가 아니다.

권장 구조:

```text
src/assets/
├─ README.md
└─ cards/
   ├─ README.md
   ├─ art/
   │  └─ README.md
   └─ frames/
      └─ README.md
```

정책:

- `src/assets/cards/art/`에는 직접 제작했거나 사용 권한이 명확한 독자 원천 파일만 둔다.
- 원작 이미지, 원작 캐릭터, 원작 UI 캡처, 원작 심볼은 넣지 않는다.
- 카드 정의에는 렌더러가 찾을 수 있는 `artKey` 확장 지점을 둘 수 있으나, Phase9에서 `CardDefinition` 필드를 크게 변경하지 않는다.
- `artKey`가 없으면 `cardId`, `type`, `rarity`를 입력으로 deterministic placeholder를 만든다.
- placeholder는 단순 색상 배경만으로 끝내지 말고 타입/속성/희귀도를 구분할 수 있는 패턴을 포함한다.
- placeholder 결과도 같은 입력에서 같은 이미지가 생성되어야 한다.

## 6. WebP 생성 파이프라인

필수 CLI:

- `npm run generate:cards`

권장 보조 CLI:

- `npm run generate:cards:check`

기본 처리 순서:

1. `card-data/examples/` 또는 지정된 카드 데이터 디렉터리를 읽는다.
2. 기존 `parseCardDefinition`으로 카드 JSON을 검증한다.
3. `CardDefinition`을 `CardDisplayModel`로 변환한다.
4. 카드별 정적 베이스 SVG 또는 중간 렌더 결과를 만든다.
5. 변화 가능한 숫자 영역은 배경/아이콘만 렌더링하고 실제 숫자 glyph는 합성하지 않는다.
6. WebP 파일을 `generated/cards/<cardId>.webp`에 쓴다.
7. `generated/cards/manifest.json`을 쓴다.
8. 생성 결과의 크기, 해시, `runtimeNumberSlots`를 manifest에 기록한다.
9. 실패 시 어떤 카드가 실패했는지 카드 ID와 오류 코드를 출력한다.

manifest 권장 타입:

```ts
export interface CardAssetManifest {
  manifestVersion: 1;
  cardDataVersion: string;
  rendererVersion: string;
  generatedAtPolicy: 'OMITTED_FOR_DETERMINISM';
  cards: CardAssetManifestEntry[];
}

export interface CardAssetManifestEntry {
  cardId: string;
  sourceHash: string;
  assetHash: string;
  width: number;
  height: number;
  webpPath: string;
  runtimeNumberSlots: CardRuntimeNumberSlot[];
}
```

결정론 정책:

- manifest에는 현재 시각을 기록하지 않는다.
- 파일명은 `cardId` 기반으로 고정한다.
- 해시는 카드 정의, 표시 문자열, 렌더러 버전, 사용한 일러스트 원천을 기준으로 계산한다.
- 생성 순서는 `cardId` 오름차순으로 고정한다.
- 같은 입력에서 `generate:cards:check`가 차이를 발견하면 실패한다.

## 7. 렌더러와 룰 엔진 경계

Phase9의 카드 렌더러는 표현 계층 도구다.

허용:

- `src/cards`의 타입과 `parseCardDefinition` 사용
- `CardDefinition`을 표시 모델로 변환
- `src/assets` 내부에서 렌더링 토큰, 레이아웃, manifest 타입 사용
- Phaser UI가 사용할 `BitmapText` overlay metadata 생성
- CLI에서 파일 시스템을 사용해 `generated/cards/` 산출물 생성

금지:

- `src/core`, `src/game`, `src/rules`, `src/battle`, `src/effects`가 `src/assets/cards`나 이미지 생성 라이브러리를 import하는 것
- 카드 이미지에서 읽은 텍스트나 픽셀 값을 룰 판정에 사용하는 것
- 렌더러가 `GameState`를 변경하는 것
- 렌더러가 Phaser 장면, DOM, 브라우저 전역 객체에 의존하는 것
- 렌더러가 현재 게임 중 수치를 계산하거나 `BitmapText` 객체를 직접 생성하는 것
- 생성 산출물을 룰 테스트의 필수 입력으로 삼는 것

## 8. 카드 표시 정보

Phase9 렌더러는 최소한 다음 표시 정보를 다룬다.

| 표시 정보 | 원천 |
|---|---|
| Card ID | `CardDefinition.cardId` |
| 카드명 | `nameKey`를 표시 문자열로 변환 |
| 코스트 | `cost` |
| 지배력 비용 | `dominanceCost` |
| 지배력 제공값 | `dominanceValue` |
| 지배력 요구값 | `dominanceRequirement` |
| 공격력 | `baseAttack` 또는 표시 모델의 `attack` |
| 체력 | `baseHealth` 또는 표시 모델의 `health` |
| 스킬 텍스트 | `abilities[].textKey` 또는 fallback |
| 카드 타입 | `type` |
| 희귀도 | `rarity` |
| 세력/속성 | `faction`, `attribute` |
| 태그 | `tags` |

표시 정책:

- 지배력 비용과 지배력 제공값은 서로 다른 라벨 또는 아이콘 위치로 구분한다.
- `dominanceRequirement`는 조건부 요구값이므로 비용처럼 보이게 하지 않는다.
- 스킬 텍스트는 사람이 읽는 설명이며, 효과 실행은 `effectScript`를 기준으로 한다.
- 카드명과 스킬 텍스트 fallback은 개발용 표시임을 알 수 있게 하되 렌더 실패로 처리하지 않는다.
- 코스트, 지배력, 공격력, 체력/HP의 실제 플레이 중 숫자는 WebP에 고정하지 않고 overlay slot으로 제공한다.

## 9. 테스트 요구사항

Phase9 테스트는 최소한 다음을 검증한다.

- `CardDefinition`이 `CardDisplayModel`로 올바르게 변환된다.
- `UNIT` 카드의 공격력/체력이 표시 모델에 들어간다.
- `TACTIC`, `ONGOING` 카드의 공격력/체력은 `null`로 정규화된다.
- 희귀도 누락 시 `COMMON` fallback이 적용된다.
- `nameKey`와 `textKey` 표시 문자열 fallback이 안정적으로 동작한다.
- 지배력 비용, 제공값, 요구값이 서로 다른 필드로 유지된다.
- `runtimeNumberSlots`가 비용, 지배력, 공격력, 체력 필드를 포함하고 고정 좌표계를 사용한다.
- 긴 카드명과 긴 스킬 텍스트가 렌더 결과의 고정 영역 밖으로 넘치지 않는 정책을 테스트한다.
- SVG 또는 중간 렌더 결과가 같은 입력에서 같은 문자열 또는 같은 해시를 만든다.
- placeholder가 같은 입력에서 같은 결과를 만든다.
- manifest가 `cardId` 오름차순으로 작성된다.
- manifest entry가 `cardId`, `sourceHash`, `assetHash`, `width`, `height`, `webpPath`, `runtimeNumberSlots`를 포함한다.
- 파이프라인 smoke test가 예시 카드들로 `generated/cards/manifest.json`과 WebP 파일을 만들 수 있다.
- 기본 WebP 생성 결과가 변화 가능한 숫자 glyph를 정적으로 굽지 않는 정책을 검증한다.
- 룰 엔진 영역이 `src/assets/cards`, 이미지 생성 라이브러리, Phaser, DOM을 import하지 않는다.
- 코드와 카드 데이터에 원작 보호 대상 텍스트가 추가되지 않는다.

## 10. 완료 검증 명령

Phase9 완료 전 다음 명령을 모두 통과시킨다.

```bash
npm run build
npm run lint
npm run format:check
npm test
npm run generate:cards
```

`generate:cards:check`를 추가했다면 다음도 통과시킨다.

```bash
npm run generate:cards:check
```

추가 감사 명령:

```bash
rg -n "from ['\"]\\.\\.?/.*/(scenes|ui|assets/cards)|from ['\"]phaser|document\\.|window\\." src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai
rg -n "창각|創刻|アテリアル" src tests card-data generated
```

첫 번째 명령은 룰 엔진 계층의 UI/Phaser/DOM/카드 렌더러 의존성이 없어야 한다. 두 번째 명령은 문서 외 코드, 카드 데이터, 생성물에 원작 보호 대상 텍스트가 들어가지 않았는지 확인하기 위한 감사다.

## 11. Phase9 완료 후 남겨야 할 경계

Phase9이 끝나도 다음은 아직 미완성으로 남겨야 한다.

- HP 0, 덱 아웃, PvE 목표 기반 승리 조건
- `GAME_ENDED` 이벤트와 최종 로그 고정
- 저장 파일 포맷과 리플레이 재생기
- 상태 해시와 리플레이 검증
- AI 행동 탐색과 평가 함수
- Phaser 기반 실제 게임 화면과 카드 조작 UI
- Phaser `BitmapText` 객체 생성과 런타임 수치 갱신 로직
- PvE 스테이지, 보스전, 보상 구조
- 외부 이미지 생성 API 연동
- 대량 카드 일러스트 제작과 밸런스용 카드 세트 확장

이 경계를 넘는 구현은 Phase10 이후 문서에서 다룬다.
