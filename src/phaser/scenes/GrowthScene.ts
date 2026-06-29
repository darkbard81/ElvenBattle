import Phaser from 'phaser';
import { consumeDeckMaterialsForCollectionGrowth } from '../../game/save/card-growth';
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

const CARD_PAGE_SIZE = 8;
const PANEL_Y = 248;
const PANEL_WIDTH = 500;
const PANEL_HEIGHT = 1320;
const CARD_ROW_HEIGHT = 124;
const CARD_ROW_GAP = 18;

type GrowthListEntry = {
  card: RuntimeCardInstance;
  index: number;
};

/**
 * 컬렉션 카드 1장을 대상으로 현재 덱 UNIT 카드를 재료 소모해 성장시키는 화면이다.
 * 성장 EXP 계산과 저장 가능한 세션 변경은 save 도메인 모듈에 위임하고, 이 씬은 선택과 저장 흐름만 담당한다.
 */
export class GrowthScene extends Phaser.Scene {
  private savedSession!: GameSession;
  private draftSession!: GameSession;
  private selectedTargetCardInstanceId: string | null = null;
  private selectedMaterialCardInstanceIds = new Set<string>();
  private targetPage = 0;
  private materialPage = 0;
  private isDirty = false;
  private isSaving = false;
  private statusText!: Phaser.GameObjects.Text;
  private listContainer: Phaser.GameObjects.Container | null = null;
  private hudContainer: Phaser.GameObjects.Container | null = null;

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
    this.targetPage = 0;
    this.materialPage = 0;
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
      .text(GAME_WIDTH / 2, 154, 'Use Current Deck cards as materials for Collection cards', {
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
      .text(GAME_WIDTH / 2, 1642, 'Select a Collection card and deck materials.', {
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

    this.renderCardPanel({
      container,
      x: 72,
      title: 'Collection Target',
      subtitle: `${this.getTargetEntries().length} cards`,
      entries: this.getTargetEntries(),
      page: this.targetPage,
      selectedInstanceIds: new Set(
        this.selectedTargetCardInstanceId ? [this.selectedTargetCardInstanceId] : [],
      ),
      emptyMessage: 'No growable collection cards.',
      onSelect: (instanceId) => {
        this.selectedTargetCardInstanceId = instanceId;
        this.setStatus('Growth target selected.');
        this.renderLists();
        this.renderHud();
      },
      onPageChange: (page) => {
        this.targetPage = page;
        this.renderLists();
      },
    });

    this.renderCardPanel({
      container,
      x: 628,
      title: 'Current Deck Materials',
      subtitle: `${this.selectedMaterialCardInstanceIds.size} / ${
        this.getMaterialEntries().length
      } selected`,
      entries: this.getMaterialEntries(),
      page: this.materialPage,
      selectedInstanceIds: this.selectedMaterialCardInstanceIds,
      emptyMessage: 'No UNIT cards in deck.',
      onSelect: (instanceId) => {
        this.toggleMaterialSelection(instanceId);
      },
      onPageChange: (page) => {
        this.materialPage = page;
        this.renderLists();
      },
    });
  }

  private renderCardPanel(config: {
    container: Phaser.GameObjects.Container;
    x: number;
    title: string;
    subtitle: string;
    entries: GrowthListEntry[];
    page: number;
    selectedInstanceIds: ReadonlySet<string>;
    emptyMessage: string;
    onSelect: (instanceId: string) => void;
    onPageChange: (page: number) => void;
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

    if (config.entries.length === 0) {
      config.container.add(
        this.add
          .text(config.x + PANEL_WIDTH / 2, PANEL_Y + 570, config.emptyMessage, {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '24px',
            color: '#b8c9c0',
            align: 'center',
            wordWrap: { width: PANEL_WIDTH - 72 },
          })
          .setOrigin(0.5),
      );
      this.renderPagination(config);
      return;
    }

    const maxPage = getMaxPage(config.entries.length);
    const page = Math.min(config.page, maxPage);
    const pageEntries = config.entries.slice(page * CARD_PAGE_SIZE, (page + 1) * CARD_PAGE_SIZE);
    pageEntries.forEach((entry, index) => {
      const rowY = PANEL_Y + 104 + index * (CARD_ROW_HEIGHT + CARD_ROW_GAP);
      this.renderCardRow({
        container: config.container,
        x: config.x + 28,
        y: rowY,
        entry,
        selected: config.selectedInstanceIds.has(entry.card.instance.instanceId),
        onSelect: config.onSelect,
      });
    });

    this.renderPagination({
      ...config,
      page,
    });
  }

  private renderCardRow(config: {
    container: Phaser.GameObjects.Container;
    x: number;
    y: number;
    entry: GrowthListEntry;
    selected: boolean;
    onSelect: (instanceId: string) => void;
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
        .text(config.x + 18, config.y + 64, formatCardStats(card), {
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
        .text(config.x + 18, config.y + 94, card.definition.id, {
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
  }

  private renderPagination(config: {
    container: Phaser.GameObjects.Container;
    x: number;
    entries: GrowthListEntry[];
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
    const canApply =
      !this.isSaving &&
      this.selectedTargetCardInstanceId !== null &&
      this.selectedMaterialCardInstanceIds.size > 0;

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
      x: 450,
      y: 1760,
      width: 280,
      height: 64,
      label: 'Apply Growth',
      enabled: canApply,
      parent: container,
      onClick: () => {
        this.handleApplyGrowth();
      },
    });
    createMenuButton(this, {
      x: 734,
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

    const summaryText = this.isDirty ? 'Unsaved growth' : 'Saved growth';
    container.add(
      this.add
        .text(1010, 1760, summaryText, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: this.isDirty ? '#fff3c2' : '#bfeec5',
          align: 'center',
        })
        .setOrigin(0.5),
    );
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
      const result = consumeDeckMaterialsForCollectionGrowth(this.draftSession, {
        targetCollectionCardInstanceId: this.selectedTargetCardInstanceId,
        materialDeckCardInstanceIds: Array.from(this.selectedMaterialCardInstanceIds),
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
      const savedState = await saveSlotState(createSaveSlotStateFromGameSession(this.draftSession));
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
    return this.draftSession.collection.cards
      .map((card, index) => ({ card, index }))
      .filter(
        (entry) =>
          (entry.card.definition.type === 'UNIT' || entry.card.definition.type === 'LEADER') &&
          (entry.card.instance.type === 'UNIT' || entry.card.instance.type === 'LEADER'),
      );
  }

  private getMaterialEntries(): GrowthListEntry[] {
    return this.draftSession.deck.cards
      .map((card, index) => ({ card, index }))
      .filter(
        (entry) => entry.card.definition.type === 'UNIT' && entry.card.instance.type === 'UNIT',
      );
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
  }
}

function getMaxPage(totalCount: number): number {
  return Math.max(0, Math.ceil(totalCount / CARD_PAGE_SIZE) - 1);
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
