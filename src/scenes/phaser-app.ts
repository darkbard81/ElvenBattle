import Phaser from 'phaser';

import { BootScene } from './boot-scene';
import { GameScene } from './game-scene';
import { ResultScene } from './result-scene';

export function createPhaserGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#172026',
    scene: [BootScene, GameScene, ResultScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };
}

export function mountPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game(createPhaserGameConfig(parent));
}
