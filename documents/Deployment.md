# 배포 문서

Phase14 배포 대상은 Vite production build가 생성한 정적 `dist/` 산출물이다. 이 문서는 로컬 검증, 정적 서버 확인, Docker/Nginx 배포 절차를 정의한다.

## 로컬 Build

```bash
npm install
npm --silent run build
npm run check:artifacts
npm run check:performance
```

성공 조건:

- `dist/index.html`이 존재한다.
- `dist/assets/` 아래 JavaScript와 CSS asset이 존재한다.
- 카드 manifest와 card WebP/SVG 참조가 누락되지 않는다.
- bundle size 예산을 초과하지 않는다.

## 정적 서버 Smoke

Vite preview 또는 임의의 정적 파일 서버로 `dist/`를 제공한다.

```bash
npm run preview -- --host 127.0.0.1
```

브라우저에서 초기 Phaser 화면이 열리고 카드 asset preload 오류가 없어야 한다.

## Docker

Docker image는 build stage에서 `npm --silent run build`를 실행하고, runtime stage의 Nginx가 `/usr/share/nginx/html`의 정적 파일만 제공한다.

```bash
docker build -t elven-battle:phase14 .
docker run --rm -p 8080:80 elven-battle:phase14
```

확인:

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/assets/
```

## Nginx

`nginx.conf`는 다음 범위만 담당한다.

- `dist/` 정적 파일 제공
- SPA fallback을 위한 `try_files $uri $uri/ /index.html`
- hashed asset 장기 cache header
- `index.html` no-cache header

계정, PvP, 서버 권위 판정, API proxy는 Phase14 범위 밖이다.

## Base Path 주의사항

현재 Vite 설정은 기본 base path를 사용한다. 하위 경로 배포가 필요하면 `vite.config.ts`의 `base` 설정을 명시하고, `npm --silent run build`, `npm run check:artifacts`, 브라우저 smoke를 다시 실행한다.

## Rollback 기준

다음 중 하나라도 발생하면 이전 image 또는 이전 정적 산출물로 되돌린다.

- `dist/index.html`이 200으로 응답하지 않는다.
- Phaser bootstrap 중 JavaScript error가 발생한다.
- 카드 manifest 또는 card asset이 404로 응답한다.
- `npm run check:release`가 실패한다.
- 원작 보호 대상 문자열 audit에서 코드, 테스트, 카드 데이터, 생성 산출물에 새 매치가 발생한다.
