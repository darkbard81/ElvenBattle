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
  private hudContainer: Phaser.GameObjects.Container | null = null;

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

    this.renderUnitPanel(container);
    this.renderEquipmentPanel(container);
  }

  private renderUnitPanel(container: Phaser.GameObjects.Container): void {
    const entries = this.getUnitEntries();
    this.renderPanelHeader({
      container,
      x: 72,
      title: 'Deck UNIT',
      subtitle: `${entries.length} cards`,
    });

    if (entries.length === 0) {
      this.renderEmptyPanelMessage(container, 72, 'No deck UNIT cards.');
      this.renderPagination({
        container,
        x: 72,
        entries,
        page: this.targetPage,
        onPageChange: (page) => {
          this.targetPage = page;
          this.renderLists();
        },
      });
      return;
    }

    const maxPage = getMaxPage(entries.length);
    const page = Math.min(this.targetPage, maxPage);
    const pageEntries = entries.slice(page * CARD_PAGE_SIZE, (page + 1) * CARD_PAGE_SIZE);
    pageEntries.forEach((entry, index) => {
      this.renderUnitRow({
        container,
        x: 100,
        y: PANEL_Y + 104 + index * (CARD_ROW_HEIGHT + CARD_ROW_GAP),
        entry,
        selected: entry.card.instance.instanceId === this.selectedTargetCardInstanceId,
      });
    });

    this.renderPagination({
      container,
      x: 72,
      entries,
      page,
      onPageChange: (nextPage) => {
        this.targetPage = nextPage;
        this.renderLists();
      },
    });
  }

  private renderEquipmentPanel(container: Phaser.GameObjects.Container): void {
    const entries = this.getEquipmentEntries();
    const selectedTarget = this.getSelectedTargetCard();
    this.renderPanelHeader({
      container,
      x: 628,
      title: 'Collection Equipment',
      subtitle: selectedTarget ? formatSelectedSlotSummary(this.getSelectedUnitEntry()) : 'No UNIT',
    });

    if (entries.length === 0) {
      this.renderEmptyPanelMessage(container, 628, 'No collection EQUIPMENT cards.');
      this.renderPagination({
        container,
        x: 628,
        entries,
        page: this.equipmentPage,
        onPageChange: (page) => {
          this.equipmentPage = page;
          this.renderLists();
        },
      });
      return;
    }

    const maxPage = getMaxPage(entries.length);
    const page = Math.min(this.equipmentPage, maxPage);
    const pageEntries = entries.slice(page * CARD_PAGE_SIZE, (page + 1) * CARD_PAGE_SIZE);
    pageEntries.forEach((entry, index) => {
      this.renderEquipmentRow({
        container,
        x: 656,
        y: PANEL_Y + 104 + index * (CARD_ROW_HEIGHT + CARD_ROW_GAP),
        entry,
      });
    });

    this.renderPagination({
      container,
      x: 628,
      entries,
      page,
      onPageChange: (nextPage) => {
        this.equipmentPage = nextPage;
        this.renderLists();
      },
    });
  }

  private renderPanelHeader(config: {
    container: Phaser.GameObjects.Container;
    x: number;
    title: string;
    subtitle: string;
  }): void {
    const panel = this.add.rectangle(config.x, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT, 0x10261f, 0.94);
    panel.setOrigin(0, 0);
    panel.setStrokeStyle(2, 0xbfeec5, 0.64);
    config.container.add(panel);

    config.container.add(
      this.add
        .text(config.x + 28, PANEL_Y + 38, config.title, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '30px',
          fontStyle: '700',
          color: '#f5fff0',
          align: 'left',
        })
        .setOrigin(0, 0.5),
    );
    config.container.add(
      this.add
        .text(config.x + PANEL_WIDTH - 28, PANEL_Y + 38, config.subtitle, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '18px',
          color: '#a8d2af',
          align: 'right',
        })
        .setOrigin(1, 0.5),
    );
  }

  private renderEmptyPanelMessage(
    container: Phaser.GameObjects.Container,
    x: number,
    message: string,
  ): void {
    container.add(
      this.add
        .text(x + PANEL_WIDTH / 2, PANEL_Y + 570, message, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '24px',
          color: '#b8c9c0',
          align: 'center',
          wordWrap: { width: PANEL_WIDTH - 72 },
        })
        .setOrigin(0.5),
    );
  }

  private renderUnitRow(config: {
    container: Phaser.GameObjects.Container;
    x: number;
    y: number;
    entry: EquipmentUnitEntry;
    selected: boolean;
  }): void {
    const card = config.entry.card;
    const fillColor = config.selected ? 0x31543d : 0x17352d;
    const strokeColor = config.selected ? 0xffe4a8 : 0x78a98d;
    const background = this.add
      .rectangle(config.x, config.y, PANEL_WIDTH - 56, CARD_ROW_HEIGHT, fillColor, 0.92)
      .setOrigin(0, 0);
    background.setStrokeStyle(config.selected ? 3 : 1, strokeColor, config.selected ? 0.95 : 0.5);
    background.setInteractive({ useHandCursor: true });
    config.container.add(background);

    config.container.add(
      this.add
        .text(config.x + 18, config.y + 24, `${config.entry.index + 1}. ${card.instance.name}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: '#f5fff0',
          align: 'left',
          wordWrap: { width: PANEL_WIDTH - 104 },
        })
        .setOrigin(0, 0.5),
    );
    config.container.add(
      this.add
        .text(config.x + 18, config.y + 64, formatUnitStats(config.entry), {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#d7ead4',
          align: 'left',
          wordWrap: { width: PANEL_WIDTH - 104 },
        })
        .setOrigin(0, 0.5),
    );
    config.container.add(
      this.add
        .text(config.x + 18, config.y + 94, formatEquippedNames(config.entry), {
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
  }

  private renderEquipmentRow(config: {
    container: Phaser.GameObjects.Container;
    x: number;
    y: number;
    entry: EquipmentListEntry;
  }): void {
    const card = config.entry.card;
    const fillColor = config.entry.equippedToSelected ? 0x31543d : 0x17352d;
    const strokeColor = config.entry.equippedToSelected
      ? 0xffe4a8
      : config.entry.equippedTargetName
        ? 0xa8a05f
        : 0x78a98d;
    const background = this.add
      .rectangle(config.x, config.y, PANEL_WIDTH - 56, CARD_ROW_HEIGHT, fillColor, 0.92)
      .setOrigin(0, 0);
    background.setStrokeStyle(config.entry.equippedToSelected ? 3 : 1, strokeColor, 0.75);
    background.setInteractive({ useHandCursor: true });
    config.container.add(background);

    config.container.add(
      this.add
        .text(config.x + 18, config.y + 24, `${config.entry.index + 1}. ${card.instance.name}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: '#f5fff0',
          align: 'left',
          wordWrap: { width: PANEL_WIDTH - 104 },
        })
        .setOrigin(0, 0.5),
    );
    config.container.add(
      this.add
        .text(config.x + 18, config.y + 64, formatEquipmentStats(card), {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#d7ead4',
          align: 'left',
          wordWrap: { width: PANEL_WIDTH - 104 },
        })
        .setOrigin(0, 0.5),
    );
    config.container.add(
      this.add
        .text(config.x + 18, config.y + 94, formatEquipmentAssignment(config.entry), {
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
  }

  private renderPagination(config: {
    container: Phaser.GameObjects.Container;
    x: number;
    entries: unknown[];
    page: number;
    onPageChange: (page: number) => void;
  }): void {
    const maxPage = getMaxPage(config.entries.length);
    const page = Math.min(config.page, maxPage);
    const y = PANEL_Y + PANEL_HEIGHT - 58;
    this.createPanelButton({
      container: config.container,
      x: config.x + 84,
      y,
      width: 112,
      height: 44,
      label: 'Prev',
      enabled: page > 0,
      onClick: () => {
        config.onPageChange(page - 1);
      },
    });
    config.container.add(
      this.add
        .text(config.x + PANEL_WIDTH / 2, y, `${page + 1} / ${maxPage + 1}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '19px',
          color: '#d7ead4',
          align: 'center',
        })
        .setOrigin(0.5),
    );
    this.createPanelButton({
      container: config.container,
      x: config.x + PANEL_WIDTH - 84,
      y,
      width: 112,
      height: 44,
      label: 'Next',
      enabled: page < maxPage,
      onClick: () => {
        config.onPageChange(page + 1);
      },
    });
  }

  private createPanelButton(config: {
    container: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    enabled: boolean;
    onClick: () => void;
  }): void {
    const background = this.add.rectangle(
      config.x,
      config.y,
      config.width,
      config.height,
      config.enabled ? 0x1d3f31 : 0x12211c,
      config.enabled ? 0.96 : 0.72,
    );
    background.setStrokeStyle(2, config.enabled ? 0xdaf6d3 : 0x51605a, config.enabled ? 0.9 : 0.5);
    config.container.add(background);
    config.container.add(
      this.add
        .text(config.x, config.y, config.label, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '18px',
          color: config.enabled ? '#f5fff0' : '#7e8b84',
          align: 'center',
        })
        .setOrigin(0.5),
    );

    if (!config.enabled) {
      return;
    }

    background.setInteractive({ useHandCursor: true });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, config.onClick);
  }

  private renderHud(): void {
    this.hudContainer?.destroy();
    const container = this.add.container(0, 0);
    this.hudContainer = container;

    createMenuButton(this, {
      x: 164,
      y: 1760,
      width: 190,
      height: 64,
      label: 'Back',
      enabled: !this.isSaving,
      parent: container,
      onClick: () => {
        this.scene.start('StageScene', { session: this.savedSession } satisfies StageSceneData);
      },
    });
    createMenuButton(this, {
      x: 430,
      y: 1760,
      width: 180,
      height: 64,
      label: 'Save',
      enabled: this.isDirty && !this.isSaving,
      parent: container,
      onClick: () => {
        void this.handleSave();
      },
    });

    const summaryText = this.isDirty ? 'Unsaved equipment' : 'Saved equipment';
    container.add(
      this.add
        .text(790, 1760, summaryText, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: this.isDirty ? '#fff3c2' : '#bfeec5',
          align: 'center',
        })
        .setOrigin(0.5),
    );
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
