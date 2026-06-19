import Phaser from 'phaser';
import type { SaveSlotState, SaveSlotSummary } from './game/save/types';
import { createGameSession, type GameSession } from './game/save/session';
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

type BattleSceneData = {
  session: GameSession;
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
    scene: [BootScene, TitleScene, LoaderScene, MainMenuScene, SaveSlotScene, BattleScene],
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
      label: 'Start Game',
      enabled: true,
      onClick: () => {
        this.scene.start('SaveSlotScene');
      },
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

/**
 * `Start Game` 진입 후 3개의 저장 슬롯을 보여주는 선택 화면이다.
 * 서버의 `/api/save-slots` 응답을 읽어 실제 저장 상태를 렌더링한다.
 */
class SaveSlotScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private retryButton: Phaser.GameObjects.Rectangle | null = null;
  private slotUiElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'SaveSlotScene' });
  }

  create(): void {
    this.addBackground();
    this.addTitle();
    this.addBackButton();
    this.showLoadingState();

    void this.loadSaveSlots();
  }

  private addBackground(): void {
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.56).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.14).setOrigin(0, 0);
  }

  private addTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, 104, 'START GAME', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '56px',
        fontStyle: '700',
        color: '#f5faf0',
        stroke: '#182e27',
        strokeThickness: 7,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 166, 'Choose a save slot', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
  }

  private addBackButton(): void {
    createMenuButton(this, {
      x: 160,
      y: 86,
      width: 180,
      height: 58,
      label: 'Back',
      enabled: true,
      onClick: () => {
        this.scene.start('MainMenuScene', {
          loadedCount: 0,
          failedCount: 0,
        } satisfies MainMenuSceneData);
      },
    });
  }

  private showLoadingState(): void {
    this.clearSlotCards();
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 232, 'Loading save slots...', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#e6f4df',
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private async loadSaveSlots(): Promise<void> {
    try {
      const slots = await fetchSaveSlotSummaries();
      this.renderSlotCards(slots);
      this.setStatus('Select a slot to continue or create a new save.');
    } catch (error: unknown) {
      this.showFailureState(error);
    }
  }

  private renderSlotCards(slots: SaveSlotSummary[]): void {
    this.clearSlotCards();

    const cardWidth = 330;
    const cardHeight = 260;
    const cardGap = 28;
    const totalWidth = cardWidth * 3 + cardGap * 2;
    const startX = (GAME_WIDTH - totalWidth) / 2 + cardWidth / 2;
    const y = 392;

    slots.forEach((slot, index) => {
      const x = startX + index * (cardWidth + cardGap);
      this.createSlotCard(x, y, cardWidth, cardHeight, slot);
    });
  }

  private createSlotCard(
    x: number,
    y: number,
    width: number,
    height: number,
    slot: SaveSlotSummary,
  ): void {
    const fillColor = slot.isEmpty ? 0x12211c : 0x1a3a2d;
    const strokeColor = slot.isEmpty ? 0x4e5d57 : 0xbfeec5;
    const background = this.add.rectangle(x, y, width, height, fillColor, 0.96);
    background.setStrokeStyle(2, strokeColor, slot.isEmpty ? 0.7 : 0.94);
    background.setInteractive({ useHandCursor: true });
    this.slotUiElements.push(background);

    const titleColor = slot.isEmpty ? '#8e9a95' : '#f5fff0';
    const detailColor = slot.isEmpty ? '#7f8b85' : '#d7ead4';
    const accentColor = slot.isEmpty ? '#9cadb0' : '#a6d9b0';
    const slotLabel = `Slot ${slot.slotId}`;
    const title = slot.isEmpty ? 'Empty Slot' : slot.saveName ?? slotLabel;
    const subtitle = slot.isEmpty ? 'Create New Save' : formatSaveSlotSubtitle(slot);

    const slotLabelText = this.add
      .text(x, y - 88, slotLabel, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '20px',
        color: accentColor,
        align: 'center',
      })
      .setOrigin(0.5);
    this.slotUiElements.push(slotLabelText);

    const titleText = this.add
      .text(x, y - 36, title, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: slot.isEmpty ? '28px' : '26px',
        color: titleColor,
        align: 'center',
        wordWrap: { width: width - 48 },
      })
      .setOrigin(0.5);
    this.slotUiElements.push(titleText);

    const subtitleText = this.add
      .text(x, y + 6, subtitle, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: detailColor,
        align: 'center',
        wordWrap: { width: width - 48 },
      })
      .setOrigin(0.5);
    this.slotUiElements.push(subtitleText);

    const footerText = this.add
      .text(x, y + 74, slot.isEmpty ? 'Click to create' : 'Click to load', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '15px',
        color: slot.isEmpty ? '#b7c9ba' : '#dff3de',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.92);
    this.slotUiElements.push(footerText);

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      background.setFillStyle(slot.isEmpty ? 0x173027 : 0x24513d, 0.99);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      background.setFillStyle(fillColor, 0.96);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      void this.handleSlotSelection(slot);
    });
  }

  private showFailureState(error: unknown): void {
    this.clearSlotCards();
    const message = error instanceof Error ? error.message : String(error);
    this.setStatus(`Failed to load save slots: ${message}`);
    this.retryButton = this.add.rectangle(GAME_WIDTH / 2, 478, 280, 64, 0x1d3f31, 0.96);
    this.retryButton.setStrokeStyle(2, 0xdaf6d3, 0.9);
    this.retryButton.setInteractive({ useHandCursor: true });
    this.slotUiElements.push(this.retryButton);
    const retryText = this.add
      .text(GAME_WIDTH / 2, 478, 'Retry', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '26px',
        color: '#f5fff0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.slotUiElements.push(retryText);
    this.retryButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.scene.restart();
    });
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
  }

  private clearSlotCards(): void {
    this.slotUiElements.forEach((child) => {
      child.destroy();
    });
    this.slotUiElements = [];
    this.retryButton = null;
  }

  private async handleSlotSelection(slot: SaveSlotSummary): Promise<void> {
    try {
      if (slot.isEmpty) {
        this.setStatus(`Initializing Slot ${slot.slotId}...`);
        const result = await initializeSaveSlot(slot.slotId);
        const session = createGameSession(result.state);
        this.scene.start('BattleScene', { session } satisfies BattleSceneData);
        return;
      }

      this.setStatus(`Loading Slot ${slot.slotId}...`);
      const state = await fetchSaveSlot(slot.slotId);
      const session = createGameSession(state);
      this.scene.start('BattleScene', { session } satisfies BattleSceneData);
    } catch (error: unknown) {
      this.showFailureState(error);
    }
  }
}

