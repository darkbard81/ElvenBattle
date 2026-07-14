import Phaser from 'phaser';
import {
  equipCollectionEquipmentToDeckUnit,
  unequipEquipmentFromDeckUnit,
} from '../../game/save/equipment';
import {
  createGameSession,
  createSaveSlotStateFromGameSession,
  type GameSession,
  type RuntimeCardInstance,
} from '../../game/save/session';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { getGameServices } from '../services/game-services';
import { CanvasUiFactory, type CanvasScrollState, type UiLayoutChild } from '../ui/CanvasUiFactory';
import type { EquipmentSceneData, StageSceneData } from './scene-data';

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
const HUD_BUTTON_GAP = 81;
const HUD_BACK_BUTTON_WIDTH = 190;
const HUD_SAVE_BUTTON_WIDTH = 180;
const HUD_SUMMARY_WIDTH = 360;
const HUD_WIDTH =
  HUD_BACK_BUTTON_WIDTH + HUD_SAVE_BUTTON_WIDTH + HUD_SUMMARY_WIDTH + HUD_BUTTON_GAP * 2;
const HUD_BOTTOM_SAFE_MARGIN = 128;
const STATUS_HUD_GAP = 86;
const PANEL_STATUS_GAP = 74;

type EquipmentLayoutMetrics = {
  hudY: number;
  panelHeight: number;
  statusY: number;
};

type EquipmentUnitEntry = {
  card: RuntimeCardInstance;
  index: number;
  usedSlot: number;
  capacity: number;
  equippedNames: string[];
};

type EquipmentListEntry = {
  card: RuntimeCardInstance;
  index: number;
  equippedTargetName: string | null;
  equippedToSelected: boolean;
};

/**
 * 현재 덱 UNIT 카드에 보유 EQUIPMENT 카드를 장착하거나 해제하는 화면이다.
 * slot 제한과 능력 중복 검사는 save 도메인 모듈에 위임하고, 이 씬은 선택과 저장 흐름만 담당한다.
 */
export class EquipmentScene extends Phaser.Scene {
  private readonly ui = new CanvasUiFactory(this);
  private readonly unitListScrollState: CanvasScrollState = { childOY: 0 };
  private readonly equipmentListScrollState: CanvasScrollState = { childOY: 0 };
  private savedSession!: GameSession;
  private draftSession!: GameSession;
  private selectedTargetCardInstanceId: string | null = null;
  private isDirty = false;
  private isSaving = false;
  private statusText!: Phaser.GameObjects.Text;
  private listContainer: Phaser.GameObjects.Container | null = null;
  private hudContainer: Phaser.GameObjects.GameObject | null = null;

  constructor() {
    super({ key: 'EquipmentScene' });
  }

