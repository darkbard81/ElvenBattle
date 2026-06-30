import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
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
    this.addForegroundUi(data);
  }

  private addBackground(): void {
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.48).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.12).setOrigin(0, 0);
  }

  private addForegroundUi(data: MainMenuSceneData): void {
    const root = this.rexUI.add.sizer(0, 88, GAME_WIDTH, 584, 'y', {
      origin: 0,
    });

    root.add(this.createTitleGroup(), {
      align: 'left-top',
      minWidth: GAME_WIDTH,
      minHeight: 142,
      offsetX: -GAME_WIDTH / 2,
      offsetY: -71,
    });
    root.add(this.createButtonLayout(), {
      align: 'left-top',
      minWidth: 360,
      minHeight: 166,
      offsetX: GAME_WIDTH / 2 - 180,
      offsetY: 0,
      padding: { top: 128 },
    });
    root.add(this.createStatusGroup(data), {
      align: 'left-top',
      minWidth: GAME_WIDTH,
      minHeight: 96,
      offsetX: -GAME_WIDTH / 2,
      offsetY: -48,
      padding: { top: 52 },
    });
    root.layout();
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    group.setSize(GAME_WIDTH, 142);
    const title = this.add
      .text(GAME_WIDTH / 2, 30, 'ELVENBATTLE', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '58px',
        fontStyle: '700',
        color: '#f5faf0',
        stroke: '#182e27',
        strokeThickness: 7,
        align: 'center',
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(GAME_WIDTH / 2, 96, 'main menu', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '26px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.88);

    group.add([title, subtitle]);
    return group;
  }

  private createButtonLayout(): Phaser.GameObjects.GameObject {
    const buttonLayout = this.rexUI.add.sizer(0, 0, 360, 166, 'y', {
      origin: 0,
      space: { item: 22 },
    });

    buttonLayout.add(
      this.createButtonSlot('Start Game', () => {
        this.scene.start('SaveSlotScene');
      }),
      {
        align: 'left-top',
        minWidth: 360,
        minHeight: 72,
        offsetX: -180,
        offsetY: -36,
      },
    );

    buttonLayout.add(
      this.createButtonSlot('Card Text Tool', () => {
        window.location.assign('/tools/card-text/');
      }),
      {
        align: 'left-top',
        minWidth: 360,
        minHeight: 72,
        offsetX: -180,
        offsetY: -36,
      },
    );

    return buttonLayout;
  }

  private createButtonSlot(label: string, onClick: () => void): Phaser.GameObjects.Container {
    const slot = this.add.container(0, 0);
    slot.setSize(360, 72);
    const button = createMenuButton(this, {
      x: 180,
      y: 36,
      width: 360,
      height: 72,
      label,
      enabled: true,
      onClick,
    });

    slot.add(button);
    return slot;
  }

  private createStatusGroup(data: MainMenuSceneData): Phaser.GameObjects.Container {
    const statusText =
      data.failedCount > 0
        ? `Loaded ${data.loadedCount} textures, skipped ${data.failedCount}`
        : `Loaded ${data.loadedCount} textures`;

    const group = this.add.container(0, 0);
    group.setSize(GAME_WIDTH, 96);
    const status = this.add
      .text(GAME_WIDTH / 2, 44, statusText, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '18px',
        color: '#d5e7d1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.92);

    const helper = this.add
      .text(GAME_WIDTH / 2, 76, 'Start Game opens the save slot screen in this phase.', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: '#b7c9ba',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);

    group.add([status, helper]);
    return group;
  }
}
