import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
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
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x041018, 1).setOrigin(0, 0);
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.22);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setOrigin(0, 0);
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
    const progressGroup = this.createProgressGroup();

    root.add(titleGroup, {
      align: 'left-top',
      minWidth: GAME_WIDTH,
      minHeight: TITLE_GROUP_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    root.add(progressGroup, {
      align: 'left-top',
      minWidth: PROGRESS_BAR_WIDTH,
      minHeight: PROGRESS_GROUP_HEIGHT,
      offsetX: PROGRESS_GROUP_LEFT,
      offsetY: PROGRESS_GROUP_TOP,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    root.layout();
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    group.setSize(GAME_WIDTH, TITLE_GROUP_HEIGHT);
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
    group.setSize(PROGRESS_BAR_WIDTH, PROGRESS_GROUP_HEIGHT);
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
