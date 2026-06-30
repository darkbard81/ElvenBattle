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
import { LayoutBox } from '../ui/LayoutBox';
import { createMenuButton } from '../ui/menu-button';
import type { DeckBuildSceneData, StageSceneData } from './scene-data';

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
  private deckPage = 0;
  private collectionPage = 0;
  private isDirty = false;
  private isSaving = false;
  private statusText!: Phaser.GameObjects.Text;
  private listContainer: Phaser.GameObjects.Container | null = null;
  private hudContainer: Phaser.GameObjects.Container | null = null;

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
    this.deckPage = 0;
    this.collectionPage = 0;
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
      .text(GAME_WIDTH / 2, 1642, 'UNIT deck configuration ready.', {
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
    const bodyLayout = new LayoutBox(this, 'hbox', {
      gap: PANEL_GAP,
    });

    bodyLayout.add(
      this.createCardPanel({
        title: 'Deck UNIT',
        subtitle: `${this.getDeckUnitEntries().length} cards`,
        entries: this.getDeckUnitEntries(),
        page: this.deckPage,
        selectedInstanceId: null,
        emptyMessage: 'No UNIT cards in deck.',
        onSelect: (instanceId) => {
          this.handleRemoveFromDeck(instanceId);
        },
        onPageChange: (page) => {
          this.deckPage = page;
          this.renderLists();
        },
      }),
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      },
    );

    bodyLayout.add(
      this.createCardPanel({
        title: 'Collection UNIT',
        subtitle: `${this.getCollectionUnitEntries().length} cards`,
        entries: this.getCollectionUnitEntries(),
        page: this.collectionPage,
        selectedInstanceId: null,
        emptyMessage: 'No collection UNIT cards yet.',
        onSelect: (instanceId) => {
          this.handleAddToDeck(instanceId);
        },
        onPageChange: (page) => {
          this.collectionPage = page;
          this.renderLists();
        },
      }),
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      },
    );

    bodyLayout.layout(PANEL_BODY_X, PANEL_Y, PANEL_BODY_WIDTH, PANEL_HEIGHT);
    container.add(bodyLayout.container);
  }

  private renderLeaderLists(container: Phaser.GameObjects.Container): void {
    const bodyLayout = new LayoutBox(this, 'hbox', {
      gap: PANEL_GAP,
    });

    bodyLayout.add(
      this.createCardPanel({
        title: 'Current LEADER',
        subtitle: '1 card',
        entries: this.getDeckLeaderEntries(),
        page: 0,
        selectedInstanceId: this.draftSession.deck.leader.instance.instanceId,
        emptyMessage: 'No current LEADER.',
        onSelect: () => {
          this.setStatus('Current LEADER is fixed until replaced.');
        },
        onPageChange: () => {},
      }),
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      },
    );

    bodyLayout.add(
      this.createCardPanel({
        title: 'Collection LEADER',
        subtitle: `${this.getCollectionLeaderEntries().length} cards`,
        entries: this.getCollectionLeaderEntries(),
        page: this.collectionPage,
        selectedInstanceId: null,
        emptyMessage: 'No collection LEADER cards yet.',
        onSelect: (instanceId) => {
          this.handleSetLeader(instanceId);
        },
        onPageChange: (page) => {
          this.collectionPage = page;
          this.renderLists();
        },
      }),
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      },
    );

    bodyLayout.layout(PANEL_BODY_X, PANEL_Y, PANEL_BODY_WIDTH, PANEL_HEIGHT);
    container.add(bodyLayout.container);
  }

  private createModeTabs(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const layout = new LayoutBox(this, 'hbox', {
      gap: 36,
    });

    layout.add(this.createModeButton('UNIT'), {
      width: 220,
      height: 52,
    });
    layout.add(this.createModeButton('LEADER'), {
      width: 220,
      height: 52,
    });
    layout.layout(362, 188, 476, 52);
    container.add(layout.container);
    return container;
  }

  private createModeButton(mode: DeckBuildMode): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
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
    page: number;
    selectedInstanceId: string | null;
    emptyMessage: string;
    onSelect: (instanceId: string) => void;
    onPageChange: (page: number) => void;
  }): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
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
      const emptyLayout = new LayoutBox(this, 'vbox', {
        align: 'center',
        justify: 'center',
      });
      emptyLayout.add(this.createEmptyPanelMessage(config.emptyMessage), {
        width: PANEL_INNER_WIDTH,
        height: 200,
      });
      emptyLayout.layout(28, 470, PANEL_INNER_WIDTH, 200);
      container.add(emptyLayout.container);
      container.add(this.createPagination(config));
      return container;
    }

    const maxPage = getMaxPage(config.entries.length);
    const page = Math.min(config.page, maxPage);
    const pageEntries = config.entries.slice(page * CARD_PAGE_SIZE, (page + 1) * CARD_PAGE_SIZE);
    const rowLayout = new LayoutBox(this, 'vbox', {
      gap: CARD_ROW_GAP,
    });

    pageEntries.forEach((entry) => {
      rowLayout.add(
        this.createCardRow({
          entry,
          selected: entry.card.instance.instanceId === config.selectedInstanceId,
          onSelect: config.onSelect,
        }),
        {
          width: PANEL_INNER_WIDTH,
          height: CARD_ROW_HEIGHT,
        },
      );
    });
    rowLayout.layout(28, 104, PANEL_INNER_WIDTH, 1150);
    container.add(rowLayout.container);

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
    entry: DeckBuildListEntry;
    selected: boolean;
    onSelect: (instanceId: string) => void;
  }): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
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
    entries: DeckBuildListEntry[];
    page: number;
    onPageChange: (page: number) => void;
  }): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const maxPage = getMaxPage(config.entries.length);
    const page = Math.min(config.page, maxPage);
    const layout = new LayoutBox(this, 'hbox', {
      align: 'center',
      justify: 'space-between',
    });

    layout.add(
      this.createPanelButton('Prev', page > 0, () => {
        config.onPageChange(page - 1);
      }),
      {
        width: 112,
        height: PANEL_BUTTON_HEIGHT,
      },
    );
    layout.add(this.createPageIndicator(`${page + 1} / ${maxPage + 1}`), {
      width: 120,
      height: PANEL_BUTTON_HEIGHT,
    });
    layout.add(
      this.createPanelButton('Next', page < maxPage, () => {
        config.onPageChange(page + 1);
      }),
      {
        width: 112,
        height: PANEL_BUTTON_HEIGHT,
      },
    );
    layout.layout(28, PANEL_HEIGHT - 80, PANEL_INNER_WIDTH, PANEL_BUTTON_HEIGHT);
    container.add(layout.container);
    return container;
  }

  private createPageIndicator(label: string): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
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
    const layout = new LayoutBox(this, 'hbox', {
      gap: 81,
      align: 'center',
    });

    layout.add(
      this.createHudButton('Back', 190, !this.isSaving, () => {
        this.scene.start('StageScene', { session: this.savedSession } satisfies StageSceneData);
      }),
      {
        width: 190,
        height: HUD_BUTTON_HEIGHT,
      },
    );
    layout.add(
      this.createHudButton('Save', 180, this.isDirty && !this.isSaving, () => {
        void this.handleSave();
      }),
      {
        width: 180,
        height: HUD_BUTTON_HEIGHT,
      },
    );

    const summaryText = this.isDirty ? 'Unsaved changes' : 'Saved deck';
    layout.add(this.createHudSummary(summaryText, this.isDirty), {
      width: 360,
      height: HUD_BUTTON_HEIGHT,
    });
    layout.layout(69, 1728, 892, HUD_BUTTON_HEIGHT);
    this.hudContainer = layout.container;
  }

  private createHudButton(
    label: string,
    width: number,
    enabled: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const slot = this.add.container(0, 0);
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
    this.deckPage = 0;
    this.collectionPage = 0;
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
}

function getMaxPage(totalCount: number): number {
  return Math.max(0, Math.ceil(totalCount / CARD_PAGE_SIZE) - 1);
}

function formatCardStats(card: RuntimeCardInstance): string {
  const cost = card.instance.cost ?? card.definition.cost ?? 0;
  const dominance = card.instance.dominance ?? card.definition.dominance ?? 0;
  const hp = card.instance.hp ?? card.definition.hp ?? 0;
  const attack = card.instance.attack ?? card.definition.attack ?? 0;

  return `cost ${cost} · dom ${dominance} · hp ${hp} · atk ${attack}`;
}
