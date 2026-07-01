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
  private targetPage = 0;
  private materialPage = 0;
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
      .text(GAME_WIDTH / 2, 1642, 'Select a deck UNIT and collection materials.', {
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

    bodyLayout.add(
      this.createCardPanel({
        title: 'Current Deck Target',
        subtitle: `${this.getTargetEntries().length} cards`,
        entries: this.getTargetEntries(),
        page: this.targetPage,
        selectedInstanceIds: new Set(
          this.selectedTargetCardInstanceId ? [this.selectedTargetCardInstanceId] : [],
        ),
        emptyMessage: 'No growable deck UNIT cards.',
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
      }),
      {
        align: 'left-top',
        minWidth: PANEL_WIDTH,
        minHeight: PANEL_HEIGHT,
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
        page: this.materialPage,
        selectedInstanceIds: this.selectedMaterialCardInstanceIds,
        emptyMessage: 'No collection UNIT materials.',
        onSelect: (instanceId) => {
          this.toggleMaterialSelection(instanceId);
        },
        onPageChange: (page) => {
          this.materialPage = page;
          this.renderLists();
        },
      }),
      {
        align: 'left-top',
        minWidth: PANEL_WIDTH,
        minHeight: PANEL_HEIGHT,
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
    page: number;
    selectedInstanceIds: ReadonlySet<string>;
    emptyMessage: string;
    onSelect: (instanceId: string) => void;
    onPageChange: (page: number) => void;
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

    if (config.entries.length === 0) {
      const emptyLayout = this.rexUI.add.overlapSizer(28, 470, PANEL_INNER_WIDTH, 200, {
        origin: 0,
      });
      emptyLayout.add(this.createEmptyPanelMessage(config.emptyMessage), {
        align: 'left-top',
        minWidth: PANEL_INNER_WIDTH,
        minHeight: 200,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      });
      emptyLayout.layout();
      container.add(emptyLayout);
      container.add(this.createPagination(config));
      return container;
    }

    const maxPage = getMaxPage(config.entries.length);
    const page = Math.min(config.page, maxPage);
    const pageEntries = config.entries.slice(page * CARD_PAGE_SIZE, (page + 1) * CARD_PAGE_SIZE);
    const rowLayout = this.rexUI.add.sizer(28, 104, PANEL_INNER_WIDTH, 1150, 'y', {
      origin: 0,
      space: { item: CARD_ROW_GAP },
    });

    pageEntries.forEach((entry) => {
      rowLayout.add(
        this.createCardRow({
          entry,
          selected: config.selectedInstanceIds.has(entry.card.instance.instanceId),
          onSelect: config.onSelect,
        }),
        {
          align: 'left-top',
          minWidth: PANEL_INNER_WIDTH,
          minHeight: CARD_ROW_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      );
    });
    rowLayout.layout();
    container.add(rowLayout);

    container.add(
      this.createPagination({
        ...config,
        page,
      }),
    );
    return container;
  }

  private createEmptyPanelMessage(message: string): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(PANEL_INNER_WIDTH, 200);
    container.add(
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
    return container;
  }

  private createCardRow(config: {
    entry: GrowthListEntry;
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

  private createPagination(config: {
    entries: GrowthListEntry[];
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
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );
    layout.addSpace();
    layout.add(this.createPageIndicator(`${page + 1} / ${maxPage + 1}`), {
      align: 'left-top',
      minWidth: 120,
      minHeight: PANEL_BUTTON_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
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
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
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
    const layout = this.rexUI.add.sizer(69, 1728, 1092, HUD_BUTTON_HEIGHT, 'x', {
      origin: 0,
      space: { item: 51 },
    });
    const canApply =
      !this.isSaving &&
      this.selectedTargetCardInstanceId !== null &&
      this.selectedMaterialCardInstanceIds.size > 0;

    layout.add(
      this.createHudButton('Back', 190, !this.isSaving, () => {
        this.scene.start('StageScene', { session: this.savedSession } satisfies StageSceneData);
      }),
      {
        align: 'left-top',
        minWidth: 190,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );
    layout.add(
      this.createHudButton('Apply Growth', 280, canApply, () => {
        this.handleApplyGrowth();
      }),
      {
        align: 'left-top',
        minWidth: 280,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
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
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );

    const summaryText = this.isDirty ? 'Unsaved growth' : 'Saved growth';
    layout.add(this.createHudSummary(summaryText, this.isDirty), {
      align: 'left-top',
      minWidth: 300,
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
    slot.setSize(300, HUD_BUTTON_HEIGHT);
    slot.add(
      this.add
        .text(150, HUD_BUTTON_HEIGHT / 2, text, {
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
