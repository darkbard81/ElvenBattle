import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { DEFAULT_ASSET_BASE_URL, GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { LoaderSceneData } from './scene-data';

const TITLE_GROUP_HEIGHT = 260;
const PROMPT_GROUP_HEIGHT = 120;
const PROMPT_GROUP_TOP = GAME_HEIGHT - PROMPT_GROUP_HEIGHT;

/**
 * 첫 진입 화면을 담당하는 타이틀 씬이다.
 * 클릭 전까지는 시작 안내만 보여주고, 클릭하면 로더 씬으로 보낸다.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  /**
   * 타이틀 배경과 안내 문구를 배치하고 입력을 기다린다.
   */
  create(): void {
    this.addBackground();
    this.addForegroundUi();

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      this.scene.start('LoaderScene', {
        assetBaseUrl: DEFAULT_ASSET_BASE_URL,
      } satisfies LoaderSceneData);
    });
  }

  private addBackground(): void {
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050b11, 0.22).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.08).setOrigin(0, 0);
  }

  private addForegroundUi(): void {
    const root = this.rexUI.add.overlapSizer(0, 0, GAME_WIDTH, GAME_HEIGHT, {
      origin: 0,
      anchor: {
        left: 'left',
        top: 'top',
        width: '100%',
        height: '100%',
      },
    });
    const titleGroup = this.createTitleGroup();
    const promptGroup = this.createPromptGroup();

    root.add(titleGroup, {
      align: 'left-top',
      minWidth: GAME_WIDTH,
      minHeight: TITLE_GROUP_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    root.add(promptGroup, {
      align: 'left-top',
      minWidth: GAME_WIDTH,
      minHeight: PROMPT_GROUP_HEIGHT,
      offsetY: PROMPT_GROUP_TOP,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    root.layout();
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    group.setSize(GAME_WIDTH, TITLE_GROUP_HEIGHT);
    const title = this.add
      .text(GAME_WIDTH / 2, 140, 'ELVENBATTLE', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '78px',
        fontStyle: '700',
        color: '#f4f8ef',
        stroke: '#1a2f28',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 12, false, true);

    const subtitle = this.add
      .text(GAME_WIDTH / 2, 228, 'the elven card battler', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '28px',
        color: '#d8ead3',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.92);

    group.add([title, subtitle]);
    return group;
  }

  private createPromptGroup(): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    group.setSize(GAME_WIDTH, PROMPT_GROUP_HEIGHT);
    const prompt = this.add
      .text(GAME_WIDTH / 2, 28, 'click anywhere to begin', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '26px',
        color: '#ecf7e8',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.95);

    const helper = this.add
      .text(GAME_WIDTH / 2, 66, 'the archive will preload webp textures before the menu opens', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: '#b8cbb7',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);

    group.add([prompt, helper]);
    return group;
  }
}
