import Phaser from 'phaser';
import { consumeCollectionMaterialsForDeckGrowth } from '../../game/save/card-growth';
import {
  createGameSession,
  createSaveSlotStateFromGameSession,
  type GameSession,
  type RuntimeCardInstance,
} from '../../game/save/session';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { getGameServices } from '../services/game-services';
import { CanvasUiFactory, type CanvasScrollState, type UiLayoutChild } from '../ui/CanvasUiFactory';
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
  private readonly ui = new CanvasUiFactory(this);
  private readonly targetListScrollState: CanvasScrollState = { childOY: 0 };
  private readonly materialListScrollState: CanvasScrollState = { childOY: 0 };
  private savedSession!: GameSession;
  private draftSession!: GameSession;
  private selectedTargetCardInstanceId: string | null = null;
  private selectedMaterialCardInstanceIds = new Set<string>();
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
    this.targetListScrollState.childOY = 0;
    this.materialListScrollState.childOY = 0;
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
      origin: 0,
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
      text: 'CARD GROWTH',
      variant: 'screenTitle',
      align: 'center',
      origin: 0.5,
    });
    this.ui.text({
      x: GAME_WIDTH / 2,
      y: 154,
      text: 'Use Collection UNIT cards as materials for Current Deck UNITs',
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
      text: 'Select a deck UNIT and collection materials.',
      variant: 'status',
      align: 'center',
      origin: 0.5,
      wordWrapWidth: GAME_WIDTH - 120,
    });
  }

  private renderLists(): void {
    this.listContainer?.destroy();
    const container = this.ui.container();
    this.listContainer = container;
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
            title: 'Current Deck Target',
            subtitle: `${this.getTargetEntries().length} cards`,
            entries: this.getTargetEntries(),
            selectedInstanceIds: new Set(
              this.selectedTargetCardInstanceId ? [this.selectedTargetCardInstanceId] : [],
            ),
            scrollState: this.targetListScrollState,
            emptyMessage: 'No growable deck UNIT cards.',
            onSelect: (instanceId) => {
              this.selectedTargetCardInstanceId = instanceId;
              this.setStatus('Growth target selected.');
              this.renderLists();
              this.renderHud();
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
            title: 'Collection Materials',
            subtitle: `${this.selectedMaterialCardInstanceIds.size} / ${
              this.getMaterialEntries().length
            } selected`,
            entries: this.getMaterialEntries(),
            selectedInstanceIds: this.selectedMaterialCardInstanceIds,
            scrollState: this.materialListScrollState,
            emptyMessage: 'No collection UNIT materials.',
            onSelect: (instanceId) => {
              this.toggleMaterialSelection(instanceId);
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

  private createCardPanel(config: {
    title: string;
    subtitle: string;
    entries: GrowthListEntry[];
    selectedInstanceIds: ReadonlySet<string>;
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
        selected: config.selectedInstanceIds.has(entry.card.instance.instanceId),
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
    entry: GrowthListEntry;
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
      onClick: () => config.onSelect(card.instance.instanceId),
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
    const canApply =
      !this.isSaving &&
      this.selectedTargetCardInstanceId !== null &&
      this.selectedMaterialCardInstanceIds.size > 0;

    const summaryText = this.isDirty ? 'Unsaved growth' : 'Saved growth';
    const child = (gameObject: Phaser.GameObjects.GameObject, width: number) => ({
      gameObject,
      align: 'left-top' as const,
      minWidth: width,
      minHeight: HUD_BUTTON_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    const layout = this.ui.stack({
      x: (GAME_WIDTH - HUD_WIDTH) / 2,
      y: this.getLayoutMetrics().hudY,
      width: HUD_WIDTH,
      height: HUD_BUTTON_HEIGHT,
      orientation: 'x',
      origin: 0,
      gap: HUD_BUTTON_GAP,
      children: [
        child(
          this.createHudButton('Back', HUD_BACK_BUTTON_WIDTH, !this.isSaving, () =>
            this.scene.start('StageScene', { session: this.savedSession } satisfies StageSceneData),
          ),
          HUD_BACK_BUTTON_WIDTH,
        ),
        child(
          this.createHudButton('Apply Growth', HUD_APPLY_BUTTON_WIDTH, canApply, () =>
            this.handleApplyGrowth(),
          ),
          HUD_APPLY_BUTTON_WIDTH,
        ),
        child(
          this.createHudButton(
            'Save',
            HUD_SAVE_BUTTON_WIDTH,
            this.isDirty && !this.isSaving,
            () => {
              void this.handleSave();
            },
          ),
          HUD_SAVE_BUTTON_WIDTH,
        ),
        child(this.createHudSummary(summaryText, this.isDirty), HUD_SUMMARY_WIDTH),
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

  private toggleMaterialSelection(instanceId: string): void {
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
      const savedState = await getGameServices(this).saveSlots.save(
        createSaveSlotStateFromGameSession(this.draftSession),
      );
      const savedSession = createGameSession(savedState);
      this.savedSession = savedSession;
      this.draftSession = savedSession;
      this.isDirty = false;
      this.selectedTargetCardInstanceId = null;
      this.selectedMaterialCardInstanceIds = new Set();
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
