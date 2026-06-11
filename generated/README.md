# Generated

자동 생성물을 두는 위치다.

카드 WebP, 밸런스 리포트, 시뮬레이션 결과 같은 산출물이 들어갈 수 있다. README를 제외한
생성물은 기본적으로 git 추적 대상에서 제외한다.

Phase 9 카드 에셋 생성 결과는 기본적으로 `generated/cards/`에 기록한다.

- `*.webp`: 정적 카드 베이스 이미지
- `*.svg`: 동일 입력에서 만든 중간 렌더 결과
- `manifest.json`: 카드 ID, 해시, 파일 경로, 런타임 숫자 슬롯, 스킬 텍스트 overlay metadata

manifest에는 결정론을 위해 현재 시각을 기록하지 않는다.
