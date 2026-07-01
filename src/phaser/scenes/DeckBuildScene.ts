import Phaser from 'phaser';
import { saveSlotState } from '../../game/save/client-api';
import {
  changeDeckLeaderWithCollectionLeader,
  moveCollectionUnitToDeck,
  moveDeckUnitToCollection,
} from '../../game/save/deck-building';
import {
  createGameSession,
  createSaveSlotStateFromGameSession,
  type GameSession,
  type RuntimeCardInstance,
} from '../../game/save/session';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
import type { DeckBuildSceneData, StageSceneData } from './scene-data';

const PANEL_Y = 248;
const PANEL_WIDTH = 500;
const CARD_ROW_HEIGHT = 124;
const CARD_ROW_GAP = 18;
const PANEL_GAP = 56;
const PANEL_BODY_WIDTH = PANEL_WIDTH * 2 + PANEL_GAP;
const PANEL_BODY_X = (GAME_WIDTH - PANEL_BODY_WIDTH) / 2;
const PANEL_INNER_WIDTH = PANEL_WIDTH - 56;
const PANEL_HEADER_HEIGHT = 104;
const PANEL_BOTTOM_PADDING = 28;
const PANEL_SCROLLBAR_WIDTH = 10;
const PANEL_SCROLLBAR_GAP = 10;
const PANEL_SCROLL_PANEL_WIDTH = PANEL_INNER_WIDTH + PANEL_SCROLLBAR_GAP + PANEL_SCROLLBAR_WIDTH;
const MIN_VISIBLE_CARD_ROWS = 3;
const MIN_PANEL_HEIGHT =
  PANEL_HEADER_HEIGHT +
  CARD_ROW_HEIGHT * MIN_VISIBLE_CARD_ROWS +
  CARD_ROW_GAP * (MIN_VISIBLE_CARD_ROWS - 1) +
  PANEL_BOTTOM_PADDING;
const MODE_TABS_WIDTH = 476;
const MODE_TABS_HEIGHT = 52;
const MODE_TABS_GAP = 36;
const HUD_BUTTON_HEIGHT = 64;
const HUD_BUTTON_GAP = 81;
const HUD_BACK_BUTTON_WIDTH = 190;
const HUD_SAVE_BUTTON_WIDTH = 180;
const HUD_SUMMARY_WIDTH = 360;
const HUD_WIDTH =
  HUD_BACK_BUTTON_WIDTH + HUD_SAVE_BUTTON_WIDTH + HUD_SUMMARY_WIDTH + HUD_BUTTON_GAP * 2;
const HUD_BOTTOM_SAFE_MARGIN = 128;
const STATUS_HUD_GAP = 86;
const PANEL_STATUS_GAP = 74;

type DeckBuildLayoutMetrics = {
  hudY: number;
  panelHeight: number;
  statusY: number;
};

type DeckBuildListEntry = {
  card: RuntimeCardInstance;
  index: number;
};

type DeckBuildMode = 'LEADER' | 'UNIT';

/**
 * 전투 전 LEADER 교체와 UNIT 구성을 덱과 보유 컬렉션 사이에서 조정하는 화면이다.
 * 실제 카드 이동 규칙과 저장 직렬화는 save 도메인 모듈에 위임하고, 이 씬은 선택과 저장 흐름만 담당한다.
 */
export class DeckBuildScene extends Phaser.Scene {
  private savedSession!: GameSession;
  private draftSession!: GameSession;
  private mode: DeckBuildMode = 'UNIT';
  private focusedCardInstanceId: string | null = null;
  private isDirty = false;
  private isSaving = false;
  private statusText!: Phaser.GameObjects.Text;
  private listContainer: Phaser.GameObjects.Container | null = null;
  private hudContainer: Phaser.GameObjects.GameObject | null = null;

  constructor() {
    super({ key: 'DeckBuildScene' });
  }

