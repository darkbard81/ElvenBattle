import Phaser from 'phaser';
import RexUIPlugin from 'phaser4-rex-plugins/templates/ui/ui-plugin.js';
import { BootScene } from '../scenes/BootScene';
import { BattlefieldScene } from '../scenes/BattlefieldScene';
import { DeckBuildScene } from '../scenes/DeckBuildScene';
import { EquipmentScene } from '../scenes/EquipmentScene';
import { GrowthScene } from '../scenes/GrowthScene';
import { LoaderScene } from '../scenes/LoaderScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { SaveSlotScene } from '../scenes/SaveSlotScene';
import { StageScene } from '../scenes/StageScene';
import { TitleScene } from '../scenes/TitleScene';
import { GAME_SERVICES_REGISTRY_KEY, type GameServices } from '../services/game-services';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';

/**
 * 현재 화면 정책에 맞는 Phaser 게임 설정을 만든다.
 * 이 프로젝트는 1920x1280 가상 해상도를 FIT 스케일로 유지한다.
 */
export function createGameConfig(
  parent: HTMLElement,
  services: GameServices,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#071018',
    callbacks: {
      preBoot: (game) => {
        game.registry.set(GAME_SERVICES_REGISTRY_KEY, services);
      },
    },
    scene: [
      BootScene,
      TitleScene,
      LoaderScene,
      MainMenuScene,
      SaveSlotScene,
      StageScene,
      DeckBuildScene,
      EquipmentScene,
      GrowthScene,
      BattlefieldScene,
    ],
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
    plugins: {
      scene: [
        {
          key: 'rexUI',
          plugin: RexUIPlugin,
          mapping: 'rexUI',
        },
      ],
    },
  };
}
