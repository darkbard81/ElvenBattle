import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { BattlefieldScene } from '../scenes/BattlefieldScene';
import { LoaderScene } from '../scenes/LoaderScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { SaveSlotScene } from '../scenes/SaveSlotScene';
import { TitleScene } from '../scenes/TitleScene';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';

/**
 * 현재 화면 정책에 맞는 Phaser 게임 설정을 만든다.
 * 이 프로젝트는 1200x1920 가상 해상도를 FIT 스케일로 유지한다.
 */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#071018',
    scene: [BootScene, TitleScene, LoaderScene, MainMenuScene, SaveSlotScene, BattlefieldScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
  };
}
