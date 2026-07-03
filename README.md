# ElvenBattle

ElvenBattle은 Phaser, TypeScript, Vite로 만든 2D 전투 게임 프로젝트입니다.

## 실행

```bash
npm install
npm run dev
```

## 주요 스크립트

- `npm run dev`: 개발 서버 실행
- `npm run build`: 타입 체크와 프로덕션 빌드 실행
- `npm run lint`: ESLint 검사
- `npm run format`: Prettier 포맷 적용
- `npm run format:check`: Prettier 포맷 검사
- `npm run assets:build`: 로컬 자산 목록 생성

## 구성

- `src/game`: 전투 규칙, 저장 상태, 카드/덱 규칙
- `src/phaser`: Phaser Scene, 카메라, 렌더링 어댑터
- `src/ui`: DOM 기반 HUD와 메뉴
- `cards/`: 카드 정의와 스키마
- `assets/`: 로컬 자산과 생성물
- `tools/card-text/`: 카드 텍스트 편집 도구

## 참고

- 카드 정의는 `cards/card.schema.json`을 따른다.
- 저장 슬롯은 로컬 상태로 취급한다.
- TypeScript 코드의 TSDoc 작성 규칙은 `documents/Comment_Rule.md`를 따른다.

## 권리 고지

이 프로젝트는 비공식·비상업 팬메이드 게임 프로젝트입니다.

원작과 관련된 상표, 캐릭터, 명칭, 설정, 이미지, 음악, 기타 지식재산권은 각 권리자에게 있습니다.  
본 저장소의 라이선스는 이 프로젝트를 위해 작성된 원본 소스코드와 자체 제작 리소스에만 적용되며, 제3자 지식재산권에 대한 사용 권한을 부여하지 않습니다.

본 저장소는 원작의 이미지, 음악, 보이스, 독점 데이터의 재배포를 의도하지 않습니다.  
권리자 또는 관계자의 문제 제기가 있을 경우 해당 내용을 검토하고 필요한 조치를 취하겠습니다.