  /**
   * StageScene에서 전달받은 세션을 기준으로 덱과 보유 카드 목록을 렌더링한다.
   */
  create(data: DeckBuildSceneData): void {
    this.savedSession = data.session;
    this.draftSession = data.session;
    this.mode = 'UNIT';
    this.focusedCardInstanceId = null;
    this.isDirty = false;
    this.isSaving = false;

    this.addBackground();
    this.addTitle();
    this.addStatusText();
    this.renderLists();
    this.renderHud();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
    });
  }

  private addBackground(): void {
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.66).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.18).setOrigin(0, 0);
  }

  private addTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, 96, 'DECK BUILD', {
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
      .text(GAME_WIDTH / 2, 154, 'Build LEADER and UNIT cards before battle', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
  }

  private addStatusText(): void {
    this.statusText = this.add
      .text(GAME_WIDTH / 2, this.getLayoutMetrics().statusY, 'UNIT deck configuration ready.', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '22px',
        color: '#e6f4df',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 120 },
      })
      .setOrigin(0.5);
  }

  private renderLists(): void {
    this.listContainer?.destroy();
    const container = this.add.container(0, 0);
    this.listContainer = container;
    container.add(this.createModeTabs());

    if (this.mode === 'LEADER') {
      this.renderLeaderLists(container);
      return;
    }

    this.renderUnitLists(container);
  }

  private renderUnitLists(container: Phaser.GameObjects.Container): void {
    const { panelHeight } = this.getLayoutMetrics();
    const bodyLayout = this.rexUI.add.sizer(
      PANEL_BODY_X,
      PANEL_Y,
      PANEL_BODY_WIDTH,
      panelHeight,
      'x',
      {
        origin: 0,
        space: { item: PANEL_GAP },
      },
    );

    bodyLayout.add(
      this.createCardPanel({
        title: 'Deck UNIT',
        subtitle: `${this.getDeckUnitEntries().length} cards`,
        entries: this.getDeckUnitEntries(),
        selectedInstanceId: null,
        focusInstanceId: this.focusedCardInstanceId,
        emptyMessage: 'No UNIT cards in deck.',
        onSelect: (instanceId) => {
          this.handleRemoveFromDeck(instanceId);
        },
      }),
      {
        align: 'left-top',
        minWidth: PANEL_WIDTH,
        minHeight: panelHeight,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );

    bodyLayout.add(
      this.createCardPanel({
        title: 'Collection UNIT',
        subtitle: `${this.getCollectionUnitEntries().length} cards`,
        entries: this.getCollectionUnitEntries(),
        selectedInstanceId: null,
        focusInstanceId: this.focusedCardInstanceId,
        emptyMessage: 'No collection UNIT cards yet.',
        onSelect: (instanceId) => {
          this.handleAddToDeck(instanceId);
        },
      }),
      {
        align: 'left-top',
        minWidth: PANEL_WIDTH,
        minHeight: panelHeight,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );

    bodyLayout.layout();
    container.add(bodyLayout);
  }

  private renderLeaderLists(container: Phaser.GameObjects.Container): void {
    const { panelHeight } = this.getLayoutMetrics();
    const bodyLayout = this.rexUI.add.sizer(
      PANEL_BODY_X,
      PANEL_Y,
      PANEL_BODY_WIDTH,
      panelHeight,
      'x',
      {
        origin: 0,
        space: { item: PANEL_GAP },
      },
    );

    bodyLayout.add(
      this.createCardPanel({
        title: 'Current LEADER',
        subtitle: '1 card',
        entries: this.getDeckLeaderEntries(),
        selectedInstanceId: this.draftSession.deck.leader.instance.instanceId,
        focusInstanceId: this.focusedCardInstanceId,
        emptyMessage: 'No current LEADER.',
        onSelect: () => {
          this.setStatus('Current LEADER is fixed until replaced.');
        },
      }),
      {
        align: 'left-top',
        minWidth: PANEL_WIDTH,
        minHeight: panelHeight,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );

    bodyLayout.add(
      this.createCardPanel({
        title: 'Collection LEADER',
        subtitle: `${this.getCollectionLeaderEntries().length} cards`,
        entries: this.getCollectionLeaderEntries(),
        selectedInstanceId: null,
        focusInstanceId: this.focusedCardInstanceId,
        emptyMessage: 'No collection LEADER cards yet.',
        onSelect: (instanceId) => {
          this.handleSetLeader(instanceId);
        },
      }),
      {
        align: 'left-top',
        minWidth: PANEL_WIDTH,
        minHeight: panelHeight,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );

    bodyLayout.layout();
    container.add(bodyLayout);
  }

  private createModeTabs(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const layout = this.rexUI.add.sizer(
      (GAME_WIDTH - MODE_TABS_WIDTH) / 2,
      188,
      MODE_TABS_WIDTH,
      MODE_TABS_HEIGHT,
      'x',
      {
        origin: 0,
        space: { item: MODE_TABS_GAP },
      },
    );

    layout.add(this.createModeButton('UNIT'), {
      align: 'left-top',
      minWidth: 220,
      minHeight: MODE_TABS_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    layout.add(this.createModeButton('LEADER'), {
      align: 'left-top',
      minWidth: 220,
      minHeight: MODE_TABS_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    layout.layout();
    container.add(layout);
    return container;
  }

  private createModeButton(mode: DeckBuildMode): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(220, 52);
    const selected = this.mode === mode;
    const background = this.add
      .rectangle(110, 26, 220, 52, selected ? 0x31543d : 0x12211c, 0.96)
      .setOrigin(0.5);
    background.setStrokeStyle(2, selected ? 0xffe4a8 : 0x78a98d, selected ? 0.95 : 0.56);
    background.setInteractive({ useHandCursor: true });
    container.add(background);
    container.add(
      this.add
        .text(110, 26, mode, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: selected ? '#fff3c2' : '#d7ead4',
          align: 'center',
        })
        .setOrigin(0.5),
    );
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.changeMode(mode);
    });
    return container;
  }

  private createCardPanel(config: {
    title: string;
    subtitle: string;
    entries: DeckBuildListEntry[];
    selectedInstanceId: string | null;
    focusInstanceId: string | null;
    emptyMessage: string;
    onSelect: (instanceId: string) => void;
  }): Phaser.GameObjects.Container {
    const { panelHeight } = this.getLayoutMetrics();
    const viewportHeight = this.getPanelViewportHeight(panelHeight);
    const container = this.add.container(0, 0);
    container.setSize(PANEL_WIDTH, panelHeight);
    const panel = this.add.rectangle(0, 0, PANEL_WIDTH, panelHeight, 0x10261f, 0.94);
    panel.setOrigin(0, 0);
    panel.setStrokeStyle(2, 0xbfeec5, 0.64);
    container.add(panel);

    container.add(
      this.add
        .text(28, 38, config.title, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '30px',
          fontStyle: '700',
          color: '#f5fff0',
          align: 'left',
        })
        .setOrigin(0, 0.5),
    );
    container.add(
      this.add
        .text(PANEL_WIDTH - 28, 38, config.subtitle, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '18px',
          color: '#a8d2af',
          align: 'right',
        })
        .setOrigin(1, 0.5),
    );

    if (config.entries.length === 0) {
      container.add(this.createEmptyPanelMessage(config.emptyMessage, viewportHeight));
      return container;
    }

    const rowLayoutHeight = Math.max(
      viewportHeight,
      config.entries.length * CARD_ROW_HEIGHT +
        Math.max(0, config.entries.length - 1) * CARD_ROW_GAP,
    );
    const rowLayout = this.rexUI.add.sizer(0, 0, PANEL_INNER_WIDTH, rowLayoutHeight, 'y', {
      origin: 0,
      space: { item: CARD_ROW_GAP },
    });

    let focusedRow: Phaser.GameObjects.Container | null = null;
    config.entries.forEach((entry) => {
      const row = this.createCardRow({
        entry,
        selected: entry.card.instance.instanceId === config.selectedInstanceId,
        onSelect: config.onSelect,
      });
      if (entry.card.instance.instanceId === config.focusInstanceId) {
        focusedRow = row;
      }

      rowLayout.add(row, {
        align: 'left-top',
        minWidth: PANEL_INNER_WIDTH,
        minHeight: CARD_ROW_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      });
    });
    rowLayout.layout();
    const scrollPanel = this.createCardScrollPanel(rowLayout, viewportHeight);
    scrollPanel.layout();
    if (focusedRow) {
      scrollPanel.scrollToChild(focusedRow, 'centerY');
    }
    container.add(scrollPanel);
    return container;
  }

  private createEmptyPanelMessage(
    message: string,
    viewportHeight: number,
  ): Phaser.GameObjects.GameObject {
    const layout = this.rexUI.add.overlapSizer(
      28,
      PANEL_HEADER_HEIGHT,
      PANEL_INNER_WIDTH,
      viewportHeight,
      {
        origin: 0,
      },
    );

    const messageContainer = this.add.container(0, 0);
    messageContainer.setSize(PANEL_INNER_WIDTH, viewportHeight);
    messageContainer.add(
      this.add
        .text(PANEL_INNER_WIDTH / 2, viewportHeight / 2, message, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '24px',
          color: '#b8c9c0',
          align: 'center',
          wordWrap: { width: PANEL_WIDTH - 72 },
        })
        .setOrigin(0.5),
    );
    layout.add(messageContainer, {
      align: 'left-top',
      minWidth: PANEL_INNER_WIDTH,
      minHeight: viewportHeight,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    layout.layout();
    return layout;
  }

  private createCardScrollPanel(child: Phaser.GameObjects.GameObject, viewportHeight: number) {
    return this.rexUI.add.scrollablePanel({
      x: 28,
      y: PANEL_HEADER_HEIGHT,
      width: PANEL_SCROLL_PANEL_WIDTH,
      height: viewportHeight,
      origin: 0,
      scrollMode: 'y',
      clampChildOY: true,
      panel: {
        child,
        mask: { padding: 2 },
      },
      space: {
        sliderY: PANEL_SCROLLBAR_GAP,
      },
      slider: {
        track: this.add.rectangle(0, 0, PANEL_SCROLLBAR_WIDTH, viewportHeight, 0x07130f, 0.72),
        thumb: this.add.rectangle(0, 0, PANEL_SCROLLBAR_WIDTH, 48, 0xbfeec5, 0.78),
        position: 'right',
        input: 'drag',
        hideUnscrollableSlider: true,
        disableUnscrollableDrag: true,
        adaptThumbSize: true,
        minThumbSize: 42,
      },
      scroller: {
        threshold: 8,
        slidingDeceleration: 4200,
        backDeceleration: 2200,
        pointerOutRelease: true,
      },
      mouseWheelScroller: {
        focus: false,
        speed: 0.22,
      },
      scrollDetectionMode: 'rectBounds',
    });
  }

  private createCardRow(config: {
    entry: DeckBuildListEntry;
    selected: boolean;
    onSelect: (instanceId: string) => void;
  }): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(PANEL_INNER_WIDTH, CARD_ROW_HEIGHT);
    const card = config.entry.card;
    const fillColor = config.selected ? 0x31543d : 0x17352d;
    const strokeColor = config.selected ? 0xffe4a8 : 0x78a98d;
    const background = this.add
      .rectangle(0, 0, PANEL_INNER_WIDTH, CARD_ROW_HEIGHT, fillColor, 0.92)
      .setOrigin(0, 0);
    background.setStrokeStyle(config.selected ? 3 : 1, strokeColor, config.selected ? 0.95 : 0.5);
    background.setInteractive({ useHandCursor: true });
    container.add(background);

    container.add(
      this.add
        .text(18, 24, `${config.entry.index + 1}. ${card.instance.name}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: '#f5fff0',
          align: 'left',
          wordWrap: { width: PANEL_WIDTH - 104 },
        })
        .setOrigin(0, 0.5),
    );

    container.add(
      this.add
        .text(18, 64, formatCardStats(card), {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#d7ead4',
          align: 'left',
          wordWrap: { width: PANEL_WIDTH - 104 },
        })
        .setOrigin(0, 0.5),
    );

    container.add(
      this.add
        .text(18, 94, card.definition.id, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '14px',
          color: '#92aa9e',
          align: 'left',
          wordWrap: { width: PANEL_WIDTH - 104 },
        })
        .setOrigin(0, 0.5),
    );

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      background.setFillStyle(config.selected ? 0x3c684a : 0x24513d, 0.98);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      background.setFillStyle(fillColor, 0.92);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      config.onSelect(card.instance.instanceId);
    });
    return container;
  }

  private renderHud(): void {
    this.hudContainer?.destroy();
    const layout = this.rexUI.add.sizer(
      (GAME_WIDTH - HUD_WIDTH) / 2,
      this.getLayoutMetrics().hudY,
      HUD_WIDTH,
      HUD_BUTTON_HEIGHT,
      'x',
      {
        origin: 0,
        space: { item: HUD_BUTTON_GAP },
      },
    );

    layout.add(
      this.createHudButton('Back', HUD_BACK_BUTTON_WIDTH, !this.isSaving, () => {
        this.scene.start('StageScene', { session: this.savedSession } satisfies StageSceneData);
      }),
      {
        align: 'left-top',
        minWidth: HUD_BACK_BUTTON_WIDTH,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );
    layout.add(
      this.createHudButton('Save', HUD_SAVE_BUTTON_WIDTH, this.isDirty && !this.isSaving, () => {
        void this.handleSave();
      }),
      {
        align: 'left-top',
        minWidth: HUD_SAVE_BUTTON_WIDTH,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );

    const summaryText = this.isDirty ? 'Unsaved changes' : 'Saved deck';
    layout.add(this.createHudSummary(summaryText, this.isDirty), {
      align: 'left-top',
      minWidth: HUD_SUMMARY_WIDTH,
      minHeight: HUD_BUTTON_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    layout.layout();
    this.hudContainer = layout;
  }

  private createHudButton(
    label: string,
    width: number,
    enabled: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const slot = this.add.container(0, 0);
    slot.setSize(width, HUD_BUTTON_HEIGHT);
    const button = enabled
      ? createMenuButton(this, {
          x: width / 2,
          y: HUD_BUTTON_HEIGHT / 2,
          width,
          height: HUD_BUTTON_HEIGHT,
          label,
          enabled,
          onClick,
        })
      : createMenuButton(this, {
          x: width / 2,
          y: HUD_BUTTON_HEIGHT / 2,
          width,
          height: HUD_BUTTON_HEIGHT,
          label,
          enabled,
        });

    slot.add(button);
    return slot;
  }

  private createHudSummary(text: string, isDirty: boolean): Phaser.GameObjects.Container {
    const slot = this.add.container(0, 0);
    slot.setSize(HUD_SUMMARY_WIDTH, HUD_BUTTON_HEIGHT);
    slot.add(
      this.add
        .text(HUD_SUMMARY_WIDTH / 2, HUD_BUTTON_HEIGHT / 2, text, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: isDirty ? '#fff3c2' : '#bfeec5',
          align: 'center',
        })
        .setOrigin(0.5),
    );
    return slot;
  }

  private handleAddToDeck(collectionCardInstanceId: string): void {
    if (this.isSaving) {
      return;
    }

    const collectionCard = this.findCardByInstanceId(
      this.getCollectionUnitEntries(),
      collectionCardInstanceId,
    );

    try {
      this.draftSession = moveCollectionUnitToDeck(this.draftSession, {
        collectionCardInstanceId,
      });
      this.isDirty = true;
      this.focusedCardInstanceId = collectionCardInstanceId;
      this.setStatus(`${collectionCard?.instance.name ?? 'Collection card'} added to deck.`);
      this.renderLists();
      this.renderHud();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Add failed: ${message}`);
    }
  }

  private handleRemoveFromDeck(deckCardInstanceId: string): void {
    if (this.isSaving) {
      return;
    }

    const deckCard = this.findCardByInstanceId(this.getDeckUnitEntries(), deckCardInstanceId);

    try {
      this.draftSession = moveDeckUnitToCollection(this.draftSession, {
        deckCardInstanceId,
      });
      this.isDirty = true;
      this.focusedCardInstanceId = deckCardInstanceId;
      this.setStatus(`${deckCard?.instance.name ?? 'Deck card'} removed to collection.`);
      this.renderLists();
      this.renderHud();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Remove failed: ${message}`);
    }
  }

  private handleSetLeader(collectionLeaderInstanceId: string): void {
    if (this.isSaving) {
      return;
    }

    const leaderCard = this.findCardByInstanceId(
      this.getCollectionLeaderEntries(),
      collectionLeaderInstanceId,
    );

    try {
      this.draftSession = changeDeckLeaderWithCollectionLeader(this.draftSession, {
        collectionLeaderInstanceId,
      });
      this.isDirty = true;
      this.focusedCardInstanceId = collectionLeaderInstanceId;
      this.setStatus(`${leaderCard?.instance.name ?? 'Collection LEADER'} set as leader.`);
      this.renderLists();
      this.renderHud();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Set Leader failed: ${message}`);
    }
  }

  private async handleSave(): Promise<void> {
    if (!this.isDirty || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.setStatus('Saving deck configuration...');
    this.renderHud();

    try {
      const savedState = await saveSlotState(createSaveSlotStateFromGameSession(this.draftSession));
      const savedSession = createGameSession(savedState);
      this.savedSession = savedSession;
      this.draftSession = savedSession;
      this.isDirty = false;
      this.setStatus('Deck configuration saved.');
      this.renderLists();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Save failed: ${message}`);
    } finally {
      this.isSaving = false;
      this.renderHud();
    }
  }

  private changeMode(mode: DeckBuildMode): void {
    if (this.mode === mode || this.isSaving) {
      return;
    }

    this.mode = mode;
    this.focusedCardInstanceId = null;
    this.setStatus(
      mode === 'LEADER' ? 'LEADER configuration ready.' : 'UNIT deck configuration ready.',
    );
    this.renderLists();
    this.renderHud();
  }

  private getDeckLeaderEntries(): DeckBuildListEntry[] {
    const leader = this.draftSession.deck.leader;
    if (leader.definition.type !== 'LEADER' || leader.instance.type !== 'LEADER') {
      return [];
    }

    return [{ card: leader, index: 0 }];
  }

  private getDeckUnitEntries(): DeckBuildListEntry[] {
    return this.draftSession.deck.cards
      .map((card, index) => ({ card, index }))
      .filter(
        (entry) => entry.card.definition.type === 'UNIT' && entry.card.instance.type === 'UNIT',
      );
  }

  private getCollectionLeaderEntries(): DeckBuildListEntry[] {
    return this.draftSession.collection.cards
      .map((card, index) => ({ card, index }))
      .filter(
        (entry) => entry.card.definition.type === 'LEADER' && entry.card.instance.type === 'LEADER',
      );
  }

  private getCollectionUnitEntries(): DeckBuildListEntry[] {
    return this.draftSession.collection.cards
      .map((card, index) => ({ card, index }))
      .filter(
        (entry) => entry.card.definition.type === 'UNIT' && entry.card.instance.type === 'UNIT',
      );
  }

  private findCardByInstanceId(
    entries: DeckBuildListEntry[],
    instanceId: string,
  ): RuntimeCardInstance | null {
    return entries.find((entry) => entry.card.instance.instanceId === instanceId)?.card ?? null;
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
  }

  private handleScaleResize(): void {
    this.statusText.setY(this.getLayoutMetrics().statusY);
    this.renderLists();
    this.renderHud();
  }

  private getLayoutMetrics(): DeckBuildLayoutMetrics {
    const gameHeight = this.getGameHeight();
    const hudY = gameHeight - HUD_BOTTOM_SAFE_MARGIN - HUD_BUTTON_HEIGHT;
    const statusY = hudY - STATUS_HUD_GAP;

    return {
      hudY,
      panelHeight: Math.max(MIN_PANEL_HEIGHT, statusY - PANEL_STATUS_GAP - PANEL_Y),
      statusY,
    };
  }

  private getPanelViewportHeight(panelHeight: number): number {
    return Math.max(
      MIN_PANEL_HEIGHT - PANEL_HEADER_HEIGHT,
      panelHeight - PANEL_HEADER_HEIGHT - PANEL_BOTTOM_PADDING,
    );
  }

  private getGameHeight(): number {
    const gameHeight = this.scale.gameSize.height;
    return gameHeight > 0 ? gameHeight : GAME_HEIGHT;
  }
}

function formatCardStats(card: RuntimeCardInstance): string {
  const cost = card.instance.cost ?? card.definition.cost ?? 0;
  const dominance = card.instance.dominance ?? card.definition.dominance ?? 0;
  const hp = card.instance.hp ?? card.definition.hp ?? 0;
  const attack = card.instance.attack ?? card.definition.attack ?? 0;

  return `cost ${cost} · dom ${dominance} · hp ${hp} · atk ${attack}`;
}