/**
 * SaveSlotScene에서 전달받은 GameSession이 실제로 다음 씬에 도달했는지 확인하는 최소 배틀 씬이다.
 * 전투 규칙은 두지 않고, 슬롯과 리더 정보를 읽기 전용으로 표시한다.
 */
class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' });
  }

  create(data: BattleSceneData): void {
    this.addBackground();
    this.addTitle();
    this.addSessionSummary(data.session);
    this.addBackButton();
  }

  private addBackground(): void {
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.58).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.16).setOrigin(0, 0);
  }

  private addTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, 110, 'BATTLE SCENE', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '56px',
        fontStyle: '700',
        color: '#f5faf0',
        stroke: '#182e27',
        strokeThickness: 7,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 172, 'session handoff verified', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
  }

  private addSessionSummary(session: GameSession): void {
    const panelX = GAME_WIDTH / 2;
    const panelY = 420;
    const panel = this.add.rectangle(panelX, panelY, 760, 330, 0x12211c, 0.96);
    panel.setStrokeStyle(2, 0xbfeec5, 0.92);

    const lines = [
      `Slot: ${session.slotId}`,
      `Save Name: ${session.saveName}`,
      `Deck ID: ${session.deck.id}`,
      `Leader: ${session.deck.leader.definition.name}`,
      `Leader HP: ${session.deck.leader.instance.currentHp}`,
      `Leader Attack: ${session.deck.leader.instance.currentAttack}`,
      `Deck Cards: ${session.deck.cards.length}`,
    ];

    this.add
      .text(panelX, 304, 'Loaded session data', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '28px',
        color: '#f5fff0',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(panelX, panelY, lines.join('\n'), {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#d7ead4',
        align: 'left',
        lineSpacing: 12,
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        612,
        'This scene only confirms the session handoff. No battle rules are active yet.',
        {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '16px',
          color: '#b7c9ba',
          align: 'center',
          wordWrap: { width: 760 },
        },
      )
      .setOrigin(0.5);
  }

  private addBackButton(): void {
    createMenuButton(this, {
      x: 160,
      y: 86,
      width: 180,
      height: 58,
      label: 'Back',
      enabled: true,
      onClick: () => {
        this.scene.start('SaveSlotScene');
      },
    });
  }
}

/**
 * 메뉴 버튼의 시각적 상태와 클릭 가능 여부를 함께 구성한다.
 * 비활성 버튼은 상호작용을 제거하고, 활성 버튼만 전달된 콜백을 실행한다.
 */
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

  if (!config.onClick) {
    throw new Error(`Enabled menu button "${config.label}" requires onClick`);
  }
  const onClick = config.onClick;

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
    onClick();
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

/**
 * `/tcg` 하위 경로와 개별 자산 경로를 안전하게 합친다.
 * 이미 절대 경로처럼 들어온 조각은 앞쪽 슬래시만 정리한다.
 */
function joinAssetUrl(assetBaseUrl: string, assetPath: string): string {
  const normalizedBase = normalizeAssetBaseUrl(assetBaseUrl);
  const normalizedPath = assetPath.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
}

/**
 * 자산 base URL이 요청 경로와 비교 가능한 형태가 되도록 정규화한다.
 * 루트 경로는 `/`로 유지하고, 그 외 경로는 앞뒤 중복 슬래시를 정리한다.
 */
function normalizeAssetBaseUrl(assetBaseUrl: string): string {
  if (!assetBaseUrl.startsWith('/')) {
    return `/${assetBaseUrl.replace(/^\/+/, '')}`.replace(/\/+$/, '');
  }

  return assetBaseUrl.replace(/\/+$/, '') || '/';
}

/**
 * 화면에 표시할 에러를 문자열로 바꾼다.
 * 사용자에게는 네트워크/런타임 실패가 그대로 보이므로, 여기서는 추상화하지 않는다.
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function fetchSaveSlotSummaries(): Promise<SaveSlotSummary[]> {
  const response = await fetch('/api/save-slots');
  if (!response.ok) {
    throw new Error(`Failed to load save slots: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  if (!isSaveSlotsResponse(data)) {
    throw new Error('Invalid save slot summary response');
  }

  return data.slots;
}

async function fetchSaveSlot(slotId: number): Promise<SaveSlotState> {
  const response = await fetch(`/api/save-slots/${slotId}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = (await response.json()) as unknown;
  if (!isSaveSlotState(data)) {
    throw new Error('Invalid save slot state response');
  }

  return data;
}

async function initializeSaveSlot(slotId: number): Promise<{ state: SaveSlotState; summary: SaveSlotSummary }> {
  const response = await fetch(`/api/save-slots/${slotId}/initialize`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = (await response.json()) as unknown;
  if (!isRecord(data) || !isSaveSlotState(data.state) || !isSaveSlotSummary(data.summary)) {
    throw new Error('Invalid initialize save slot response');
  }

  return {
    state: data.state,
    summary: data.summary,
  };
}

function formatSaveSlotSubtitle(slot: SaveSlotSummary): string {
  if (slot.isEmpty) {
    return 'Create New Save';
  }

  const lines: string[] = [];
  if (slot.updatedAt) {
    lines.push(`Updated ${formatSaveSlotDate(slot.updatedAt)}`);
  }
  if (slot.deckCardCount !== null) {
    lines.push(`${slot.deckCardCount} cards`);
  }
  if (slot.leaderName) {
    lines.push(`Leader: ${slot.leaderName}`);
  }

  return lines.length > 0 ? lines.join(' · ') : 'Ready to load';
}

function formatSaveSlotDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function isSaveSlotsResponse(value: unknown): value is { slots: SaveSlotSummary[] } {
  return isRecord(value) && Array.isArray(value.slots) && value.slots.every((slot) => isSaveSlotSummary(slot));
}

function isSaveSlotSummary(value: unknown): value is SaveSlotSummary {
  return (
    isRecord(value) &&
    (value.slotId === 1 || value.slotId === 2 || value.slotId === 3) &&
    (typeof value.saveName === 'string' || value.saveName === null) &&
    (typeof value.updatedAt === 'string' || value.updatedAt === null) &&
    (typeof value.deckCardCount === 'number' || value.deckCardCount === null) &&
    (typeof value.leaderName === 'string' || value.leaderName === null) &&
    typeof value.isEmpty === 'boolean'
  );
}

function isSaveSlotState(value: unknown): value is SaveSlotState {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    (value.slotId === 1 || value.slotId === 2 || value.slotId === 3) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.saveName === 'string' &&
    isRecord(value.deck) &&
    typeof value.deck.id === 'string' &&
    isCardInstance(value.deck.leader) &&
    Array.isArray(value.deck.cards) &&
    value.deck.cards.every((entry) => isCardInstance(entry))
  );
}

function isCardInstance(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.instanceId === 'string' &&
    typeof value.definitionId === 'string' &&
    value.owner === 'PLAYER' &&
    (value.zone === 'LEADER' || value.zone === 'DECK') &&
    Number.isInteger(value.level) &&
    Number.isInteger(value.exp) &&
    Number.isInteger(value.currentHp) &&
    Number.isInteger(value.currentAttack)
  );
}

void bootstrap();
