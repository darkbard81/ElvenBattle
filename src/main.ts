import Phaser from 'phaser';
import { createGameConfig } from './phaser/config/game-config';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('#app element not found');
}

const mount = app;

app.replaceChildren();
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#071018';
app.style.width = '100vw';
app.style.height = '100vh';

/**
 * 브라우저의 마운트 지점에 Phaser 게임을 붙인다.
 * 이 진입점은 DOM 초기화와 게임 생성만 담당한다.
 */
async function bootstrap(): Promise<void> {
  new Phaser.Game(createGameConfig(mount));
}

void bootstrap();
