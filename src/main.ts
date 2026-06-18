import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from './theme';

type AssetsManifest = {
  assetBaseUrl: string;
  textures: Array<{
    key: string;
    path: string;
    revision: string;
  }>;
  manifestRevision: string;
  schemaVersion: number;
  revisionAlgorithm: string;
};

type LoaderSceneData = {
  assetBaseUrl: string;
};

type MainMenuSceneData = {
  loadedCount: number;
  failedCount: number;
};

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 800;
const TITLE_BACKGROUND_URL = new URL('../assets/ui/title-screen.png', import.meta.url).href;
const DEFAULT_FONT_URL = new URL('../assets/fonts/CookieRun Bold.ttf', import.meta.url).href;
const DEFAULT_ASSET_BASE_URL = '/tcg';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('#app element not found');
}

app.replaceChildren();
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#071018';
app.style.width = '100vw';
app.style.height = '100vh';

/**
 * Phaser 게임 인스턴스를 생성해 브라우저에 붙인다.
 * 이 진입점은 씬 생성만 담당하고, 게임 상태는 씬 내부로 넘긴다.
 */
async function bootstrap(): Promise<void> {
  new Phaser.Game(createGameConfig());
}

/**
 * 현재 화면 정책과 씬 구성을 기준으로 Phaser 게임 설정을 만든다.
 * 이 프로젝트는 1280x800 가상 해상도를 FIT 방식으로 스케일한다.
 */
function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: app,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#071018',
    scene: [BootScene, TitleScene, LoaderScene, MainMenuScene],
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

/**
 * 게임 시작 시 공용 리소스를 먼저 올리고 첫 타이틀 씬으로 넘기는 부트 씬이다.
 * 폰트와 타이틀 배경처럼 이후 모든 씬에서 공유할 자산을 이 단계에서 준비한다.
 */
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene', active: true });
  }

  /**
   * 타이틀 화면에 필요한 공용 리소스를 선로딩한다.
   * 이 단계에서 불러온 폰트와 배경은 이후 씬에서 바로 재사용된다.
   */
  preload(): void {
    this.load.image('title-background', TITLE_BACKGROUND_URL);
    this.load.font(DEFAULT_FONT_FAMILY, DEFAULT_FONT_URL, 'truetype');
  }

  /**
   * 부트가 끝나면 타이틀 씬으로 전환한다.
   */
  create(): void {
    this.scene.start('TitleScene');
  }
}

/**
 * 첫 진입 화면을 담당하는 타이틀 씬이다.
 * 클릭 전까지는 시작 안내만 보여주고, 클릭하면 자산 로딩 씬으로 보낸다.
 */
class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  /**
   * 타이틀 배경과 안내 문구를 배치하고, 아무 곳이나 클릭하면 로딩 씬으로 이동시킨다.
   */
  create(): void {
    this.addBackground();
    this.addTitleText();
    this.addPromptText();

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

  private addTitleText(): void {
    this.add
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

    this.add
      .text(GAME_WIDTH / 2, 228, 'the elven card battler', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '28px',
        color: '#d8ead3',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.92);
  }

  private addPromptText(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 92, 'click anywhere to begin', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '26px',
        color: '#ecf7e8',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.95);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 54,
        'the archive will preload webp textures before the menu opens',
        {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '16px',
          color: '#b8cbb7',
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.9);
  }
}

/**
 * 서버의 `assets.json`을 읽고 필요한 `webp` 텍스처만 순차적으로 로딩하는 씬이다.
 * 로딩 실패는 치명적으로 끊지 않고, 가능한 자산만 살려서 메인 메뉴로 넘긴다.
 */
