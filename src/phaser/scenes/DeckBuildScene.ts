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
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { CanvasUiFactory, type CanvasScrollState, type UiLayoutChild } from '../ui/CanvasUiFactory';
import type { DeckBuildSceneData, StageSceneData } from './scene-data';

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
  private readonly ui = new CanvasUiFactory(this);
  private readonly primaryListScrollState: CanvasScrollState = { childOY: 0 };
  private readonly secondaryListScrollState: CanvasScrollState = { childOY: 0 };
  private savedSession!: GameSession;
  private draftSession!: GameSession;
  private mode: DeckBuildMode = 'UNIT';
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
    this.resetListScrollStates();
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
      variant: 'screenDim',
      origin: 0,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'screenShade',
      origin: 0,
    });
  }

  private addTitle(): void {
    this.ui.text({
      x: GAME_WIDTH / 2,
      y: 96,
      text: 'DECK BUILD',
      variant: 'screenTitle',
      align: 'center',
      origin: 0.5,
    });
    this.ui.text({
      x: GAME_WIDTH / 2,
      y: 154,
      text: 'Build LEADER and UNIT cards before battle',
      variant: 'subtitle',
      align: 'center',
      origin: 0.5,
      alpha: 0.9,
    });
  }

  private addStatusText(): void {
    this.statusText = this.ui.text({
      x: GAME_WIDTH / 2,
      y: this.getLayoutMetrics().statusY,
      text: 'UNIT deck configuration ready.',
      variant: 'status',
      align: 'center',
      origin: 0.5,
      wordWrapWidth: GAME_WIDTH - 120,
    });
  }

  private renderLists(preserveScroll = true): void {
    this.listContainer?.destroy();
    if (!preserveScroll) {
      this.resetListScrollStates();
    }
    const container = this.ui.container();
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
    const bodyLayout = this.ui.stack({
      x: PANEL_BODY_X,
      y: PANEL_Y,
      width: PANEL_BODY_WIDTH,
      height: panelHeight,
      orientation: 'x',
      origin: 0,
      gap: PANEL_GAP,
      children: [
        {
          gameObject: this.createCardPanel({
            title: 'Deck UNIT',
            subtitle: `${this.getDeckUnitEntries().length} cards`,
            entries: this.getDeckUnitEntries(),
            selectedInstanceId: null,
            scrollState: this.primaryListScrollState,
            emptyMessage: 'No UNIT cards in deck.',
            onSelect: (instanceId) => {
              this.handleRemoveFromDeck(instanceId);
            },
          }),
          align: 'left-top',
          minWidth: PANEL_WIDTH,
          minHeight: panelHeight,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createCardPanel({
            title: 'Collection UNIT',
            subtitle: `${this.getCollectionUnitEntries().length} cards`,
            entries: this.getCollectionUnitEntries(),
            selectedInstanceId: null,
            scrollState: this.secondaryListScrollState,
            emptyMessage: 'No collection UNIT cards yet.',
            onSelect: (instanceId) => {
              this.handleAddToDeck(instanceId);
            },
          }),
          align: 'left-top',
          minWidth: PANEL_WIDTH,
          minHeight: panelHeight,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
    container.add(bodyLayout);
  }

  private renderLeaderLists(container: Phaser.GameObjects.Container): void {
    const { panelHeight } = this.getLayoutMetrics();
    const bodyLayout = this.ui.stack({
      x: PANEL_BODY_X,
      y: PANEL_Y,
      width: PANEL_BODY_WIDTH,
      height: panelHeight,
      orientation: 'x',
      origin: 0,
      gap: PANEL_GAP,
      children: [
        {
          gameObject: this.createCardPanel({
            title: 'Current LEADER',
            subtitle: '1 card',
            entries: this.getDeckLeaderEntries(),
            selectedInstanceId: this.draftSession.deck.leader.instance.instanceId,
            scrollState: this.primaryListScrollState,
            emptyMessage: 'No current LEADER.',
            onSelect: () => {
              this.setStatus('Current LEADER is fixed until replaced.');
            },
          }),
          align: 'left-top',
          minWidth: PANEL_WIDTH,
          minHeight: panelHeight,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createCardPanel({
            title: 'Collection LEADER',
            subtitle: `${this.getCollectionLeaderEntries().length} cards`,
            entries: this.getCollectionLeaderEntries(),
            selectedInstanceId: null,
            scrollState: this.secondaryListScrollState,
            emptyMessage: 'No collection LEADER cards yet.',
            onSelect: (instanceId) => {
              this.handleSetLeader(instanceId);
            },
          }),
          align: 'left-top',
          minWidth: PANEL_WIDTH,
          minHeight: panelHeight,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
    container.add(bodyLayout);
  }

  private createModeTabs(): Phaser.GameObjects.Container {
    const container = this.ui.container();
    const layout = this.ui.stack({
      x: (GAME_WIDTH - MODE_TABS_WIDTH) / 2,
      y: 188,
      width: MODE_TABS_WIDTH,
      height: MODE_TABS_HEIGHT,
      orientation: 'x',
      origin: 0,
      gap: MODE_TABS_GAP,
      children: [
        {
          gameObject: this.createModeButton('UNIT'),
          align: 'left-top',
          minWidth: 220,
          minHeight: MODE_TABS_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createModeButton('LEADER'),
          align: 'left-top',
          minWidth: 220,
          minHeight: MODE_TABS_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
    container.add(layout);
    return container;
  }

  private createModeButton(mode: DeckBuildMode): Phaser.GameObjects.Container {
    const selected = this.mode === mode;
    const container = this.ui.container({ width: 220, height: 52 });
    const background = this.ui.pressableSurface({
      x: 110,
      y: 26,
      width: 220,
      height: 52,
      variant: selected ? 'tabSelected' : 'tab',
      hoverVariant: selected ? 'rowSelectedHover' : 'rowHover',
      origin: 0.5,
      onClick: () => {
        this.changeMode(mode);
      },
    });
    container.add(background);
    container.add(
      this.ui.text({
        x: 110,
        y: 26,
        text: mode,
        variant: selected ? 'tabSelected' : 'tab',
        align: 'center',
        origin: 0.5,
      }),
    );
    return container;
  }

  private createCardPanel(config: {
    title: string;
    subtitle: string;
    entries: DeckBuildListEntry[];
    selectedInstanceId: string | null;
    scrollState: CanvasScrollState;
    emptyMessage: string;
    onSelect: (instanceId: string) => void;
  }): Phaser.GameObjects.Container {
    const { panelHeight } = this.getLayoutMetrics();
    const viewportHeight = this.getPanelViewportHeight(panelHeight);
    const container = this.ui.container({ width: PANEL_WIDTH, height: panelHeight });
    const panel = this.ui.panel({
      x: 0,
      y: 0,
      width: PANEL_WIDTH,
      height: panelHeight,
      variant: 'panel',
      origin: 0,
    });
    container.add(panel);

    container.add(
      this.ui.text({
        x: 28,
        y: 38,
        text: config.title,
        variant: 'panelTitle',
        align: 'left',
        origin: { x: 0, y: 0.5 },
      }),
    );
    container.add(
      this.ui.text({
        x: PANEL_WIDTH - 28,
        y: 38,
        text: config.subtitle,
        variant: 'panelSubtitle',
        align: 'right',
        origin: { x: 1, y: 0.5 },
      }),
    );

    if (config.entries.length === 0) {
      config.scrollState.childOY = 0;
      container.add(this.createEmptyPanelMessage(config.emptyMessage, viewportHeight));
      return container;
    }

    const rowLayoutHeight = Math.max(
      viewportHeight,
      config.entries.length * CARD_ROW_HEIGHT +
        Math.max(0, config.entries.length - 1) * CARD_ROW_GAP,
    );
    const rowChildren: UiLayoutChild[] = [];
    config.entries.forEach((entry) => {
      const row = this.createCardRow({
        entry,
        selected: entry.card.instance.instanceId === config.selectedInstanceId,
        onSelect: config.onSelect,
      });
      rowChildren.push({
        gameObject: row,
        align: 'left-top',
        minWidth: PANEL_INNER_WIDTH,
        minHeight: CARD_ROW_HEIGHT,
      });
    });
    const rowLayout = this.ui.stack({
      x: 0,
      y: 0,
      width: PANEL_INNER_WIDTH,
      height: rowLayoutHeight,
      orientation: 'y',
      origin: 0,
      gap: CARD_ROW_GAP,
      children: rowChildren,
    });
    const scrollPanel = this.createCardScrollPanel(rowLayout, viewportHeight, config.scrollState);
    container.add(scrollPanel);
    return container;
  }

  private createEmptyPanelMessage(
    message: string,
    viewportHeight: number,
  ): Phaser.GameObjects.GameObject {
    const messageContainer = this.ui.container({
      width: PANEL_INNER_WIDTH,
      height: viewportHeight,
    });
    messageContainer.add(
      this.ui.text({
        x: PANEL_INNER_WIDTH / 2,
        y: viewportHeight / 2,
        text: message,
        variant: 'empty',
        align: 'center',
        origin: 0.5,
        wordWrapWidth: PANEL_WIDTH - 72,
      }),
    );
    return this.ui.overlay({
      x: 28,
      y: PANEL_HEADER_HEIGHT,
      width: PANEL_INNER_WIDTH,
      height: viewportHeight,
      origin: 0,
      children: [
        {
          gameObject: messageContainer,
          align: 'left-top',
          minWidth: PANEL_INNER_WIDTH,
          minHeight: viewportHeight,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
  }

  private createCardScrollPanel(
    child: Phaser.GameObjects.GameObject,
    viewportHeight: number,
    scrollState: CanvasScrollState,
  ) {
    return this.ui.scrollPanel({
      x: 28,
      y: PANEL_HEADER_HEIGHT,
      width: PANEL_SCROLL_PANEL_WIDTH,
      height: viewportHeight,
      child,
      scrollState,
      scrollbarWidth: PANEL_SCROLLBAR_WIDTH,
      scrollbarGap: PANEL_SCROLLBAR_GAP,
    });
  }

  private createCardRow(config: {
    entry: DeckBuildListEntry;
    selected: boolean;
    onSelect: (instanceId: string) => void;
  }): Phaser.GameObjects.GameObject {
    const card = config.entry.card;
    const background = this.ui.pressableSurface({
      x: 0,
      y: 0,
      width: PANEL_INNER_WIDTH,
      height: CARD_ROW_HEIGHT,
      variant: config.selected ? 'rowSelected' : 'row',
      hoverVariant: config.selected ? 'rowSelectedHover' : 'rowHover',
      origin: 0,
      onClick: () => {
        config.onSelect(card.instance.instanceId);
      },
    });
    const titleText = this.ui.text({
      x: 0,
      y: 0,
      text: `${config.entry.index + 1}. ${card.instance.name}`,
      variant: 'rowTitle',
      align: 'left',
      origin: { x: 0, y: 0.5 },
      fixedWidth: CARD_ROW_TEXT_WIDTH,
      fixedHeight: 24,
      wordWrapWidth: CARD_ROW_TEXT_WIDTH,
    });
    const statsText = this.ui.text({
      x: 0,
      y: 0,
      text: formatCardStats(card),
      variant: 'rowMeta',
      align: 'left',
      origin: { x: 0, y: 0.5 },
      fixedWidth: CARD_ROW_TEXT_WIDTH,
      fixedHeight: 24,
      wordWrapWidth: CARD_ROW_TEXT_WIDTH,
    });
    const idText = this.ui.text({
      x: 0,
      y: 0,
      text: card.definition.id,
      variant: 'rowId',
      align: 'left',
      origin: { x: 0, y: 0.5 },
      fixedWidth: CARD_ROW_TEXT_WIDTH,
      fixedHeight: 18,
      wordWrapWidth: CARD_ROW_TEXT_WIDTH,
    });
    const textLayout = this.ui.stack({
      x: 0,
      y: 0,
      width: CARD_ROW_TEXT_WIDTH,
      height: CARD_ROW_HEIGHT - 24,
      orientation: 'y',
      origin: 0,
      children: [
        {
          gameObject: titleText,
          align: 'left-center',
          minWidth: CARD_ROW_TEXT_WIDTH,
          minHeight: 24,
          expand: true,
        },
        {
          gameObject: statsText,
          align: 'left-center',
          minWidth: CARD_ROW_TEXT_WIDTH,
          minHeight: 24,
          padding: { top: 16, bottom: 4 },
          expand: true,
        },
        {
          gameObject: idText,
          align: 'left-center',
          minWidth: CARD_ROW_TEXT_WIDTH,
          minHeight: 18,
          padding: { top: 5 },
          expand: true,
        },
      ],
    });
    return this.ui.overlay({
      x: 0,
      y: 0,
      width: PANEL_INNER_WIDTH,
      height: CARD_ROW_HEIGHT,
      origin: 0,
      background,
      children: [
        {
          gameObject: textLayout,
          align: 'left-top',
          padding: { left: 18, top: 12, right: 30, bottom: 12 },
          expand: true,
        },
      ],
    });
  }

  private renderHud(): void {
    this.hudContainer?.destroy();
    const summaryText = this.isDirty ? 'Unsaved changes' : 'Saved deck';
    const layout = this.ui.stack({
      x: (GAME_WIDTH - HUD_WIDTH) / 2,
      y: this.getLayoutMetrics().hudY,
      width: HUD_WIDTH,
      height: HUD_BUTTON_HEIGHT,
      orientation: 'x',
      origin: 0,
      gap: HUD_BUTTON_GAP,
      children: [
        {
          gameObject: this.createHudButton('Back', HUD_BACK_BUTTON_WIDTH, !this.isSaving, () => {
            this.scene.start('StageScene', { session: this.savedSession } satisfies StageSceneData);
          }),
          align: 'left-top',
          minWidth: HUD_BACK_BUTTON_WIDTH,
          minHeight: HUD_BUTTON_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createHudButton(
            'Save',
            HUD_SAVE_BUTTON_WIDTH,
            this.isDirty && !this.isSaving,
            () => {
              void this.handleSave();
            },
          ),
          align: 'left-top',
          minWidth: HUD_SAVE_BUTTON_WIDTH,
          minHeight: HUD_BUTTON_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createHudSummary(summaryText, this.isDirty),
          align: 'left-top',
          minWidth: HUD_SUMMARY_WIDTH,
          minHeight: HUD_BUTTON_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
    this.hudContainer = layout;
  }

  private createHudButton(
    label: string,
    width: number,
    enabled: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const slot = this.ui.container({ width, height: HUD_BUTTON_HEIGHT });
    const button = enabled
      ? this.ui.button({
          x: width / 2,
          y: HUD_BUTTON_HEIGHT / 2,
          width,
          height: HUD_BUTTON_HEIGHT,
          label,
          enabled,
          onClick,
        })
      : this.ui.button({
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
    const slot = this.ui.container({ width: HUD_SUMMARY_WIDTH, height: HUD_BUTTON_HEIGHT });
    slot.add(
      this.ui.text({
        x: HUD_SUMMARY_WIDTH / 2,
        y: HUD_BUTTON_HEIGHT / 2,
        text,
        variant: isDirty ? 'hudSummaryDirty' : 'hudSummary',
        align: 'center',
        origin: 0.5,
      }),
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
    this.setStatus(
      mode === 'LEADER' ? 'LEADER configuration ready.' : 'UNIT deck configuration ready.',
    );
    this.renderLists(false);
    this.renderHud();
  }

  private resetListScrollStates(): void {
    this.primaryListScrollState.childOY = 0;
    this.secondaryListScrollState.childOY = 0;
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
