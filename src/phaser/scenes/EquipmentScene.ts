import Phaser from 'phaser';
import { saveSlotState } from '../../game/save/client-api';
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
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
import type { EquipmentSceneData, StageSceneData } from './scene-data';

const CARD_PAGE_SIZE = 8;
const PANEL_Y = 248;
const PANEL_WIDTH = 500;
const PANEL_HEIGHT = 1320;
const CARD_ROW_HEIGHT = 124;
const CARD_ROW_GAP = 18;
const PANEL_GAP = 56;
const PANEL_BODY_X = 72;
const PANEL_BODY_WIDTH = PANEL_WIDTH * 2 + PANEL_GAP;
const PANEL_INNER_WIDTH = PANEL_WIDTH - 56;
const PANEL_BUTTON_HEIGHT = 44;
const HUD_BUTTON_HEIGHT = 64;

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
  private savedSession!: GameSession;
  private draftSession!: GameSession;
  private selectedTargetCardInstanceId: string | null = null;
  private targetPage = 0;
  private equipmentPage = 0;
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
    this.targetPage = 0;
    this.equipmentPage = 0;
    this.isDirty = false;
    this.isSaving = false;

    this.addBackground();
    this.addTitle();
    this.addStatusText();
    this.renderLists();
    this.renderHud();
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
      .text(GAME_WIDTH / 2, 96, 'EQUIPMENT', {
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
      .text(GAME_WIDTH / 2, 154, 'Equip Collection cards to Deck UNITs before battle', {
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
      .text(GAME_WIDTH / 2, 1642, 'Select a deck UNIT to manage equipment.', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '22px',
        color: '#e6f4df',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 120 },
      })
      .setOrigin(0.5);
  }

  private renderLists(): void {
    this.ensureSelectedTargetExists();
    this.listContainer?.destroy();
    const container = this.add.container(0, 0);
    this.listContainer = container;
    const bodyLayout = this.rexUI.add.sizer(
      PANEL_BODY_X,
      PANEL_Y,
      PANEL_BODY_WIDTH,
      PANEL_HEIGHT,
      'x',
      {
        origin: 0,
        space: { item: PANEL_GAP },
      },
    );

    bodyLayout.add(this.createUnitPanel(), {
      align: 'left-top',
      minWidth: PANEL_WIDTH,
      minHeight: PANEL_HEIGHT,
      offsetX: -PANEL_WIDTH / 2,
      offsetY: -PANEL_HEIGHT / 2,
    });
    bodyLayout.add(this.createEquipmentPanel(), {
      align: 'left-top',
      minWidth: PANEL_WIDTH,
      minHeight: PANEL_HEIGHT,
      offsetX: -PANEL_WIDTH / 2,
      offsetY: -PANEL_HEIGHT / 2,
    });
    bodyLayout.layout();
    container.add(bodyLayout);
  }

  private createUnitPanel(): Phaser.GameObjects.Container {
    const entries = this.getUnitEntries();
    const container = this.createPanelShell({
      title: 'Deck UNIT',
      subtitle: `${entries.length} cards`,
    });

    if (entries.length === 0) {
      container.add(this.createEmptyPanelMessage('No deck UNIT cards.'));
      container.add(
        this.createPagination({
          entries,
          page: this.targetPage,
          onPageChange: (page) => {
            this.targetPage = page;
            this.renderLists();
          },
        }),
      );
      return container;
    }

    const maxPage = getMaxPage(entries.length);
    const page = Math.min(this.targetPage, maxPage);
    const pageEntries = entries.slice(page * CARD_PAGE_SIZE, (page + 1) * CARD_PAGE_SIZE);
    const rowLayout = this.rexUI.add.sizer(28, 104, PANEL_INNER_WIDTH, 1150, 'y', {
      origin: 0,
      space: { item: CARD_ROW_GAP },
    });

    pageEntries.forEach((entry) => {
      rowLayout.add(
        this.createUnitRow({
          entry,
          selected: entry.card.instance.instanceId === this.selectedTargetCardInstanceId,
        }),
        {
          align: 'left-top',
          minWidth: PANEL_INNER_WIDTH,
          minHeight: CARD_ROW_HEIGHT,
          offsetX: -PANEL_INNER_WIDTH / 2,
          offsetY: -CARD_ROW_HEIGHT / 2,
        },
      );
    });
    rowLayout.layout();
    container.add(rowLayout);

    container.add(
      this.createPagination({
        entries,
        page,
        onPageChange: (nextPage) => {
          this.targetPage = nextPage;
          this.renderLists();
        },
      }),
    );
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
      container.add(this.createEmptyPanelMessage('No collection EQUIPMENT cards.'));
      container.add(
        this.createPagination({
          entries,
          page: this.equipmentPage,
          onPageChange: (page) => {
            this.equipmentPage = page;
            this.renderLists();
          },
        }),
      );
      return container;
    }

    const maxPage = getMaxPage(entries.length);
    const page = Math.min(this.equipmentPage, maxPage);
    const pageEntries = entries.slice(page * CARD_PAGE_SIZE, (page + 1) * CARD_PAGE_SIZE);
    const rowLayout = this.rexUI.add.sizer(28, 104, PANEL_INNER_WIDTH, 1150, 'y', {
      origin: 0,
      space: { item: CARD_ROW_GAP },
    });

    pageEntries.forEach((entry) => {
      rowLayout.add(
        this.createEquipmentRow({
          entry,
        }),
        {
          align: 'left-top',
          minWidth: PANEL_INNER_WIDTH,
          minHeight: CARD_ROW_HEIGHT,
          offsetX: -PANEL_INNER_WIDTH / 2,
          offsetY: -CARD_ROW_HEIGHT / 2,
        },
      );
    });
    rowLayout.layout();
    container.add(rowLayout);

    container.add(
      this.createPagination({
        entries,
        page,
        onPageChange: (nextPage) => {
          this.equipmentPage = nextPage;
          this.renderLists();
        },
      }),
    );
    return container;
  }

  private createPanelShell(config: {
    title: string;
    subtitle: string;
  }): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(PANEL_WIDTH, PANEL_HEIGHT);
    const panel = this.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x10261f, 0.94);
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
    return container;
  }

  private createEmptyPanelMessage(message: string): Phaser.GameObjects.GameObject {
    const layout = this.rexUI.add.overlapSizer(28, 470, PANEL_INNER_WIDTH, 200, {
      origin: 0,
    });

    const messageContainer = this.add.container(0, 0);
    messageContainer.setSize(PANEL_INNER_WIDTH, 200);
    messageContainer.add(
      this.add
        .text(PANEL_INNER_WIDTH / 2, 100, message, {
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
      minHeight: 200,
      offsetX: -PANEL_INNER_WIDTH / 2,
      offsetY: -100,
    });
    layout.layout();
    return layout;
  }

  private createUnitRow(config: {
    entry: EquipmentUnitEntry;
    selected: boolean;
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
        .text(18, 64, formatUnitStats(config.entry), {
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
        .text(18, 94, formatEquippedNames(config.entry), {
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
      this.selectedTargetCardInstanceId = card.instance.instanceId;
      this.setStatus(`${card.instance.name} selected.`);
      this.renderLists();
      this.renderHud();
    });
    return container;
  }

  private createEquipmentRow(config: { entry: EquipmentListEntry }): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(PANEL_INNER_WIDTH, CARD_ROW_HEIGHT);
    const card = config.entry.card;
    const fillColor = config.entry.equippedToSelected ? 0x31543d : 0x17352d;
    const strokeColor = config.entry.equippedToSelected
      ? 0xffe4a8
      : config.entry.equippedTargetName
        ? 0xa8a05f
        : 0x78a98d;
    const background = this.add
      .rectangle(0, 0, PANEL_INNER_WIDTH, CARD_ROW_HEIGHT, fillColor, 0.92)
      .setOrigin(0, 0);
    background.setStrokeStyle(config.entry.equippedToSelected ? 3 : 1, strokeColor, 0.75);
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
        .text(18, 64, formatEquipmentStats(card), {
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
        .text(18, 94, formatEquipmentAssignment(config.entry), {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '14px',
          color: config.entry.equippedToSelected ? '#fff3c2' : '#92aa9e',
          align: 'left',
          wordWrap: { width: PANEL_WIDTH - 104 },
        })
        .setOrigin(0, 0.5),
    );

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      background.setFillStyle(config.entry.equippedToSelected ? 0x3c684a : 0x24513d, 0.98);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      background.setFillStyle(fillColor, 0.92);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.handleToggleEquipment(card.instance.instanceId);
    });
    return container;
  }

  private createPagination(config: {
    entries: unknown[];
    page: number;
    onPageChange: (page: number) => void;
  }): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const maxPage = getMaxPage(config.entries.length);
    const page = Math.min(config.page, maxPage);
    const layout = this.rexUI.add.sizer(
      28,
      PANEL_HEIGHT - 80,
      PANEL_INNER_WIDTH,
      PANEL_BUTTON_HEIGHT,
      'x',
      {
        origin: 0,
      },
    );

    layout.add(
      this.createPanelButton('Prev', page > 0, () => {
        config.onPageChange(page - 1);
      }),
      {
        align: 'left-top',
        minWidth: 112,
        minHeight: PANEL_BUTTON_HEIGHT,
        offsetX: -56,
        offsetY: -PANEL_BUTTON_HEIGHT / 2,
      },
    );
    layout.addSpace();
    layout.add(this.createPageIndicator(`${page + 1} / ${maxPage + 1}`), {
      align: 'left-top',
      minWidth: 120,
      minHeight: PANEL_BUTTON_HEIGHT,
      offsetX: -60,
      offsetY: -PANEL_BUTTON_HEIGHT / 2,
    });
    layout.addSpace();
    layout.add(
      this.createPanelButton('Next', page < maxPage, () => {
        config.onPageChange(page + 1);
      }),
      {
        align: 'left-top',
        minWidth: 112,
        minHeight: PANEL_BUTTON_HEIGHT,
        offsetX: -56,
        offsetY: -PANEL_BUTTON_HEIGHT / 2,
      },
    );
    layout.layout();
    container.add(layout);
    return container;
  }

  private createPageIndicator(label: string): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(120, PANEL_BUTTON_HEIGHT);
    container.add(
      this.add
        .text(60, PANEL_BUTTON_HEIGHT / 2, label, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '19px',
          color: '#d7ead4',
          align: 'center',
        })
        .setOrigin(0.5),
    );
    return container;
  }

  private createPanelButton(
    label: string,
    enabled: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(112, PANEL_BUTTON_HEIGHT);
    const background = this.add.rectangle(
      56,
      PANEL_BUTTON_HEIGHT / 2,
      112,
      PANEL_BUTTON_HEIGHT,
      enabled ? 0x1d3f31 : 0x12211c,
      enabled ? 0.96 : 0.72,
    );
    background.setStrokeStyle(2, enabled ? 0xdaf6d3 : 0x51605a, enabled ? 0.9 : 0.5);
    container.add(background);
    container.add(
      this.add
        .text(56, PANEL_BUTTON_HEIGHT / 2, label, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '18px',
          color: enabled ? '#f5fff0' : '#7e8b84',
          align: 'center',
        })
        .setOrigin(0.5),
    );

    if (enabled) {
      background.setInteractive({ useHandCursor: true });
      background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onClick);
    }

    return container;
  }

  private renderHud(): void {
    this.hudContainer?.destroy();
    const layout = this.rexUI.add.sizer(69, 1728, 892, HUD_BUTTON_HEIGHT, 'x', {
      origin: 0,
      space: { item: 81 },
    });

    layout.add(
      this.createHudButton('Back', 190, !this.isSaving, () => {
        this.scene.start('StageScene', { session: this.savedSession } satisfies StageSceneData);
      }),
      {
        align: 'left-top',
        minWidth: 190,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetX: -95,
        offsetY: -HUD_BUTTON_HEIGHT / 2,
      },
    );
    layout.add(
      this.createHudButton('Save', 180, this.isDirty && !this.isSaving, () => {
        void this.handleSave();
      }),
      {
        align: 'left-top',
        minWidth: 180,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetX: -90,
        offsetY: -HUD_BUTTON_HEIGHT / 2,
      },
    );

    const summaryText = this.isDirty ? 'Unsaved equipment' : 'Saved equipment';
    layout.add(this.createHudSummary(summaryText, this.isDirty), {
      align: 'left-top',
      minWidth: 360,
      minHeight: HUD_BUTTON_HEIGHT,
      offsetX: -180,
      offsetY: -HUD_BUTTON_HEIGHT / 2,
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
    slot.setSize(360, HUD_BUTTON_HEIGHT);
    slot.add(
      this.add
        .text(180, HUD_BUTTON_HEIGHT / 2, text, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: isDirty ? '#fff3c2' : '#bfeec5',
          align: 'center',
        })
        .setOrigin(0.5),
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
      const savedState = await saveSlotState(createSaveSlotStateFromGameSession(this.draftSession));
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
}

function getMaxPage(totalCount: number): number {
  return Math.max(0, Math.ceil(totalCount / CARD_PAGE_SIZE) - 1);
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
