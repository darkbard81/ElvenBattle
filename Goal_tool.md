# 목적
- refactor: split card text tool from game entry

## 수행단계

1. 현재 src/main.ts를 src/tools/card-text-tool/main.ts로 이동
2. 현재 src/styles.css를 툴 전용 스타일로 이동하거나 이름 변경
3. /tools/card-text/index.html 추가
4. src/main.ts를 게임 placeholder로 교체
5. vite.config.ts에 multi-page input 추가
6. 가능하면 cardTextToolPlugin을 별도 파일로 분리

## 목표 tree structure

/
├─ index.html                         # 게임 메인 페이지
├─ tools/
│  └─ card-text/
│     └─ index.html                   # 카드 텍스트/에셋 툴 페이지
├─ src/
│  ├─ main.ts                         # 진짜 게임 부트스트랩
│  ├─ game/
│  │  ├─ GameApp.ts
│  │  ├─ scenes/
│  │  └─ ...
│  └─ tools/
│     └─ card-text-tool/
│        ├─ main.ts                   # 현재 src/main.ts 이동
│        ├─ styles.css                # 현재 styles.css 이동 또는 분리
│        └─ client/
└─ server/
   └─ card-text-tool-plugin.ts        # vite.config.ts 안의 툴 API 분리
