import Phaser from 'phaser';
import { consumeCollectionMaterialsForDeckGrowth } from '../../game/save/card-growth';
import { saveSlotState } from '../../game/save/client-api';
import {
  createGameSession,
  createSaveSlotStateFromGameSession,
  type GameSession,
  type RuntimeCardInstance,
} from '../../game/save/session';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
import type { GrowthSceneData, StageSceneData } from './scene-data';

const PANEL_Y = 248;
const PANEL_WIDTH = 500;
const CARD_ROW_HEIGHT = 124;
const CARD_ROW_GAP = 18;
const PANEL_GAP = 56;
const PANEL_BODY_WIDTH = PANEL_WIDTH * 2 + PANEL_GAP;
const PANEL_BODY_X = (GAME_WIDTH - PANEL_BODY_WIDTH) / 2;
const PANEL_INNER_WIDTH = PANEL_WIDTH - 56;
const CARD_ROW_TEXT_WIDTH = PANEL_WIDTH - 104;
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
const HUD_BUTTON_HEIGHT = 64;
const HUD_BUTTON_GAP = 51;
const HUD_BACK_BUTTON_WIDTH = 190;
const HUD_APPLY_BUTTON_WIDTH = 280;
const HUD_SAVE_BUTTON_WIDTH = 180;
const HUD_SUMMARY_WIDTH = 300;
const HUD_WIDTH =
  HUD_BACK_BUTTON_WIDTH +
  HUD_APPLY_BUTTON_WIDTH +
  HUD_SAVE_BUTTON_WIDTH +
  HUD_SUMMARY_WIDTH +
  HUD_BUTTON_GAP * 3;
const HUD_BOTTOM_SAFE_MARGIN = 128;
const STATUS_HUD_GAP = 86;
const PANEL_STATUS_GAP = 74;

type GrowthLayoutMetrics = {
  hudY: number;
  panelHeight: number;
  statusY: number;
};

type GrowthListEntry = {
  card: RuntimeCardInstance;
  index: number;
};

/**
 * 현재 덱 UNIT 카드 1장을 대상으로 컬렉션 UNIT 카드를 재료 소모해 성장시키는 화면이다.
 * 성장 EXP 계산과 저장 가능한 세션 변경은 save 도메인 모듈에 위임하고, 이 씬은 선택과 저장 흐름만 담당한다.
 */
export class GrowthScene extends Phaser.Scene {
  private savedSession!: GameSession;
  private draftSession!: GameSession;
  private selectedTargetCardInstanceId: string | null = null;
  private selectedMaterialCardInstanceIds = new Set<string>();
  private focusedTargetCardInstanceId: string | null = null;
  private focusedMaterialCardInstanceId: string | null = null;
  private isDirty = false;
  private isSaving = false;
  private statusText!: Phaser.GameObjects.Text;
  private listContainer: Phaser.GameObjects.Container | null = null;
  private hudContainer: Phaser.GameObjects.GameObject | null = null;

  constructor() {
    super({ key: 'GrowthScene' });
  }