class LoaderScene extends Phaser.Scene {
  private progressTrack!: Phaser.GameObjects.Rectangle;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LoaderScene' });
  }

  /**
   * manifest를 읽고 webp 텍스처를 로딩하는 동안 진행률과 상태 메시지를 갱신한다.
   * 실패한 텍스처가 있어도 전체 흐름은 계속 유지한다.
   */
  create(data: LoaderSceneData): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x041018, 1).setOrigin(0, 0);
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.22);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setOrigin(0, 0);
    this.add
      .text(GAME_WIDTH / 2, 146, 'Loading archive', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '54px',
        color: '#f0f7eb',
        align: 'center',
      })
      .setOrigin(0.5);

    this.progressTrack = this.add
      .rectangle(GAME_WIDTH / 2, 404, 560, 20, 0x13221d, 0.95)
      .setOrigin(0.5);
    this.progressFill = this.add
      .rectangle(GAME_WIDTH / 2 - 280, 404, 0, 20, 0xa8e6b2, 0.95)
      .setOrigin(0, 0.5);
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 458, 'Requesting assets.json', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '18px',
        color: '#d0e2d2',
        align: 'center',
      })
      .setOrigin(0.5);
    this.progressText = this.add
      .text(GAME_WIDTH / 2, 490, '0%', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '20px',
        color: '#eef7ed',
        align: 'center',
      })
      .setOrigin(0.5);

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

  private async preloadWebpTextures(assetBaseUrl: string): Promise<void> {
    const manifest = await fetchAssetsManifest(assetBaseUrl);
    const webpTextures = manifest.textures.filter((texture) =>
      texture.path.toLowerCase().endsWith('.webp'),
    );
    const failedKeys = new Set<string>();

    this.statusText.setText(`Preloading ${webpTextures.length} webp textures`);

    if (webpTextures.length === 0) {
      this.progressFill.setSize(560, 20);
      this.progressText.setText('100%');
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
    const fillWidth = 560 * clamped;
    this.progressFill.setSize(fillWidth, 20);
    this.progressFill.setPosition(GAME_WIDTH / 2 - 280 + fillWidth / 2, 404);
    this.progressText.setText(`${Math.round(clamped * 100)}%`);
  }
}

/**
 * 자산 로딩이 끝난 뒤 사용자가 실제로 진입할 메인 메뉴를 보여주는 씬이다.
 * 현재 단계에서는 새 게임은 비활성화하고, 카드 텍스트 툴 진입만 허용한다.
 */
class MainMenuScene extends Phaser.Scene {
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
    createMenuButton(this, {
      x: GAME_WIDTH / 2,
      y: 394,
      width: 360,
      height: 72,
      label: 'New Game',
      enabled: false,
    });

    createMenuButton(this, {
      x: GAME_WIDTH / 2,
      y: 488,
      width: 360,
      height: 72,
      label: 'Card Text Tool',
      enabled: true,
      onClick: () => {
        window.location.assign('/tools/card-text/');
      },
    });
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
      .text(GAME_WIDTH / 2, 652, 'New Game is intentionally disabled in this phase.', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: '#b7c9ba',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
  }
}

function createMenuButton(
  scene: Phaser.Scene,
  config: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    enabled: boolean;
    onClick?: () => void;
  },
): void {
  const fillColor = config.enabled ? 0x1d3f31 : 0x12211c;
  const strokeColor = config.enabled ? 0xdaf6d3 : 0x51605a;
  const fillAlpha = config.enabled ? 0.96 : 0.72;
  const labelColor = config.enabled ? '#f5fff0' : '#7e8b84';

  const background = scene.add.rectangle(
    config.x,
    config.y,
    config.width,
    config.height,
    fillColor,
    fillAlpha,
  );
  background.setStrokeStyle(2, strokeColor, config.enabled ? 0.92 : 0.58);

  const label = scene.add.text(config.x, config.y, config.label, {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: '28px',
    color: labelColor,
    align: 'center',
  });
  label.setOrigin(0.5);

  if (!config.enabled) {
    const disabled = scene.add.text(config.x, config.y + 26, 'disabled', {
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: '14px',
      color: '#8d9b95',
      align: 'center',
    });
    disabled.setOrigin(0.5);
    return;
  }

  background.setInteractive();
  background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
    background.setFillStyle(0x2f5b44, 0.98);
    label.setColor('#ffffff');
  });
  background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
    background.setFillStyle(fillColor, fillAlpha);
    label.setColor(labelColor);
  });
  background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
    config.onClick?.();
  });
}

/**
 * 서버가 제공하는 `assets.json`을 읽어 텍스처 로딩용 manifest로 해석한다.
 * 응답 실패는 로딩 씬에서 잡아내며, 여기서는 유효한 manifest만 돌려준다.
 */
async function fetchAssetsManifest(assetBaseUrl: string): Promise<AssetsManifest> {
  const response = await fetch(joinAssetUrl(assetBaseUrl, 'assets.json'));
  if (!response.ok) {
    throw new Error(`Failed to load assets.json: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as AssetsManifest;
}

function joinAssetUrl(assetBaseUrl: string, assetPath: string): string {
  const normalizedBase = normalizeAssetBaseUrl(assetBaseUrl);
  const normalizedPath = assetPath.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
}

function normalizeAssetBaseUrl(assetBaseUrl: string): string {
  if (!assetBaseUrl.startsWith('/')) {
    return `/${assetBaseUrl.replace(/^\/+/, '')}`.replace(/\/+$/, '');
  }

  return assetBaseUrl.replace(/\/+$/, '') || '/';
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

void bootstrap();
