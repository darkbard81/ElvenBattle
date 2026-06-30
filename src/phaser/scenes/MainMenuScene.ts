import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { LayoutBox } from '../ui/LayoutBox';
import { createMenuButton } from '../ui/menu-button';
import type { MainMenuSceneData } from './scene-data';

/**
 * 자산 로딩이 끝난 뒤 사용자가 실제로 진입할 메인 메뉴를 보여주는 씬이다.
 * 현재 단계에서는 Start Game과 카드 텍스트 툴 진입만 제공한다.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  /**
   * 메뉴 배경, 제목, 버튼과 로딩 결과 요약을 화면에 구성한다.
   */
  create(data: MainMenuSceneData): void {
    this.addBackground();
    this.addTitle();
    this.addMenuButtons();
    this.addStatusLine(data);
  }

  private addBackground(): void {
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.48).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.12).setOrigin(0, 0);
  }

  private addTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, 118, 'ELVENBATTLE', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '58px',
        fontStyle: '700',
        color: '#f5faf0',
        stroke: '#182e27',
        strokeThickness: 7,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 184, 'main menu', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '26px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.88);
  }

  private addMenuButtons(): void {
    const buttonLayout = new LayoutBox(this, 'vbox', {
      gap: 22,
      align: 'center',
    });

    buttonLayout.add(
      createMenuButton(this, {
        x: 0,
        y: 0,
        width: 360,
        height: 72,
        label: 'Start Game',
        enabled: true,
        onClick: () => {
          this.scene.start('SaveSlotScene');
        },
      }),
      {
        width: 360,
        height: 72,
      },
    );

    buttonLayout.add(
      createMenuButton(this, {
        x: 0,
        y: 0,
        width: 360,
        height: 72,
        label: 'Card Text Tool',
        enabled: true,
        onClick: () => {
          window.location.assign('/tools/card-text/');
        },
      }),
      {
        width: 360,
        height: 72,
      },
    );

    buttonLayout.layout(GAME_WIDTH / 2 - 180, 358, 360, 166);
  }

  private addStatusLine(data: MainMenuSceneData): void {
    const statusText =
      data.failedCount > 0
        ? `Loaded ${data.loadedCount} textures, skipped ${data.failedCount}`
        : `Loaded ${data.loadedCount} textures`;

    this.add
      .text(GAME_WIDTH / 2, 620, statusText, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '18px',
        color: '#d5e7d1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.92);

    this.add
      .text(GAME_WIDTH / 2, 652, 'Start Game opens the save slot screen in this phase.', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: '#b7c9ba',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
  }
}
