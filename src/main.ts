import Phaser from 'phaser';
import { AuthSessionController } from './game/auth/client';
import { SaveSlotsClient } from './game/save/client-api';
import { createGameConfig } from './phaser/config/game-config';
import type { TitleSceneData } from './phaser/scenes/scene-data';

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
  let game: Phaser.Game | null = null;
  const auth = new AuthSessionController({
    onExpired: (message) => {
      if (!game) {
        return;
      }
      for (const activeScene of game.scene.getScenes(true)) {
        game.scene.stop(activeScene.scene.key);
      }
      game.scene.start('TitleScene', { statusMessage: message } satisfies TitleSceneData);
    },
  });
  const services = {
    auth,
    saveSlots: new SaveSlotsClient(auth.request.bind(auth)),
  };
  game = new Phaser.Game(createGameConfig(mount, services));
  game.events.once(Phaser.Core.Events.DESTROY, () => auth.destroy());
}

void bootstrap();