  /**
   * StageScene에서 전달받은 세션을 기준으로 성장 대상과 재료 카드 목록을 렌더링한다.
   */
  create(data: GrowthSceneData): void {
    this.savedSession = data.session;
    this.draftSession = data.session;
    this.selectedTargetCardInstanceId = null;
    this.selectedMaterialCardInstanceIds = new Set();
    this.focusedTargetCardInstanceId = null;
    this.focusedMaterialCardInstanceId = null;
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
      .text(GAME_WIDTH / 2, 96, 'CARD GROWTH', {
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
      .text(GAME_WIDTH / 2, 154, 'Use Collection UNIT cards as materials for Current Deck UNITs', {
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
      .text(
        GAME_WIDTH / 2,
        this.getLayoutMetrics().statusY,
        'Select a deck UNIT and collection materials.',
        {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: '#e6f4df',
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 120 },
        },
      )
      .setOrigin(0.5);
  }

  private renderLists(): void {
    this.listContainer?.destroy();
    const container = this.add.container(0, 0);
    this.listContainer = container;
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
        title: 'Current Deck Target',
        subtitle: `${this.getTargetEntries().length} cards`,
        entries: this.getTargetEntries(),
        selectedInstanceIds: new Set(
          this.selectedTargetCardInstanceId ? [this.selectedTargetCardInstanceId] : [],
        ),
        focusInstanceId: this.focusedTargetCardInstanceId ?? this.selectedTargetCardInstanceId,
        emptyMessage: 'No growable deck UNIT cards.',
        onSelect: (instanceId) => {
          this.selectedTargetCardInstanceId = instanceId;
          this.focusedTargetCardInstanceId = instanceId;
          this.setStatus('Growth target selected.');
          this.renderLists();
          this.renderHud();
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
        title: 'Collection Materials',
        subtitle: `${this.selectedMaterialCardInstanceIds.size} / ${
          this.getMaterialEntries().length
        } selected`,
        entries: this.getMaterialEntries(),
        selectedInstanceIds: this.selectedMaterialCardInstanceIds,
        focusInstanceId: this.focusedMaterialCardInstanceId,
        emptyMessage: 'No collection UNIT materials.',
        onSelect: (instanceId) => {
          this.toggleMaterialSelection(instanceId);
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

  private createCardPanel(config: {
    title: string;
    subtitle: string;
    entries: GrowthListEntry[];
    selectedInstanceIds: ReadonlySet<string>;
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

    let focusedRow: Phaser.GameObjects.GameObject | null = null;
    config.entries.forEach((entry) => {
      const row = this.createCardRow({
        entry,
        selected: config.selectedInstanceIds.has(entry.card.instance.instanceId),
        onSelect: config.onSelect,
      });
      if (entry.card.instance.instanceId === config.focusInstanceId) {
        focusedRow = row;
      }

      rowLayout.add(row, {
        align: 'left-top',
        minWidth: PANEL_INNER_WIDTH,
        minHeight: CARD_ROW_HEIGHT,
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
    entry: GrowthListEntry;
    selected: boolean;
    onSelect: (instanceId: string) => void;
  }): Phaser.GameObjects.GameObject {
    const row = this.rexUI.add.overlapSizer(0, 0, PANEL_INNER_WIDTH, CARD_ROW_HEIGHT, {
      origin: 0,
    });
    const card = config.entry.card;
    const fillColor = config.selected ? 0x31543d : 0x17352d;
    const strokeColor = config.selected ? 0xffe4a8 : 0x78a98d;
    const background = this.add
      .rectangle(0, 0, PANEL_INNER_WIDTH, CARD_ROW_HEIGHT, fillColor, 0.92)
      .setOrigin(0, 0);
    background.setStrokeStyle(config.selected ? 3 : 1, strokeColor, config.selected ? 0.95 : 0.5);
    background.setInteractive({ useHandCursor: true });
    row.addBackground(background);

    const textLayout = this.rexUI.add.sizer(0, 0, CARD_ROW_TEXT_WIDTH, CARD_ROW_HEIGHT - 24, 'y', {
      origin: 0,
    });
    const titleText = this.add
      .text(0, 0, `${config.entry.index + 1}. ${card.instance.name}`, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '22px',
        color: '#f5fff0',
        align: 'left',
        fixedWidth: CARD_ROW_TEXT_WIDTH,
        fixedHeight: 24,
        wordWrap: { width: CARD_ROW_TEXT_WIDTH },
      })
      .setOrigin(0, 0.5);
    const statsText = this.add
      .text(0, 0, formatCardStats(card), {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '17px',
        color: '#d7ead4',
        align: 'left',
        fixedWidth: CARD_ROW_TEXT_WIDTH,
        fixedHeight: 24,
        wordWrap: { width: CARD_ROW_TEXT_WIDTH },
      })
      .setOrigin(0, 0.5);
    const idText = this.add
      .text(0, 0, card.definition.id, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '14px',
        color: '#92aa9e',
        align: 'left',
        fixedWidth: CARD_ROW_TEXT_WIDTH,
        fixedHeight: 18,
        wordWrap: { width: CARD_ROW_TEXT_WIDTH },
      })
      .setOrigin(0, 0.5);
    textLayout.add(titleText, {
      align: 'left-center',
      minWidth: CARD_ROW_TEXT_WIDTH,
      minHeight: 24,
      expand: true,
    });
    textLayout.add(statsText, {
      align: 'left-center',
      minWidth: CARD_ROW_TEXT_WIDTH,
      minHeight: 24,
      padding: { top: 16, bottom: 4 },
      expand: true,
    });
    textLayout.add(idText, {
      align: 'left-center',
      minWidth: CARD_ROW_TEXT_WIDTH,
      minHeight: 18,
      padding: { top: 5 },
      expand: true,
    });
    row.add(textLayout, {
      align: 'left-top',
      padding: { left: 18, top: 12, right: 30, bottom: 12 },
      expand: true,
    });

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      background.setFillStyle(config.selected ? 0x3c684a : 0x24513d, 0.98);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      background.setFillStyle(fillColor, 0.92);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      config.onSelect(card.instance.instanceId);
    });
    row.layout();
    return row;
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
    const canApply =
      !this.isSaving &&
      this.selectedTargetCardInstanceId !== null &&
      this.selectedMaterialCardInstanceIds.size > 0;

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
      this.createHudButton('Apply Growth', HUD_APPLY_BUTTON_WIDTH, canApply, () => {
        this.handleApplyGrowth();
      }),
      {
        align: 'left-top',
        minWidth: HUD_APPLY_BUTTON_WIDTH,
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

    const summaryText = this.isDirty ? 'Unsaved growth' : 'Saved growth';
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

  private toggleMaterialSelection(instanceId: string): void {
    this.focusedMaterialCardInstanceId = instanceId;
    if (this.selectedMaterialCardInstanceIds.has(instanceId)) {
      this.selectedMaterialCardInstanceIds.delete(instanceId);
      this.setStatus('Material removed from selection.');
    } else {
      this.selectedMaterialCardInstanceIds.add(instanceId);
      this.setStatus('Material selected.');
    }

    this.renderLists();
    this.renderHud();
  }

  private handleApplyGrowth(): void {
    if (!this.selectedTargetCardInstanceId || this.selectedMaterialCardInstanceIds.size === 0) {
      return;
    }

    try {
      const result = consumeCollectionMaterialsForDeckGrowth(this.draftSession, {
        targetDeckCardInstanceId: this.selectedTargetCardInstanceId,
        materialCollectionCardInstanceIds: Array.from(this.selectedMaterialCardInstanceIds),
      });
      this.draftSession = result.session;
      this.isDirty = true;
      this.selectedMaterialCardInstanceIds = new Set();
      this.focusedMaterialCardInstanceId = null;
      this.setStatus(formatGrowthResultStatus(result));
      this.renderLists();
      this.renderHud();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Growth failed: ${message}`);
    }
  }

  private async handleSave(): Promise<void> {
    if (!this.isDirty || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.setStatus('Saving growth changes...');
    this.renderHud();

    try {
      const savedState = await saveSlotState(createSaveSlotStateFromGameSession(this.draftSession));
      const savedSession = createGameSession(savedState);
      this.savedSession = savedSession;
      this.draftSession = savedSession;
      this.isDirty = false;
      this.selectedTargetCardInstanceId = null;
      this.selectedMaterialCardInstanceIds = new Set();
      this.focusedTargetCardInstanceId = null;
      this.focusedMaterialCardInstanceId = null;
      this.setStatus('Growth changes saved.');
      this.renderLists();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Save failed: ${message}`);
    } finally {
      this.isSaving = false;
      this.renderHud();
    }
  }

  private getTargetEntries(): GrowthListEntry[] {
    return this.draftSession.deck.cards
      .map((card, index) => ({ card, index }))
      .filter(
        (entry) => entry.card.definition.type === 'UNIT' && entry.card.instance.type === 'UNIT',
      );
  }

  private getMaterialEntries(): GrowthListEntry[] {
    return this.draftSession.collection.cards
      .map((card, index) => ({ card, index }))
      .filter(
        (entry) => entry.card.definition.type === 'UNIT' && entry.card.instance.type === 'UNIT',
      );
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
  }

  private handleScaleResize(): void {
    this.statusText.setY(this.getLayoutMetrics().statusY);
    this.renderLists();
    this.renderHud();
  }

  private getLayoutMetrics(): GrowthLayoutMetrics {
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
  const level = card.instance.level ?? card.definition.level ?? 1;
  const exp = card.instance.exp ?? card.definition.exp ?? 0;
  const cost = card.instance.cost ?? card.definition.cost ?? 0;
  const dominance = card.instance.dominance ?? card.definition.dominance ?? 0;
  const hp = card.instance.hp ?? card.definition.hp ?? 0;
  const attack = card.instance.attack ?? card.definition.attack ?? 0;

  return `Lv ${level} · EXP ${exp} · cost ${cost} · dom ${dominance} · hp ${hp} · atk ${attack}`;
}

function formatGrowthResultStatus(result: {
  targetCardName: string;
  totalMaterialExp: number;
  previousLevel: number;
  nextLevel: number;
  appliedGrowth: Array<{ stat: string; value: number }>;
}): string {
  const levelText =
    result.previousLevel === result.nextLevel
      ? `Lv ${result.nextLevel}`
      : `Lv ${result.previousLevel} -> ${result.nextLevel}`;
  const growthText =
    result.appliedGrowth.length > 0
      ? ` Growth: ${result.appliedGrowth
          .map((growth) => `${growth.stat}+${growth.value}`)
          .join(', ')}.`
      : '';

  return `${result.targetCardName} gained ${result.totalMaterialExp} EXP. ${levelText}.${growthText}`;
}