  /**
   * StageScene에서 전달받은 세션을 기준으로 장착 대상과 보유 장비 목록을 렌더링한다.
   */
  create(data: EquipmentSceneData): void {
    this.savedSession = data.session;
    this.draftSession = data.session;
    this.selectedTargetCardInstanceId = null;
    this.unitListScrollState.childOY = 0;
    this.equipmentListScrollState.childOY = 0;
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
      text: 'EQUIPMENT',
      variant: 'screenTitle',
      align: 'center',
      origin: 0.5,
    });
    this.ui.text({
      x: GAME_WIDTH / 2,
      y: 154,
      text: 'Equip Collection cards to Deck UNITs before battle',
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
      text: 'Select a deck UNIT to manage equipment.',
      variant: 'status',
      align: 'center',
      origin: 0.5,
      wordWrapWidth: GAME_WIDTH - 120,
    });
  }

  private renderLists(): void {
    this.ensureSelectedTargetExists();
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
          gameObject: this.createUnitPanel(),
          align: 'left-top',
          minWidth: PANEL_WIDTH,
          minHeight: panelHeight,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createEquipmentPanel(),
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

  private createUnitPanel(): Phaser.GameObjects.Container {
    const entries = this.getUnitEntries();
    const container = this.createPanelShell({
      title: 'Deck UNIT',
      subtitle: `${entries.length} cards`,
    });

    if (entries.length === 0) {
      this.unitListScrollState.childOY = 0;
      container.add(this.createEmptyPanelMessage('No deck UNIT cards.'));
      return container;
    }

    const viewportHeight = this.getPanelViewportHeight(this.getLayoutMetrics().panelHeight);
    const rowLayoutHeight = Math.max(
      viewportHeight,
      entries.length * CARD_ROW_HEIGHT + Math.max(0, entries.length - 1) * CARD_ROW_GAP,
    );
    const rowChildren: UiLayoutChild[] = [];
    entries.forEach((entry) => {
      const selected = entry.card.instance.instanceId === this.selectedTargetCardInstanceId;
      const row = this.createUnitRow({
        entry,
        selected,
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
    const scrollPanel = this.createCardScrollPanel(
      rowLayout,
      viewportHeight,
      this.unitListScrollState,
    );
    container.add(scrollPanel);
    return container;
  }

  private createEquipmentPanel(): Phaser.GameObjects.Container {
    const entries = this.getEquipmentEntries();
    const selectedTarget = this.getSelectedTargetCard();
    const container = this.createPanelShell({
      title: 'Collection Equipment',
      subtitle: selectedTarget ? formatSelectedSlotSummary(this.getSelectedUnitEntry()) : 'No UNIT',
    });

    if (entries.length === 0) {
      this.equipmentListScrollState.childOY = 0;
      container.add(this.createEmptyPanelMessage('No collection EQUIPMENT cards.'));
      return container;
    }

    const viewportHeight = this.getPanelViewportHeight(this.getLayoutMetrics().panelHeight);
    const rowLayoutHeight = Math.max(
      viewportHeight,
      entries.length * CARD_ROW_HEIGHT + Math.max(0, entries.length - 1) * CARD_ROW_GAP,
    );
    const rowChildren: UiLayoutChild[] = [];
    entries.forEach((entry) => {
      const row = this.createEquipmentRow({
        entry,
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
    const scrollPanel = this.createCardScrollPanel(
      rowLayout,
      viewportHeight,
      this.equipmentListScrollState,
    );
    container.add(scrollPanel);
    return container;
  }

  private createPanelShell(config: {
    title: string;
    subtitle: string;
  }): Phaser.GameObjects.Container {
    const { panelHeight } = this.getLayoutMetrics();
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
    return container;
  }

  private createEmptyPanelMessage(message: string): Phaser.GameObjects.GameObject {
    const viewportHeight = this.getPanelViewportHeight(this.getLayoutMetrics().panelHeight);
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

  private createUnitRow(config: {
    entry: EquipmentUnitEntry;
    selected: boolean;
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
        this.selectedTargetCardInstanceId = card.instance.instanceId;
        this.setStatus(`${card.instance.name} selected.`);
        this.renderLists();
        this.renderHud();
      },
    });
    return this.createInteractiveRow(
      background,
      `${config.entry.index + 1}. ${card.instance.name}`,
      formatUnitStats(config.entry),
      formatEquippedNames(config.entry),
      false,
    );
  }

  private createEquipmentRow(config: { entry: EquipmentListEntry }): Phaser.GameObjects.GameObject {
    const card = config.entry.card;
    const normalVariant = config.entry.equippedToSelected
      ? 'rowSelected'
      : config.entry.equippedTargetName
        ? 'rowAssigned'
        : 'row';
    const background = this.ui.pressableSurface({
      x: 0,
      y: 0,
      width: PANEL_INNER_WIDTH,
      height: CARD_ROW_HEIGHT,
      variant: normalVariant,
      hoverVariant: config.entry.equippedToSelected ? 'rowSelectedHover' : 'rowHover',
      origin: 0,
      onClick: () => this.handleToggleEquipment(card.instance.instanceId),
    });
    return this.createInteractiveRow(
      background,
      `${config.entry.index + 1}. ${card.instance.name}`,
      formatEquipmentStats(card),
      formatEquipmentAssignment(config.entry),
      config.entry.equippedToSelected,
    );
  }

  private createInteractiveRow(
    background: Phaser.GameObjects.Rectangle,
    title: string,
    stats: string,
    detail: string,
    emphasizedDetail: boolean,
  ): Phaser.GameObjects.GameObject {
    const titleText = this.ui.text({
      x: 0,
      y: 0,
      text: title,
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
      text: stats,
      variant: 'rowMeta',
      align: 'left',
      origin: { x: 0, y: 0.5 },
      fixedWidth: CARD_ROW_TEXT_WIDTH,
      fixedHeight: 24,
      wordWrapWidth: CARD_ROW_TEXT_WIDTH,
    });
    const detailText = this.ui.text({
      x: 0,
      y: 0,
      text: detail,
      variant: emphasizedDetail ? 'rowIdSelected' : 'rowId',
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
          gameObject: detailText,
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
    const summaryText = this.isDirty ? 'Unsaved equipment' : 'Saved equipment';
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

  private handleToggleEquipment(equipmentCardInstanceId: string): void {
    if (this.isSaving) {
      return;
    }

    const selectedTarget = this.getSelectedTargetCard();
    if (!selectedTarget) {
      this.setStatus('Select a deck UNIT first.');
      return;
    }

    const attachment = this.findAttachmentForEquipment(equipmentCardInstanceId);
    if (attachment && attachment.targetCardInstanceId !== selectedTarget.instance.instanceId) {
      this.setStatus(
        `${this.getEquipmentName(equipmentCardInstanceId)} is equipped to ${this.getUnitName(
          attachment.targetCardInstanceId,
        )}.`,
      );
      return;
    }

    try {
      if (attachment) {
        this.draftSession = unequipEquipmentFromDeckUnit(this.draftSession, {
          targetDeckCardInstanceId: selectedTarget.instance.instanceId,
          equipmentCardInstanceId,
        });
        this.isDirty = true;
        this.setStatus(`${this.getEquipmentName(equipmentCardInstanceId)} unequipped.`);
      } else {
        this.draftSession = equipCollectionEquipmentToDeckUnit(this.draftSession, {
          targetDeckCardInstanceId: selectedTarget.instance.instanceId,
          equipmentCardInstanceId,
        });
        this.isDirty = true;
        this.setStatus(
          `${this.getEquipmentName(equipmentCardInstanceId)} equipped to ${selectedTarget.instance.name}.`,
        );
      }
      this.renderLists();
      this.renderHud();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Equipment failed: ${message}`);
    }
  }

  private async handleSave(): Promise<void> {
    if (!this.isDirty || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.setStatus('Saving equipment changes...');
    this.renderHud();

    try {
      const savedState = await getGameServices(this).saveSlots.save(
        createSaveSlotStateFromGameSession(this.draftSession),
      );
      const savedSession = createGameSession(savedState);
      this.savedSession = savedSession;
      this.draftSession = savedSession;
      this.isDirty = false;
      this.setStatus('Equipment changes saved.');
      this.renderLists();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Save failed: ${message}`);
    } finally {
      this.isSaving = false;
      this.renderHud();
    }
  }

  private getUnitEntries(): EquipmentUnitEntry[] {
    return this.draftSession.deck.cards
      .map((card, index) => ({
        card,
        index,
        usedSlot: this.getUsedSlot(card.instance.instanceId),
        capacity: readCardNumber(card.instance.slot ?? card.definition.slot),
        equippedNames: this.getEquippedNames(card.instance.instanceId),
      }))
      .filter(
        (entry) => entry.card.definition.type === 'UNIT' && entry.card.instance.type === 'UNIT',
      );
  }

  private getEquipmentEntries(): EquipmentListEntry[] {
    return this.draftSession.collection.cards
      .map((card, index) => {
        const attachment = this.findAttachmentForEquipment(card.instance.instanceId);
        return {
          card,
          index,
          equippedTargetName: attachment ? this.getUnitName(attachment.targetCardInstanceId) : null,
          equippedToSelected:
            attachment?.targetCardInstanceId === this.selectedTargetCardInstanceId,
        };
      })
      .filter(
        (entry) =>
          entry.card.definition.type === 'EQUIPMENT' && entry.card.instance.type === 'EQUIPMENT',
      );
  }

  private getSelectedUnitEntry(): EquipmentUnitEntry | null {
    return (
      this.getUnitEntries().find(
        (entry) => entry.card.instance.instanceId === this.selectedTargetCardInstanceId,
      ) ?? null
    );
  }

  private getSelectedTargetCard(): RuntimeCardInstance | null {
    return this.getSelectedUnitEntry()?.card ?? null;
  }

  private ensureSelectedTargetExists(): void {
    if (!this.selectedTargetCardInstanceId) {
      return;
    }

    if (
      !this.getUnitEntries().some(
        (entry) => entry.card.instance.instanceId === this.selectedTargetCardInstanceId,
      )
    ) {
      this.selectedTargetCardInstanceId = null;
    }
  }

  private findAttachmentForEquipment(equipmentCardInstanceId: string) {
    return (
      this.draftSession.equipment.equipped.find(
        (attachment) => attachment.equipmentCardInstanceId === equipmentCardInstanceId,
      ) ?? null
    );
  }

  private getUsedSlot(targetCardInstanceId: string): number {
    return this.draftSession.equipment.equipped
      .filter((attachment) => attachment.targetCardInstanceId === targetCardInstanceId)
      .reduce((total, attachment) => {
        const equipment = this.draftSession.collection.cards.find(
          (card) => card.instance.instanceId === attachment.equipmentCardInstanceId,
        );
        return total + readCardNumber(equipment?.instance.slot ?? equipment?.definition.slot);
      }, 0);
  }

  private getEquippedNames(targetCardInstanceId: string): string[] {
    return this.draftSession.equipment.equipped
      .filter((attachment) => attachment.targetCardInstanceId === targetCardInstanceId)
      .map((attachment) => this.getEquipmentName(attachment.equipmentCardInstanceId));
  }

  private getUnitName(targetCardInstanceId: string): string {
    return (
      this.draftSession.deck.cards.find((card) => card.instance.instanceId === targetCardInstanceId)
        ?.instance.name ?? targetCardInstanceId
    );
  }

  private getEquipmentName(equipmentCardInstanceId: string): string {
    return (
      this.draftSession.collection.cards.find(
        (card) => card.instance.instanceId === equipmentCardInstanceId,
      )?.instance.name ?? equipmentCardInstanceId
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

  private getLayoutMetrics(): EquipmentLayoutMetrics {
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

function formatSelectedSlotSummary(entry: EquipmentUnitEntry | null): string {
  if (!entry) {
    return 'No UNIT';
  }

  return `slot ${entry.usedSlot}/${entry.capacity}`;
}

function formatUnitStats(entry: EquipmentUnitEntry): string {
  const cost = readCardNumber(entry.card.instance.cost ?? entry.card.definition.cost);
  const dominance = readCardNumber(
    entry.card.instance.dominance ?? entry.card.definition.dominance,
  );
  const hp = readCardNumber(entry.card.instance.hp ?? entry.card.definition.hp);
  const attack = readCardNumber(entry.card.instance.attack ?? entry.card.definition.attack);

  return `slot ${entry.usedSlot}/${entry.capacity} · cost ${cost} · dom ${dominance} · hp ${hp} · atk ${attack}`;
}

function formatEquippedNames(entry: EquipmentUnitEntry): string {
  if (entry.equippedNames.length === 0) {
    return 'No equipment';
  }

  return `Equipped: ${entry.equippedNames.join(', ')}`;
}

function formatEquipmentStats(card: RuntimeCardInstance): string {
  const slot = readCardNumber(card.instance.slot ?? card.definition.slot);
  const cost = readCardNumber(card.instance.cost ?? card.definition.cost);
  const dominance = readCardNumber(card.instance.dominance ?? card.definition.dominance);
  const hp = readCardNumber(card.instance.hp ?? card.definition.hp);
  const attack = readCardNumber(card.instance.attack ?? card.definition.attack);

  return `slot ${slot} · cost +${cost} · dom +${dominance} · hp +${hp} · atk +${attack}`;
}

function formatEquipmentAssignment(entry: EquipmentListEntry): string {
  if (entry.equippedToSelected) {
    return 'Equipped to selected UNIT';
  }

  if (entry.equippedTargetName) {
    return `Equipped to ${entry.equippedTargetName}`;
  }

  return entry.card.definition.id;
}

function readCardNumber(value: number | undefined): number {
  return Math.max(0, value ?? 0);
}
