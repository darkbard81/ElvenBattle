# 릴리스 체크리스트

Phase14 릴리스 후보는 다음 항목을 모두 통과해야 한다.

## 필수 검증

- [ ] `npm --silent run build`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm test -- --reporter=dot`
- [ ] `npm run generate:cards:check`
- [ ] `npm run check:balance`
- [ ] `npm run check:artifacts`
- [ ] `npm run check:performance`
- [ ] `npm run check:release`

## Audit

- [ ] 룰 엔진 계층이 `src/scenes`, `src/ui`, Phaser, DOM, 브라우저 전역 객체를 import하지 않는다.
- [ ] 결정론이 필요한 경로에서 `Math.random()`, `Date.now()`, `new Date()`를 직접 사용하지 않는다.
- [ ] 코드, 테스트, 카드 데이터, 생성 산출물에 원작 보호 대상 문자열이 추가되지 않는다.
- [ ] 카드 이미지는 표시용이며 룰 판정은 `CardDefinition`과 `CardInstance` 기준으로 유지된다.

## 배포 전 확인

- [ ] `dist/index.html`이 생성되어 있다.
- [ ] `dist/assets/`에 JavaScript asset이 있다.
- [ ] 카드 manifest와 card WebP/SVG 참조가 유효하다.
- [ ] bundle size와 manifest size가 Phase14 예산을 넘지 않는다.
- [ ] Docker/Nginx 설정은 정적 파일 제공 범위만 담당한다.
- [ ] 브라우저에서 기본 PvE 화면이 열린다.
- [ ] 일반전과 보스전이 게임 종료 화면까지 진행된다.

## 기록

- [ ] `documents/Balance_Report.md`에 사용 seed와 결과 지표를 기록했다.
- [ ] 실패 또는 warning이 있으면 조정 필요 카드, 덱, 시나리오, AI 영역을 적었다.
- [ ] 릴리스한 commit hash 또는 artifact tag를 기록했다.
