import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { fetchAssetsManifest, joinAssetUrl } from '../../game/assets/manifest';
import { LayoutBox } from '../ui/LayoutBox';
import type { MainMenuSceneData, LoaderSceneData } from './scene-data';

const PROGRESS_BAR_WIDTH = 560;
const PROGRESS_BAR_HEIGHT = 20;

/**
 * `assets.json`을 읽고 필요한 `webp` 텍스처만 순차적으로 로딩하는 씬이다.
 * 로딩 실패는 치명적으로 끊지 않고, 가능한 자산만 살려서 메뉴로 넘긴다.
 */
export class LoaderScene extends Phaser.Scene {
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LoaderScene' });
  }

  /**
   * manifest를 읽고 webp 텍스처를 로딩하는 동안 진행률과 상태 메시지를 갱신한다.
   */
  create(data: LoaderSceneData): void {
    this.addBackground();
    this.addForegroundUi();

    void this.preloadWebpTextures(data.assetBaseUrl).catch((error: unknown) => {
      this.statusText.setText(formatError(error));
      this.progressText.setText('0%');
      this.time.delayedCall(1200, () => {
        this.scene.start('MainMenuScene', {
          loadedCount: 0,
          failedCount: 0,
        } satisfies MainMenuSceneData);
      });
    });
  }

  private addBackground(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x041018, 1).setOrigin(0, 0);
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.22);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setOrigin(0, 0);
  }

  private addForegroundUi(): void {
    const root = new LayoutBox(this, 'vbox');
    const titleGroup = this.createTitleGroup();
    const progressGroup = this.createProgressGroup();

    root.addOverlay(titleGroup, {
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: 220,
    });
    root.addOverlay(progressGroup, {
      x: GAME_WIDTH / 2 - PROGRESS_BAR_WIDTH / 2,
      y: 394,
      width: PROGRESS_BAR_WIDTH,
      height: 120,
    });
    root.layout(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    const title = this.add
      .text(GAME_WIDTH / 2, 146, 'Loading archive', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '54px',
        color: '#f0f7eb',
        align: 'center',
      })
      .setOrigin(0.5);

    group.add(title);
    return group;
  }

  private createProgressGroup(): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    const progressTrack = this.add
      .rectangle(
        PROGRESS_BAR_WIDTH / 2,
        PROGRESS_BAR_HEIGHT / 2,
        PROGRESS_BAR_WIDTH,
        PROGRESS_BAR_HEIGHT,
        0x13221d,
        0.95,
      )
      .setOrigin(0.5);

    this.progressFill = this.add.rectangle(
      0,
      PROGRESS_BAR_HEIGHT / 2,
      0,
      PROGRESS_BAR_HEIGHT,
      0xa8e6b2,
      0.95,
    );
    this.statusText = this.add
      .text(PROGRESS_BAR_WIDTH / 2, 64, 'Requesting assets.json', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '18px',
        color: '#d0e2d2',
        align: 'center',
      })
      .setOrigin(0.5);
    this.progressText = this.add
      .text(PROGRESS_BAR_WIDTH / 2, 96, '0%', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '20px',
        color: '#eef7ed',
        align: 'center',
      })
      .setOrigin(0.5);

    group.add([progressTrack, this.progressFill, this.statusText, this.progressText]);
    return group;
  }

  private async preloadWebpTextures(assetBaseUrl: string): Promise<void> {
    const manifest = await fetchAssetsManifest(assetBaseUrl);
    const webpTextures = manifest.textures.filter((texture) =>
      texture.path.toLowerCase().endsWith('.webp'),
    );
    const failedKeys = new Set<string>();

    this.statusText.setText(`Preloading ${webpTextures.length} webp textures`);

    if (webpTextures.length === 0) {
      this.updateProgress(1);
      this.statusText.setText('No webp textures found, opening menu');
      this.time.delayedCall(200, () => {
        this.scene.start('MainMenuScene', {
          loadedCount: 0,
          failedCount: 0,
        } satisfies MainMenuSceneData);
      });
      return;
    }

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      this.updateProgress(value);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      failedKeys.add(file.key);
      this.statusText.setText(`Skipping failed texture: ${file.key}`);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      const loadedCount = webpTextures.length - failedKeys.size;
      this.scene.start('MainMenuScene', {
        loadedCount,
        failedCount: failedKeys.size,
      } satisfies MainMenuSceneData);
    });

    for (const texture of webpTextures) {
      this.load.image(texture.key, joinAssetUrl(manifest.assetBaseUrl, texture.path));
    }

    this.load.start();
  }

  private updateProgress(value: number): void {
    const clamped = Phaser.Math.Clamp(value, 0, 1);
    const fillWidth = PROGRESS_BAR_WIDTH * clamped;
    this.progressFill.setSize(fillWidth, PROGRESS_BAR_HEIGHT);
    this.progressFill.setPosition(fillWidth / 2, PROGRESS_BAR_HEIGHT / 2);
    this.progressText.setText(`${Math.round(clamped * 100)}%`);
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
