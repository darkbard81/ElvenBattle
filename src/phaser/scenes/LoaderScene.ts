import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { CanvasUiFactory } from '../ui/CanvasUiFactory';
import { fetchAssetsManifest, joinAssetUrl } from '../../game/assets/manifest';
import type { MainMenuSceneData, LoaderSceneData } from './scene-data';

const PROGRESS_BAR_WIDTH = 560;
const PROGRESS_BAR_HEIGHT = 20;
const TITLE_GROUP_HEIGHT = 220;
const PROGRESS_GROUP_HEIGHT = 120;
const PROGRESS_GROUP_TOP = 394;
const PROGRESS_GROUP_LEFT = (GAME_WIDTH - PROGRESS_BAR_WIDTH) / 2;

/**
 * `assets.json`을 읽고 필요한 `webp` 텍스처와 `webm` 모션을 순차적으로 로딩하는 씬이다.
 * 로딩 실패는 치명적으로 끊지 않고, 가능한 자산만 살려서 메뉴로 넘긴다.
 */
export class LoaderScene extends Phaser.Scene {
  private readonly ui = new CanvasUiFactory(this);
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LoaderScene' });
  }

  /**
   * manifest를 읽고 런타임 자산을 로딩하는 동안 진행률과 상태 메시지를 갱신한다.
   */
  create(data: LoaderSceneData): void {
    this.addBackground();
    this.addForegroundUi();

    void this.preloadManifestAssets(data.assetBaseUrl).catch((error: unknown) => {
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
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'loaderBackground',
      origin: 0,
    });
    this.ui.image({
      x: 0,
      y: 0,
      key: 'title-background',
      origin: { x: 0, y: 0 },
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      alpha: 0.22,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'loaderShade',
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
          gameObject: this.createProgressGroup(),
          align: 'left-top',
          minWidth: PROGRESS_BAR_WIDTH,
          minHeight: PROGRESS_GROUP_HEIGHT,
          offsetX: PROGRESS_GROUP_LEFT,
          offsetY: PROGRESS_GROUP_TOP,
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
      y: 146,
      text: 'Loading archive',
      variant: 'loaderTitle',
      align: 'center',
      origin: 0.5,
    });

    group.add(title);
    return group;
  }

  private createProgressGroup(): Phaser.GameObjects.Container {
    const group = this.ui.container({ width: PROGRESS_BAR_WIDTH, height: PROGRESS_GROUP_HEIGHT });
    const progressTrack = this.ui.panel({
      x: PROGRESS_BAR_WIDTH / 2,
      y: PROGRESS_BAR_HEIGHT / 2,
      width: PROGRESS_BAR_WIDTH,
      height: PROGRESS_BAR_HEIGHT,
      variant: 'progressTrack',
      origin: 0.5,
    });

    this.progressFill = this.ui.panel({
      x: 0,
      y: PROGRESS_BAR_HEIGHT / 2,
      width: 0,
      height: PROGRESS_BAR_HEIGHT,
      variant: 'progressFill',
    });
    this.statusText = this.ui.text({
      x: PROGRESS_BAR_WIDTH / 2,
      y: 64,
      text: 'Requesting assets.json',
      variant: 'loaderStatus',
      align: 'center',
      origin: 0.5,
    });
    this.progressText = this.ui.text({
      x: PROGRESS_BAR_WIDTH / 2,
      y: 96,
      text: '0%',
      variant: 'loaderPercent',
      align: 'center',
      origin: 0.5,
    });

    group.add([progressTrack, this.progressFill, this.statusText, this.progressText]);
    return group;
  }

  private async preloadManifestAssets(assetBaseUrl: string): Promise<void> {
    const manifest = await fetchAssetsManifest(assetBaseUrl);
    const webpTextures = manifest.textures.filter((texture) =>
      texture.path.toLowerCase().endsWith('.webp'),
    );
    const webmVideos = manifest.videos.filter((video) =>
      video.path.toLowerCase().endsWith('.webm'),
    );
    const totalAssets = webpTextures.length + webmVideos.length;
    const failedKeys = new Set<string>();

    this.statusText.setText(`Preloading ${totalAssets} assets`);

    if (totalAssets === 0) {
      this.updateProgress(1);
      this.statusText.setText('No preload assets found, opening menu');
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
      this.statusText.setText(`Skipping failed asset: ${file.key}`);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      const loadedCount = totalAssets - failedKeys.size;
      this.scene.start('MainMenuScene', {
        loadedCount,
        failedCount: failedKeys.size,
      } satisfies MainMenuSceneData);
    });

    for (const texture of webpTextures) {
      this.load.image(texture.key, joinAssetUrl(manifest.assetBaseUrl, texture.path));
    }
    for (const video of webmVideos) {
      this.load.video(video.key, joinAssetUrl(manifest.assetBaseUrl, video.path), true);
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
