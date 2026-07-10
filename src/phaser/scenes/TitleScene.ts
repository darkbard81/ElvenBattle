import Phaser from 'phaser';
import { DEFAULT_ASSET_BASE_URL, GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { CanvasUiFactory } from '../ui/CanvasUiFactory';
import type { LoaderSceneData } from './scene-data';

const TITLE_GROUP_HEIGHT = 260;
const PROMPT_GROUP_HEIGHT = 120;
const PROMPT_GROUP_TOP = GAME_HEIGHT - PROMPT_GROUP_HEIGHT;

/**
 * 첫 진입 화면을 담당하는 타이틀 씬이다.
 * 클릭 전까지는 시작 안내만 보여주고, 클릭하면 로더 씬으로 보낸다.
 */
export class TitleScene extends Phaser.Scene {
  private readonly ui = new CanvasUiFactory(this);

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
    this.ui.image({
      x: 0,
      y: 0,
      key: 'title-background',
      origin: { x: 0, y: 0 },
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'titleBackdrop',
      origin: 0,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'titleShade',
      origin: 0,
    });
  }

  private addForegroundUi(): void {
    this.ui.overlay({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      origin: 0,
      anchor: {
        left: 'left',
        top: 'top',
        width: '100%',
        height: '100%',
      },
      children: [
        {
          gameObject: this.createTitleGroup(),
          align: 'left-top',
          minWidth: GAME_WIDTH,
          minHeight: TITLE_GROUP_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createPromptGroup(),
          align: 'left-top',
          minWidth: GAME_WIDTH,
          minHeight: PROMPT_GROUP_HEIGHT,
          offsetY: PROMPT_GROUP_TOP,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.ui.container({ width: GAME_WIDTH, height: TITLE_GROUP_HEIGHT });
    const title = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 140,
      text: 'ELVENBATTLE',
      variant: 'heroTitle',
      align: 'center',
      origin: 0.5,
    });
    const subtitle = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 228,
      text: 'the elven card battler',
      variant: 'titleTagline',
      align: 'center',
      origin: 0.5,
      alpha: 0.92,
    });

    group.add([title, subtitle]);
    return group;
  }

  private createPromptGroup(): Phaser.GameObjects.Container {
    const group = this.ui.container({ width: GAME_WIDTH, height: PROMPT_GROUP_HEIGHT });
    const prompt = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 28,
      text: 'click anywhere to begin',
      variant: 'prompt',
      align: 'center',
      origin: 0.5,
      alpha: 0.95,
    });
    const helper = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 66,
      text: 'the archive will preload webp textures before the menu opens',
      variant: 'helper',
      align: 'center',
      origin: 0.5,
      alpha: 0.9,
    });

    group.add([prompt, helper]);
    return group;
  }
}
