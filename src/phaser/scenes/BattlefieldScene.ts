import Phaser from 'phaser';
import {
  applyActiveSkillAction,
  applyAttackAction,
  applyBlockAction,
  applyAutoTurnEndIfStalled,
  applyMoveAction,
  applyPlaceAction,
  applyTurnEnd,
  findBattlefieldCardAtSlot,
  getEffectiveAttack,
  getEffectiveDominance,
  getEffectiveHp,
  listActiveSkillActions,
  listAttackActions,
  listMoveActions,
  listPlaceActions,
  runAutomatedTurnUntilBlockDecision,
} from '../../game/battle/battle-engine';
import { createInitialBattleRuntime } from '../../game/battle/create-battle-runtime';
import {
  INITIAL_HAND_SIZE,
  type ActiveSkillBattleAction,
  type AttackBattleAction,
  type BattleAutomationAction,
  type BattleCardRuntimeState,
  type BattleRuntimeState,
  type BattleSide,
  type BattleSlotId,
  type BattleTurnEvent,
  type BlockBattleAction,
  type MoveBattleAction,
  type PlaceBattleAction,
} from '../../game/battle/types';
import { fetchSaveSlot, saveSlotState } from '../../game/save/client-api';
import {
  createGameSession,
  createSaveSlotStateFromGameSession,
  type GameSession,
} from '../../game/save/session';
import { applyStageBattleResultToSession, createStageBattleResult } from '../../game/stage/result';
import { requireStageDefinition } from '../../game/stage/stage-definitions';
import type { StageBattleResult, StageDefinition } from '../../game/stage/types';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
import type { BattlefieldSceneData, StageSceneData } from './scene-data';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BattlefieldSceneLayers = {
  backgroundLayer: Phaser.GameObjects.Container;
  boardLayer: Phaser.GameObjects.Container;
  cardLayer: Phaser.GameObjects.Container;
  effectLayer: Phaser.GameObjects.Container;
  hudLayer: Phaser.GameObjects.Container;
  handLayer: Phaser.GameObjects.Container;
  buttonLayer: Phaser.GameObjects.Container;
};

type BattleSelection =
  | {
      kind: 'HAND_CARD';
      cardInstanceId: string;
      placeActions: PlaceBattleAction[];
    }
  | {
      kind: 'FIELD_CARD';
      cardInstanceId: string;
      sourceSlotId: BattleSlotId;
      moveActions: MoveBattleAction[];
      activeSkillGroups: ActiveSkillActionGroup[];
      attackActions: AttackBattleAction[];
    }
  | {
      kind: 'ACTIVE_SKILL';
      cardInstanceId: string;
      sourceSlotId: BattleSlotId;
      skillId: string;
      skillName: string;
      activeSkillActions: ActiveSkillBattleAction[];
    }
  | {
      kind: 'FIELD_CARD_DRAG';
      cardInstanceId: string;
      sourceSlotId: BattleSlotId;
      moveActions: MoveBattleAction[];
      attackActions: AttackBattleAction[];
    }
  | {
      kind: 'BLOCK_DECISION';
      attackAction: AttackBattleAction;
      blockActions: BlockBattleAction[];
      automatedActionCount: number;
    };

type ActiveSkillActionGroup = {
  skillId: string;
  skillName: string;
  actions: ActiveSkillBattleAction[];
};

type CardInfoPanelSide = 'left' | 'right';

type CardViewOptions = {
  highlightColor?: number;
  onClick?: () => void;
  onFieldDragStart?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => boolean;
  onFieldDrag?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;
  onFieldDragEnd?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;
};

type BattleFlowResult = {
  messages: string[];
  popupEvents: BattlePopupEvent[];
  pendingBlockSelection: Extract<BattleSelection, { kind: 'BLOCK_DECISION' }> | null;
};

type BattlePopupEvent = {
  kind: 'PLACE' | 'MOVE' | 'ATTACK' | 'SKILL' | 'BLOCK';
  slotId: BattleSlotId;
  text: string;
};

type BottomButtonDefinition = {
  label: string;
  width: number;
  height: number;
  enabled: boolean;
  onClick?: () => void;
};

const FIELD_SLOT_WIDTH = 174;
const FIELD_SLOT_HEIGHT = 261;
const HAND_CARD_WIDTH = 128;
const BATTLE_POPUP_DURATION_MS = 500;
const PLACE_HIGHLIGHT_COLOR = 0x71d879;
const MOVE_HIGHLIGHT_COLOR = 0x79b8ff;
const ATTACK_HIGHLIGHT_COLOR = 0xff6f6f;
const SKILL_HIGHLIGHT_COLOR = 0xf4c95d;
const BLOCK_HIGHLIGHT_COLOR = 0xc8f47a;
const SELECTED_HIGHLIGHT_COLOR = 0xfff1a3;
const CARD_BACK_TEXTURE_KEY = 'cards.webp.card_back';
const CARD_INFO_PANEL_WIDTH = 420;
const CARD_INFO_PANEL_HEIGHT = 980;
const CARD_INFO_PANEL_MARGIN_X = 28;
const CARD_INFO_PANEL_Y = 40;
const CARD_INFO_PANEL_PADDING = 18;
const CARD_INFO_PREVIEW_WIDTH = 300;
const CARD_INFO_PREVIEW_HEIGHT = 450;
const HUD_X = 36;
const HUD_Y = 36;
const HUD_WIDTH = 380;
const HUD_HEIGHT = 104;
const HUD_GAP = 14;
const STATUS_PANEL_HEIGHT = 154;
const BOTTOM_BUTTON_CENTER_Y = GAME_HEIGHT - 44;
const BOTTOM_BUTTON_GAP = 18;
const POPUP_STYLE = {
  PLACE: {
    fill: 0x173a24,
    stroke: PLACE_HIGHLIGHT_COLOR,
    color: '#d9ffd6',
  },
  MOVE: {
    fill: 0x18314c,
    stroke: MOVE_HIGHLIGHT_COLOR,
    color: '#e2f1ff',
  },
  ATTACK: {
    fill: 0x4b1717,
    stroke: ATTACK_HIGHLIGHT_COLOR,
    color: '#ffe1dc',
  },
  SKILL: {
    fill: 0x463416,
    stroke: SKILL_HIGHLIGHT_COLOR,
    color: '#fff3c2',
  },
  BLOCK: {
    fill: 0x273313,
    stroke: BLOCK_HIGHLIGHT_COLOR,
    color: '#f4ffd2',
  },
} as const;
const BATTLE_GRID_COLUMNS = ['leftPile', 'FR', 'FC', 'FL', 'rightPile'] as const;
const BATTLE_GRID_ROWS = ['enemyBack', 'enemyFront', 'playerFront', 'playerBack'] as const;
type BattleGridColumn = (typeof BATTLE_GRID_COLUMNS)[number];
type BattleGridRow = (typeof BATTLE_GRID_ROWS)[number];
type BattleGridCell = {
  column: BattleGridColumn;
  row: BattleGridRow;
};
const BATTLE_GRID_Y = 28;
const BATTLE_GRID_COLUMN_GAP = 18;
const BATTLE_GRID_ROW_GAP_TOP = 8;
const BATTLE_GRID_ROW_GAP_CENTER = 20;
const BATTLE_GRID_ROW_GAP_BOTTOM = 8;
const BATTLE_GRID_ROW_GAPS = [
  BATTLE_GRID_ROW_GAP_TOP,
  BATTLE_GRID_ROW_GAP_CENTER,
  BATTLE_GRID_ROW_GAP_BOTTOM,
];
const BATTLE_GRID_WIDTH =
  FIELD_SLOT_WIDTH * BATTLE_GRID_COLUMNS.length +
  BATTLE_GRID_COLUMN_GAP * (BATTLE_GRID_COLUMNS.length - 1);
const BATTLE_GRID_HEIGHT =
  FIELD_SLOT_HEIGHT * BATTLE_GRID_ROWS.length +
  BATTLE_GRID_ROW_GAPS.reduce((total, gap) => total + gap, 0);
const BATTLE_GRID_X = Math.round((GAME_WIDTH - BATTLE_GRID_WIDTH) / 2);
const BATTLE_GRID_COLUMN_X: Record<BattleGridColumn, number> = {
  leftPile: BATTLE_GRID_X,
  FR: BATTLE_GRID_X + FIELD_SLOT_WIDTH + BATTLE_GRID_COLUMN_GAP,
  FC: BATTLE_GRID_X + (FIELD_SLOT_WIDTH + BATTLE_GRID_COLUMN_GAP) * 2,
  FL: BATTLE_GRID_X + (FIELD_SLOT_WIDTH + BATTLE_GRID_COLUMN_GAP) * 3,
  rightPile: BATTLE_GRID_X + (FIELD_SLOT_WIDTH + BATTLE_GRID_COLUMN_GAP) * 4,
};
const BATTLE_GRID_ROW_Y: Record<BattleGridRow, number> = {
  enemyBack: BATTLE_GRID_Y,
  enemyFront: BATTLE_GRID_Y + FIELD_SLOT_HEIGHT + BATTLE_GRID_ROW_GAP_TOP,
  playerFront:
    BATTLE_GRID_Y + FIELD_SLOT_HEIGHT * 2 + BATTLE_GRID_ROW_GAP_TOP + BATTLE_GRID_ROW_GAP_CENTER,
  playerBack:
    BATTLE_GRID_Y +
    FIELD_SLOT_HEIGHT * 3 +
    BATTLE_GRID_ROW_GAP_TOP +
    BATTLE_GRID_ROW_GAP_CENTER +
    BATTLE_GRID_ROW_GAP_BOTTOM,
};
const BATTLE_GRID_CENTER_X = BATTLE_GRID_X + BATTLE_GRID_WIDTH / 2;
const BATTLE_GRID_SIDE_DIVIDER_Y =
  BATTLE_GRID_ROW_Y.enemyFront + FIELD_SLOT_HEIGHT + BATTLE_GRID_ROW_GAP_CENTER / 2;
const BOARD_RECT = {
  x: BATTLE_GRID_X - 30,
  y: 14,
  width: BATTLE_GRID_WIDTH + 60,
  height: BATTLE_GRID_Y - 14 + BATTLE_GRID_HEIGHT + 16,
} as const satisfies Rect;
const HAND_EXPANDED_Y = GAME_HEIGHT - 240;
const HAND_HIDDEN_Y = GAME_HEIGHT - 88;
const HAND_RECT = {
  x: 260,
  y: HAND_EXPANDED_Y,
  width: GAME_WIDTH - 520,
  height: 240,
} as const satisfies Rect;
const FIELD_SLOT_GRID_CELLS: Record<BattleSlotId, BattleGridCell> = {
  'enemy:BR': { column: 'FR', row: 'enemyBack' },
  'enemy:BC': { column: 'FC', row: 'enemyBack' },
  'enemy:BL': { column: 'FL', row: 'enemyBack' },
  'enemy:FR': { column: 'FR', row: 'enemyFront' },
  'enemy:FC': { column: 'FC', row: 'enemyFront' },
  'enemy:FL': { column: 'FL', row: 'enemyFront' },
  'player:FR': { column: 'FR', row: 'playerFront' },
  'player:FC': { column: 'FC', row: 'playerFront' },
  'player:FL': { column: 'FL', row: 'playerFront' },
  'player:BR': { column: 'FR', row: 'playerBack' },
  'player:BC': { column: 'FC', row: 'playerBack' },
  'player:BL': { column: 'FL', row: 'playerBack' },
};
const FIELD_SLOT_RECTS: Record<BattleSlotId, Rect> = {
  'enemy:BR': createBattleGridRect(FIELD_SLOT_GRID_CELLS['enemy:BR']),
  'enemy:BC': createBattleGridRect(FIELD_SLOT_GRID_CELLS['enemy:BC']),
  'enemy:BL': createBattleGridRect(FIELD_SLOT_GRID_CELLS['enemy:BL']),
  'enemy:FR': createBattleGridRect(FIELD_SLOT_GRID_CELLS['enemy:FR']),
  'enemy:FC': createBattleGridRect(FIELD_SLOT_GRID_CELLS['enemy:FC']),
  'enemy:FL': createBattleGridRect(FIELD_SLOT_GRID_CELLS['enemy:FL']),
  'player:FR': createBattleGridRect(FIELD_SLOT_GRID_CELLS['player:FR']),
  'player:FC': createBattleGridRect(FIELD_SLOT_GRID_CELLS['player:FC']),
  'player:FL': createBattleGridRect(FIELD_SLOT_GRID_CELLS['player:FL']),
  'player:BR': createBattleGridRect(FIELD_SLOT_GRID_CELLS['player:BR']),
  'player:BC': createBattleGridRect(FIELD_SLOT_GRID_CELLS['player:BC']),
  'player:BL': createBattleGridRect(FIELD_SLOT_GRID_CELLS['player:BL']),
};
const SLOT_ORDER: readonly BattleSlotId[] = [
  'enemy:BR',
  'enemy:BC',
  'enemy:BL',
  'enemy:FR',
  'enemy:FC',
  'enemy:FL',
  'player:FR',
  'player:FC',
  'player:FL',
  'player:BR',
  'player:BC',
  'player:BL',
];
const PILE_GRID_CELLS = {
  enemyDrop: { column: 'rightPile', row: 'enemyFront' },
  enemyExile: { column: 'rightPile', row: 'enemyBack' },
  enemyDeck: { column: 'leftPile', row: 'enemyFront' },
  playerDrop: { column: 'leftPile', row: 'playerFront' },
  playerExile: { column: 'leftPile', row: 'playerBack' },
  playerDeck: { column: 'rightPile', row: 'playerFront' },
} as const satisfies Record<string, BattleGridCell>;
type BattlePileKey = keyof typeof PILE_GRID_CELLS;
const PILE_ORDER: readonly BattlePileKey[] = [
  'enemyDeck',
  'enemyDrop',
  'enemyExile',
  'playerDrop',
  'playerDeck',
  'playerExile',
];
const PILE_RECTS: Record<BattlePileKey, Rect> = {
  enemyDrop: createBattleGridRect(PILE_GRID_CELLS.enemyDrop),
  enemyExile: createBattleGridRect(PILE_GRID_CELLS.enemyExile),
  enemyDeck: createBattleGridRect(PILE_GRID_CELLS.enemyDeck),
  playerDrop: createBattleGridRect(PILE_GRID_CELLS.playerDrop),
  playerExile: createBattleGridRect(PILE_GRID_CELLS.playerExile),
  playerDeck: createBattleGridRect(PILE_GRID_CELLS.playerDeck),
};

/**
 * 저장 슬롯의 전투 런타임을 1920x1280 임시 전장 레이아웃으로 표시하는 씬이다.
 * 전투 규칙은 도메인 런타임에 두고, 이 씬은 카드 슬롯, 손패, HUD와 저장 입력만 담당한다.
 */
export class BattlefieldScene extends Phaser.Scene {
  private handDeckContainer: Phaser.GameObjects.Container | null = null;
  private handDeckTargetY: number | null = null;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private layers!: BattlefieldSceneLayers;
  private runtime!: BattleRuntimeState;
  private session!: GameSession;
  private stageDefinition!: StageDefinition;
  private stageBattleResult: StageBattleResult | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private isAnimatingBattleEvents = false;
  private isSaving = false;
  private isReturningToStage = false;
  private resultReturnStatusMessage: string | null = null;
  private selectedSlotId: BattleSlotId | null = null;
  private selection: BattleSelection | null = null;
  private fieldCardDragPreview: Phaser.GameObjects.Container | null = null;
  private cardInfoContainer: Phaser.GameObjects.Container | null = null;
  private hoveredCardInstanceId: string | null = null;
  private statusMessage = 'Select a hand card or battlefield card.';

  constructor() {
    super({ key: 'BattlefieldScene' });
  }

  /**
   * 초기 전투 런타임을 만들고 1920x1280 기준의 단순 슬롯 전장을 구성한다.
   */
  create(data: BattlefieldSceneData): void {
    this.session = data.session;
    this.stageDefinition = requireStageDefinition(data.stageId);
    this.runtime = createInitialBattleRuntime(this.session, this.stageDefinition);
    this.stageBattleResult = null;
    this.isAnimatingBattleEvents = false;
    this.isSaving = false;
    this.isReturningToStage = false;
    this.resultReturnStatusMessage = null;
    this.selectedSlotId = null;
    this.selection = null;
    this.fieldCardDragPreview = null;
    this.cardInfoContainer = null;
    this.hoveredCardInstanceId = null;
    this.statusMessage = 'Select a hand card or battlefield card.';
    this.handDeckContainer = null;
    this.handDeckTargetY = null;

    this.layers = this.createLayers();
    this.highlightGraphics = this.add.graphics();
    this.layers.effectLayer.add(this.highlightGraphics);

    this.addBackground();
    this.renderBattleState();
  }

  /**
   * HandDeck 패널의 hover 펼침 상태를 갱신한다.
   * 별도 interactive hover zone을 두지 않아 손패 카드 선택 입력이 가려지지 않게 한다.
   */
  update(): void {
    this.updateHandDeckHover();
  }

  private renderBattleState(): void {
    if (this.handDeckContainer) {
      this.tweens.killTweensOf(this.handDeckContainer);
    }
    this.handDeckContainer = null;
    this.handDeckTargetY = null;
    this.statusText = null;
    this.cardInfoContainer?.destroy();
    this.cardInfoContainer = null;
    this.hoveredCardInstanceId = null;

    this.layers.boardLayer.removeAll(true);
    this.layers.cardLayer.removeAll(true);
    this.layers.hudLayer.removeAll(true);
    this.layers.handLayer.removeAll(true);
    this.layers.buttonLayer.removeAll(true);
    this.highlightGraphics.clear();
    this.fieldCardDragPreview = null;

    this.addLeftHud();
    this.addBoard();
    this.addBattleGridSlots();
    this.addBattlefieldCards();
    this.addHandDeckContainer();
    this.addUtilityButtons();
    this.addStatusText();
    this.redrawHighlight();
    this.addBattleResultPanelIfReady();
  }

  private createLayers(): BattlefieldSceneLayers {
    return {
      backgroundLayer: this.add.container(0, 0).setDepth(0),
      boardLayer: this.add.container(0, 0).setDepth(10),
      cardLayer: this.add.container(0, 0).setDepth(20),
      effectLayer: this.add.container(0, 0).setDepth(30),
      hudLayer: this.add.container(0, 0).setDepth(40),
      handLayer: this.add.container(0, 0).setDepth(50),
      buttonLayer: this.add.container(0, 0).setDepth(60),
    };
  }

  private addBackground(): void {
    this.layers.backgroundLayer.add(
      this.add
        .image(0, 0, 'title-background')
        .setOrigin(0, 0)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT),
    );
    this.layers.backgroundLayer.add(
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.72).setOrigin(0, 0),
    );
    this.layers.backgroundLayer.add(
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.18).setOrigin(0, 0),
    );
  }

  private addLeftHud(): void {
    this.addInfoPanel({ x: HUD_X, y: HUD_Y, width: HUD_WIDTH, height: HUD_HEIGHT }, [
      `ENEMY ${this.runtime.enemy.leader.card.definition.name}`,
      `HP ${getEffectiveHp(this.runtime, this.runtime.enemy.leader)}  ATK ${getEffectiveAttack(
        this.runtime,
        this.runtime.enemy.leader,
      )}`,
      `Deck ${this.runtime.enemy.deck.length}  Drop ${this.runtime.enemy.drop.length}`,
    ]);
    this.addInfoPanel(
      { x: HUD_X, y: HUD_Y + HUD_HEIGHT + HUD_GAP, width: HUD_WIDTH, height: HUD_HEIGHT },
      [
        `${formatSideLabel(this.runtime.currentSide)} TURN`,
        `Round ${this.runtime.turnNumber}`,
        this.runtime.outcome
          ? `${formatSideLabel(this.runtime.outcome.winner)} WINS`
          : this.runtime.phase,
      ],
    );
    this.addInfoPanel(
      { x: HUD_X, y: HUD_Y + (HUD_HEIGHT + HUD_GAP) * 2, width: HUD_WIDTH, height: HUD_HEIGHT },
      [
        `PLAYER ${this.runtime.player.leader.card.definition.name}`,
        `HP ${getEffectiveHp(this.runtime, this.runtime.player.leader)}  ATK ${getEffectiveAttack(
          this.runtime,
          this.runtime.player.leader,
        )}`,
        `Deck ${this.runtime.player.deck.length}  Hand ${this.runtime.player.hand.length}`,
      ],
    );
  }

  private addInfoPanel(rect: Rect, lines: [string, string, string]): void {
    const panel = this.add.rectangle(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width,
      rect.height,
      0x12251f,
      0.94,
    );
    panel.setStrokeStyle(2, 0xbfeec5, 0.72);
    this.layers.hudLayer.add(panel);

    const ys = [rect.y + 24, rect.y + 52, rect.y + 78] as const;
    const sizes = [16, 20, 15] as const;
    const minimumSizes = [12, 15, 12] as const;
    const colors = ['#a8c7af', '#fff7d2', '#d5e7d1'] as const;
    for (let index = 0; index < lines.length; index += 1) {
      const text = this.add
        .text(rect.x + 18, ys[index]!, lines[index]!, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: `${sizes[index]!}px`,
          color: colors[index]!,
          align: 'left',
        })
        .setOrigin(0, 0.5);
      this.fitTextToWidth(text, rect.width - 36, sizes[index]!, minimumSizes[index]!);
      this.layers.hudLayer.add(text);
    }
  }

  private fitTextToWidth(
    text: Phaser.GameObjects.Text,
    maxWidth: number,
    startFontSize: number,
    minimumFontSize: number,
  ): void {
    let fontSize = startFontSize;
    while (text.width > maxWidth && fontSize > minimumFontSize) {
      fontSize -= 1;
      text.setFontSize(fontSize);
    }
  }

  private addBoard(): void {
    const board = this.add.rectangle(
      BOARD_RECT.x + BOARD_RECT.width / 2,
      BOARD_RECT.y + BOARD_RECT.height / 2,
      BOARD_RECT.width,
      BOARD_RECT.height,
      0x0d332e,
      0.82,
    );
    board.setStrokeStyle(3, 0x9fdbc3, 0.64);
    this.layers.boardLayer.add(board);

    const divider = this.add.rectangle(
      BATTLE_GRID_CENTER_X,
      BATTLE_GRID_SIDE_DIVIDER_Y,
      BATTLE_GRID_WIDTH - 24,
      3,
      0xcde7cb,
      0.35,
    );
    this.layers.boardLayer.add(divider);
  }

  private addBattleGridSlots(): void {
    const grid = this.rexUI.add.gridSizer(
      BATTLE_GRID_X,
      BATTLE_GRID_Y,
      BATTLE_GRID_WIDTH,
      BATTLE_GRID_HEIGHT,
      BATTLE_GRID_COLUMNS.length,
      BATTLE_GRID_ROWS.length,
      {
        origin: 0,
        space: {
          column: BATTLE_GRID_COLUMN_GAP,
          row: BATTLE_GRID_ROW_GAPS,
        },
      },
    );
    this.layers.boardLayer.add(grid);

    for (const pileKey of PILE_ORDER) {
      const cell = PILE_GRID_CELLS[pileKey];
      grid.add(this.createPilePanelForKey(pileKey, PILE_RECTS[pileKey]), {
        column: BATTLE_GRID_COLUMNS.indexOf(cell.column),
        row: BATTLE_GRID_ROWS.indexOf(cell.row),
        align: 'center',
        expand: false,
      });
    }

    for (const slotId of SLOT_ORDER) {
      const cell = FIELD_SLOT_GRID_CELLS[slotId];
      grid.add(this.createSlotPanel(slotId, formatSlotLabel(slotId)), {
        column: BATTLE_GRID_COLUMNS.indexOf(cell.column),
        row: BATTLE_GRID_ROWS.indexOf(cell.row),
        align: 'center',
        expand: false,
      });
    }

    grid.layout();
  }

  private createSlotPanel(slotId: BattleSlotId, label: string): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT);
    const slot = this.add.rectangle(0, 0, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT, 0x173b34, 0.58);
    slot.setStrokeStyle(
      slotId.endsWith(':BC') ? 3 : 2,
      slotId.endsWith(':BC') ? 0xffe4a8 : 0x93b9a9,
      slotId.endsWith(':BC') ? 0.84 : 0.56,
    );
    slot.setInteractive({ useHandCursor: true });
    slot.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.selectSlot(slotId);
    });
    container.add(slot);

    container.add(
      this.add
        .text(-FIELD_SLOT_WIDTH / 2 + 10, -FIELD_SLOT_HEIGHT / 2 + 14, label, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#a9c9b6',
          align: 'left',
        })
        .setOrigin(0, 0.5)
        .setAlpha(0.84),
    );

    return container;
  }

  private createPilePanelForKey(pileKey: BattlePileKey, rect: Rect): Phaser.GameObjects.Container {
    if (pileKey === 'enemyDeck') {
      return this.createDeckPilePanel('Enemy Deck', this.runtime.enemy.deck.length, rect);
    }
    if (pileKey === 'playerDeck') {
      return this.createDeckPilePanel('Player Deck', this.runtime.player.deck.length, rect);
    }

    const labels: Record<Exclude<BattlePileKey, 'enemyDeck' | 'playerDeck'>, string> = {
      enemyDrop: `Enemy Drop\n${this.runtime.enemy.drop.length}`,
      enemyExile: `Enemy Exile\n${this.runtime.enemy.exile.length}`,
      playerDrop: `Player Drop\n${this.runtime.player.drop.length}`,
      playerExile: `Player Exile\n${this.runtime.player.exile.length}`,
    };
    return this.createPilePanel(labels[pileKey], rect);
  }

  private createPilePanel(label: string, rect: Rect): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(rect.width, rect.height);
    const panel = this.add.rectangle(0, 0, rect.width, rect.height, 0x14231f, 0.9);
    panel.setStrokeStyle(2, 0x91ab9f, 0.58);
    container.add(panel);
    container.add(
      this.add
        .text(0, 0, label, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#d9ead9',
          align: 'center',
        })
        .setOrigin(0.5),
    );
    return container;
  }

  private createDeckPilePanel(
    label: string,
    cardCount: number,
    rect: Rect,
  ): Phaser.GameObjects.Container {
    if (cardCount <= 0 || !this.textures.exists(CARD_BACK_TEXTURE_KEY)) {
      return this.createPilePanel(`${label}\n${cardCount}`, rect);
    }

    const container = this.add.container(0, 0);
    container.setSize(rect.width, rect.height);
    const panel = this.add.rectangle(0, 0, rect.width, rect.height, 0x14231f, 0.9);
    panel.setStrokeStyle(2, 0x91ab9f, 0.58);
    container.add(panel);
    container.add(
      this.add
        .image(0, 0, CARD_BACK_TEXTURE_KEY)
        .setDisplaySize(rect.width - 14, rect.height - 20)
        .setAlpha(0.96),
    );
    container.add(
      this.add
        .text(0, rect.height / 2 - 28, `${label} ${cardCount}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#f8ffe9',
          stroke: '#111b18',
          strokeThickness: 4,
          align: 'center',
        })
        .setOrigin(0.5),
    );
    return container;
  }

  private addBattlefieldCards(): void {
    const slotCards = new Map<BattleSlotId, BattleCardRuntimeState>();
    for (const card of this.runtime.battlefield) {
      if (card.battlefieldSlot) {
        slotCards.set(card.battlefieldSlot, card);
      }
    }

    for (const slotId of SLOT_ORDER) {
      const card = slotCards.get(slotId);
      if (card) {
        const cardViewOptions: CardViewOptions = {
          onClick: () => {
            this.selectBattlefieldCard(card);
          },
        };
        if (card.side === 'player') {
          cardViewOptions.onFieldDragStart = (_pointer, dragX, dragY) =>
            this.startFieldCardDrag(card, dragX, dragY);
          cardViewOptions.onFieldDrag = (_pointer, dragX, dragY) => {
            this.updateFieldCardDragPreview(dragX, dragY);
          };
          cardViewOptions.onFieldDragEnd = (pointer) => {
            this.finishFieldCardDrag(pointer.worldX, pointer.worldY);
          };
        }
        this.addCardView(this.layers.cardLayer, FIELD_SLOT_RECTS[slotId], card, 'field', {
          ...cardViewOptions,
        });
      }
    }
  }

  private addCardView(
    parent: Phaser.GameObjects.Container,
    rect: Rect,
    card: BattleCardRuntimeState,
    mode: 'field' | 'hand',
    options: CardViewOptions = {},
  ): void {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const textureKey = `cards.webp.${card.card.instance.id}`;

    if (this.textures.exists(textureKey)) {
      parent.add(
        this.add.image(centerX, centerY, textureKey).setDisplaySize(rect.width, rect.height),
      );
    } else {
      const fallback = this.add.rectangle(
        centerX,
        centerY,
        rect.width,
        rect.height,
        card.side === 'enemy' ? 0x42233c : 0x1c4238,
        0.98,
      );
      fallback.setStrokeStyle(2, 0xf6ffe3, 0.86);
      parent.add(fallback);
    }

    const paddingX = mode === 'field' ? 21 : 16;
    const paddingY = mode === 'field' ? 18 : 14;
    const badgeSize = mode === 'field' ? 34 : 30;
    const fontSize = mode === 'field' ? '18px' : '16px';

    this.addCardCornerStat(
      parent,
      rect.x + paddingX,
      rect.y + paddingY,
      String(getEffectiveDominance(this.runtime, card)),
      badgeSize,
      fontSize,
    );
    this.addCardCornerStat(
      parent,
      rect.x + rect.width - paddingX - 4,
      rect.y + paddingY,
      String(card.card.instance.cost ?? 0),
      badgeSize,
      fontSize,
    );
    this.addCardCornerStat(
      parent,
      rect.x + paddingX,
      rect.y + rect.height - paddingY - 8,
      String(getEffectiveHp(this.runtime, card)),
      badgeSize,
      fontSize,
    );
    this.addCardCornerStat(
      parent,
      rect.x + rect.width - paddingX - 4,
      rect.y + rect.height - paddingY - 8,
      String(getEffectiveAttack(this.runtime, card)),
      badgeSize,
      fontSize,
    );

    if (options.highlightColor !== undefined) {
      const highlight = this.add.rectangle(
        centerX,
        centerY,
        rect.width + 8,
        rect.height + 8,
        0x000000,
        0,
      );
      highlight.setStrokeStyle(5, options.highlightColor, 0.92);
      parent.add(highlight);
    }

    if (options.onClick) {
      const hitArea = this.add.zone(centerX, centerY, rect.width, rect.height);
      hitArea.setInteractive({
        useHandCursor: true,
        draggable: options.onFieldDragStart !== undefined,
      });
      hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, options.onClick);
      hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        const worldCenter = hitArea.getWorldTransformMatrix().transformPoint(0, 0);
        this.showCardInfo(card, worldCenter.x);
      });
      hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        this.hideCardInfo(card.card.instance.instanceId);
      });
      if (options.onFieldDragStart) {
        let isFieldDragActive = false;
        hitArea.on(
          Phaser.Input.Events.GAMEOBJECT_DRAG_START,
          (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            isFieldDragActive = options.onFieldDragStart?.(pointer, dragX, dragY) ?? false;
          },
        );
        hitArea.on(
          Phaser.Input.Events.GAMEOBJECT_DRAG,
          (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            if (isFieldDragActive) {
              options.onFieldDrag?.(pointer, dragX, dragY);
            }
          },
        );
        hitArea.on(
          Phaser.Input.Events.GAMEOBJECT_DRAG_END,
          (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            if (isFieldDragActive) {
              options.onFieldDragEnd?.(pointer, dragX, dragY);
            }
            isFieldDragActive = false;
          },
        );
      }
      parent.add(hitArea);
    }
  }

  private addCardCornerStat(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    value: string,
    size: number,
    fontSize: string,
  ): void {
    parent.add(
      this.add
        .text(x, y, value, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize,
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: Math.max(3, Math.round(size / 10)),
          align: 'center',
        })
        .setOrigin(0.5),
    );
  }

  private showCardInfo(card: BattleCardRuntimeState, anchorWorldX: number): void {
    const cardInstanceId = card.card.instance.instanceId;
    if (this.cardInfoContainer && this.hoveredCardInstanceId === cardInstanceId) {
      return;
    }

    this.hideCardInfo();
    const side: CardInfoPanelSide = anchorWorldX < GAME_WIDTH / 2 ? 'right' : 'left';
    this.cardInfoContainer = this.createCardInfoPanel(card, side);
    this.hoveredCardInstanceId = cardInstanceId;
    this.layers.hudLayer.add(this.cardInfoContainer);
  }

  private hideCardInfo(cardInstanceId?: string): void {
    if (cardInstanceId !== undefined && this.hoveredCardInstanceId !== cardInstanceId) {
      return;
    }

    this.cardInfoContainer?.destroy();
    this.cardInfoContainer = null;
    this.hoveredCardInstanceId = null;
  }

  private createCardInfoPanel(
    card: BattleCardRuntimeState,
    side: CardInfoPanelSide,
  ): Phaser.GameObjects.Container {
    const x =
      side === 'left'
        ? CARD_INFO_PANEL_MARGIN_X
        : GAME_WIDTH - CARD_INFO_PANEL_MARGIN_X - CARD_INFO_PANEL_WIDTH;
    const container = this.add.container(x, CARD_INFO_PANEL_Y);
    const background = this.add
      .rectangle(0, 0, CARD_INFO_PANEL_WIDTH, CARD_INFO_PANEL_HEIGHT, 0x10211b, 0.96)
      .setOrigin(0, 0);
    background.setStrokeStyle(3, 0xd8efcd, 0.86);
    container.add(background);

    const previewX = CARD_INFO_PANEL_WIDTH / 2;
    const previewY = CARD_INFO_PANEL_PADDING + CARD_INFO_PREVIEW_HEIGHT / 2;
    const previewBackground = this.add.rectangle(
      previewX,
      previewY,
      CARD_INFO_PREVIEW_WIDTH + 16,
      CARD_INFO_PREVIEW_HEIGHT + 16,
      card.side === 'enemy' ? 0x281c2c : 0x132c25,
      0.94,
    );
    previewBackground.setStrokeStyle(2, 0xf5ffe9, 0.64);
    container.add(previewBackground);

    const textureKey = `cards.webp.${card.card.instance.id}`;
    if (this.textures.exists(textureKey)) {
      const preview = this.add.image(previewX, previewY, textureKey);
      const previewScale = Math.min(
        CARD_INFO_PREVIEW_WIDTH / Math.max(1, preview.width),
        CARD_INFO_PREVIEW_HEIGHT / Math.max(1, preview.height),
      );
      preview.setDisplaySize(
        Math.round(preview.width * previewScale),
        Math.round(preview.height * previewScale),
      );
      container.add(preview);
    } else {
      const fallback = this.add.rectangle(
        previewX,
        previewY,
        CARD_INFO_PREVIEW_WIDTH,
        CARD_INFO_PREVIEW_HEIGHT,
        card.side === 'enemy' ? 0x42233c : 0x1c4238,
        0.98,
      );
      fallback.setStrokeStyle(2, 0xf6ffe3, 0.86);
      container.add(fallback);
      container.add(
        this.add
          .text(previewX, previewY, card.card.instance.name, {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '26px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: CARD_INFO_PREVIEW_WIDTH - 36 },
          })
          .setOrigin(0.5),
      );
    }

    const textY = CARD_INFO_PANEL_PADDING * 2 + CARD_INFO_PREVIEW_HEIGHT;
    const infoText = this.add
      .text(CARD_INFO_PANEL_PADDING, textY, this.formatCardInfoLines(card).join('\n'), {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: '#edf7e8',
        stroke: '#07100d',
        strokeThickness: 2,
        align: 'left',
        lineSpacing: 4,
        wordWrap: {
          width: CARD_INFO_PANEL_WIDTH - CARD_INFO_PANEL_PADDING * 2,
          useAdvancedWrap: true,
        },
      })
      .setOrigin(0, 0);

    const maxTextHeight = CARD_INFO_PANEL_HEIGHT - textY - CARD_INFO_PANEL_PADDING;
    if (infoText.height > maxTextHeight) {
      infoText.setFontSize('14px');
      infoText.setLineSpacing(2);
    }
    container.add(infoText);

    return container;
  }

  private formatCardInfoLines(card: BattleCardRuntimeState): string[] {
    const instance = card.card.instance;
    const definition = card.card.definition;
    const traitTexts = instance.traits
      .map((trait) => trait.text.trim() || trait.key.trim())
      .filter((trait) => trait.length > 0);
    const lines = [
      instance.name,
      `${instance.rarity} / ${instance.type}`,
      traitTexts.length > 0 ? `Trait ${traitTexts.join(', ')}` : null,
      '',
      `Cost ${instance.cost ?? 0}`,
      this.formatCardInfoStat(
        'Dominance',
        getEffectiveDominance(this.runtime, card),
        definition.dominance,
      ),
      this.formatCardInfoStat(
        instance.type === 'LEADER' ? 'LP' : 'HP',
        getEffectiveHp(this.runtime, card),
        definition.hp,
      ),
      this.formatCardInfoStat('ATK', getEffectiveAttack(this.runtime, card), definition.attack),
      `Slot ${instance.slot ?? '-'}`,
    ].filter((line): line is string => line !== null);

    if (instance.abilities.length > 0) {
      lines.push('');
      for (const ability of instance.abilities) {
        lines.push(`${ability.category} ${ability.name}: ${ability.text}`);
      }
    }

    const description = instance.description.trim();
    if (description.length > 0) {
      lines.push('', `Description: ${description}`);
    }

    const note = instance.note.trim();
    if (note.length > 0) {
      lines.push(`Note: ${note}`);
    }

    return lines;
  }

  private formatCardInfoStat(label: string, effectiveValue: number, baseValue?: number): string {
    if (baseValue !== undefined && effectiveValue !== baseValue) {
      return `${label} ${effectiveValue} (base ${baseValue})`;
    }

    return `${label} ${effectiveValue}`;
  }

  private addHandDeckContainer(): void {
    const container = this.add.container(HAND_RECT.x + HAND_RECT.width / 2, HAND_HIDDEN_Y);
    this.handDeckContainer = container;
    this.layers.handLayer.add(container);

    const panel = this.add
      .rectangle(0, 0, HAND_RECT.width, HAND_RECT.height, 0x10211b, 0.95)
      .setOrigin(0.5, 0);
    panel.setStrokeStyle(2, 0xcde7cb, 0.78);
    container.add(panel);
    this.addHandCards(container);
  }

  private addHandCards(container: Phaser.GameObjects.Container): void {
    const slotCount = Math.max(INITIAL_HAND_SIZE, this.runtime.player.hand.length);
    const gap = slotCount > INITIAL_HAND_SIZE ? 10 : 18;
    const availableWidth = HAND_RECT.width - 40;
    const cardWidth = Math.min(
      HAND_CARD_WIDTH,
      Math.floor((availableWidth - gap * (slotCount - 1)) / slotCount),
    );
    const cardHeight = Math.round(cardWidth * 1.5);
    const totalWidth = cardWidth * slotCount + gap * (slotCount - 1);
    const startX = -totalWidth / 2;
    const y = HAND_RECT.height / 2;

    for (let index = 0; index < slotCount; index += 1) {
      const card = this.runtime.player.hand[index] ?? null;
      const rect = {
        x: startX + index * (cardWidth + gap),
        y: y - cardHeight / 2,
        width: cardWidth,
        height: cardHeight,
      };

      if (card) {
        const placeActions = listPlaceActions(this.runtime).filter(
          (action) => action.cardInstanceId === card.card.instance.instanceId,
        );
        const cardViewOptions: CardViewOptions = {
          onClick: () => {
            this.selectHandCard(card);
          },
        };
        if (placeActions.length > 0 && this.isPlayerControlActive()) {
          cardViewOptions.highlightColor = PLACE_HIGHLIGHT_COLOR;
        }
        this.addCardView(container, rect, card, 'hand', {
          ...cardViewOptions,
        });
        continue;
      }

      const empty = this.add.rectangle(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width,
        rect.height,
        0x162b24,
        0.76,
      );
      empty.setStrokeStyle(2, 0x4e5d57, 0.7);
      container.add(empty);
      container.add(
        this.add
          .text(rect.x + rect.width / 2, rect.y + rect.height / 2, 'EMPTY', {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '20px',
            color: '#8e9a95',
            align: 'center',
          })
          .setOrigin(0.5),
      );
    }
  }

  private moveHandDeckContainer(y: number): void {
    if (!this.handDeckContainer) {
      return;
    }
    if (this.handDeckTargetY === y) {
      return;
    }

    this.handDeckTargetY = y;
    this.tweens.killTweensOf(this.handDeckContainer);
    this.tweens.add({
      targets: this.handDeckContainer,
      y,
      duration: 180,
      ease: 'Sine.easeOut',
    });
  }

  private updateHandDeckHover(): void {
    if (!this.handDeckContainer) {
      return;
    }

    const pointer = this.input.activePointer;
    this.moveHandDeckContainer(
      isPointerInHandDeckHoverArea(pointer, HAND_EXPANDED_Y, HAND_HIDDEN_Y)
        ? HAND_EXPANDED_Y
        : HAND_HIDDEN_Y,
    );
  }

  private addUtilityButtons(): void {
    const buttons: BottomButtonDefinition[] = [
      {
        label: 'Back',
        width: 132,
        height: 52,
        enabled: !this.isBattleEnded() && !this.isReturningToStage,
        onClick: () => {
          this.scene.start('StageScene', {
            session: {
              ...this.session,
              stageProgress: {
                ...this.session.stageProgress,
                clearedStageIds: [...this.session.stageProgress.clearedStageIds],
                lastSelectedStageId: this.stageDefinition.id,
              },
            },
          } satisfies StageSceneData);
        },
      },
      {
        label: 'Save',
        width: 132,
        height: 52,
        enabled: !this.isBattleEnded() && !this.isReturningToStage,
        onClick: () => {
          void this.saveCurrentSession();
        },
      },
      {
        label: 'Auto',
        width: 132,
        height: 52,
        enabled: false,
      },
    ];

    if (this.selection?.kind === 'BLOCK_DECISION') {
      buttons.push(
        {
          label: 'Block',
          width: 150,
          height: 56,
          enabled: !this.isAnimatingBattleEvents && !this.isBattleEnded(),
          onClick: () => {
            this.resolveBlockDecision(true);
          },
        },
        {
          label: 'No Block',
          width: 170,
          height: 56,
          enabled: !this.isAnimatingBattleEvents && !this.isBattleEnded(),
          onClick: () => {
            this.resolveBlockDecision(false);
          },
        },
      );
    } else {
      buttons.push(
        {
          label: 'Turn End',
          width: 152,
          height: 58,
          enabled: this.isPlayerControlActive(),
          onClick: () => {
            this.endCurrentTurn();
          },
        },
        {
          label: 'Skill',
          width: 152,
          height: 52,
          enabled: this.canStartActiveSkillTargeting(),
          onClick: () => {
            this.startActiveSkillTargeting();
          },
        },
      );
    }

    this.addBottomButtonRow(buttons);
  }

  private addBottomButtonRow(buttons: readonly BottomButtonDefinition[]): void {
    const totalWidth = buttons.reduce(
      (total, button, index) => total + button.width + (index === 0 ? 0 : BOTTOM_BUTTON_GAP),
      0,
    );
    let left = GAME_WIDTH / 2 - totalWidth / 2;

    for (const button of buttons) {
      const baseConfig = {
        x: left + button.width / 2,
        y: BOTTOM_BUTTON_CENTER_Y,
        width: button.width,
        height: button.height,
        label: button.label,
        enabled: button.enabled,
        parent: this.layers.buttonLayer,
      };
      if (button.onClick) {
        createMenuButton(this, { ...baseConfig, onClick: button.onClick });
      } else {
        createMenuButton(this, baseConfig);
      }

      left += button.width + BOTTOM_BUTTON_GAP;
    }
  }

  private refreshUtilityButtons(): void {
    this.layers.buttonLayer.removeAll(true);
    this.addUtilityButtons();
  }

  private addStatusText(): void {
    const rect = {
      x: HUD_X,
      y: HUD_Y + (HUD_HEIGHT + HUD_GAP) * 3,
      width: HUD_WIDTH,
      height: STATUS_PANEL_HEIGHT,
    } as const satisfies Rect;
    const panel = this.add.rectangle(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width,
      rect.height,
      0x10211b,
      0.94,
    );
    panel.setStrokeStyle(2, 0xbfeec5, 0.72);
    this.layers.hudLayer.add(panel);

    this.statusText = this.add
      .text(rect.x + 20, rect.y + 20, this.statusMessage, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '18px',
        color: '#c7d7ca',
        align: 'left',
        lineSpacing: 5,
        wordWrap: { width: rect.width - 40, useAdvancedWrap: true },
      })
      .setOrigin(0, 0)
      .setAlpha(0.9);
    this.layers.hudLayer.add(this.statusText);
  }

  private addBattleResultPanelIfReady(): void {
    if (this.isAnimatingBattleEvents) {
      return;
    }

    const result = this.ensureStageBattleResult();
    if (!result) {
      return;
    }

    const container = this.add.container(0, 0);
    this.layers.buttonLayer.add(container);

    const blocker = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
    blocker.setInteractive();
    container.add(blocker);
    container.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.52).setOrigin(0));

    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;
    const panel = this.add.rectangle(panelX, panelY, 720, 560, 0x10241e, 0.98);
    panel.setStrokeStyle(3, result.outcome === 'WIN' ? 0xffe4a8 : 0xff8e8e, 0.94);
    container.add(panel);

    container.add(
      this.add
        .text(panelX, panelY - 218, result.outcome === 'WIN' ? 'VICTORY' : 'DEFEAT', {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '58px',
          fontStyle: '700',
          color: result.outcome === 'WIN' ? '#fff3c2' : '#ffd8d8',
          stroke: '#07100d',
          strokeThickness: 7,
          align: 'center',
        })
        .setOrigin(0.5),
    );

    const resultLines = [
      `Stage: ${this.stageDefinition.name}`,
      `Reason: ${formatStageBattleResultReason(result)}`,
      `Turn: ${result.turnNumber}`,
      '',
      'Rewards',
      formatStageBattleResultRewards(result),
      '',
      'Growth',
      formatStageBattleResultGrowth(result),
    ];
    container.add(
      this.add
        .text(panelX, panelY - 126, resultLines.join('\n'), {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '24px',
          color: '#edf8e9',
          align: 'center',
          lineSpacing: 8,
          wordWrap: { width: 620 },
        })
        .setOrigin(0.5, 0),
    );

    if (this.resultReturnStatusMessage) {
      container.add(
        this.add
          .text(panelX, panelY + 166, this.resultReturnStatusMessage, {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '18px',
            color: '#d7ead4',
            align: 'center',
            wordWrap: { width: 620 },
          })
          .setOrigin(0.5),
      );
    }

    createMenuButton(this, {
      x: panelX,
      y: panelY + 224,
      width: 280,
      height: 62,
      label: 'Back to Stage',
      enabled: !this.isReturningToStage,
      parent: container,
      onClick: () => {
        void this.returnToStageWithBattleResult();
      },
    });
  }

  private canStartActiveSkillTargeting(): boolean {
    return (
      this.isPlayerControlActive() &&
      this.selection?.kind === 'FIELD_CARD' &&
      this.selection.activeSkillGroups.length > 0
    );
  }

  private startActiveSkillTargeting(): void {
    if (this.isBattleEnded()) {
      return;
    }

    if (!this.canStartActiveSkillTargeting() || this.selection?.kind !== 'FIELD_CARD') {
      return;
    }

    const skillGroup = this.selection.activeSkillGroups[0];
    if (!skillGroup) {
      return;
    }

    this.selection = {
      kind: 'ACTIVE_SKILL',
      cardInstanceId: this.selection.cardInstanceId,
      sourceSlotId: this.selection.sourceSlotId,
      skillId: skillGroup.skillId,
      skillName: skillGroup.skillName,
      activeSkillActions: skillGroup.actions,
    };
    this.selectedSlotId = null;
    this.redrawHighlight();
    this.refreshUtilityButtons();
    this.setStatus(
      `Skill: ${this.selection.skillName}. Select a gold target for ${this.getCardName(
        this.selection.cardInstanceId,
      )}.`,
    );
  }

  private selectSlot(slotId: BattleSlotId): void {
    if (this.isAnimatingBattleEvents) {
      return;
    }

    if (this.isBattleEnded()) {
      this.setStatus('Battle is over.');
      return;
    }

    if (this.selection?.kind === 'BLOCK_DECISION') {
      this.setStatus('Choose Block or No Block.');
      return;
    }

    if (this.selection?.kind === 'FIELD_CARD_DRAG') {
      this.setStatus('Drop the card on a blue move slot or red attack target.');
      return;
    }

    if (this.selection?.kind === 'HAND_CARD') {
      const action = this.selection.placeActions.find((candidate) => candidate.toSlotId === slotId);
      if (action) {
        const popupEvent = this.createActionPopupEvent(this.runtime.currentSide, action);
        applyPlaceAction(this.runtime, action);
        this.finishBattleAction(`Placed ${this.getCardName(action.cardInstanceId)} to ${slotId}.`, [
          popupEvent,
        ]);
        return;
      }

      this.setStatus(`Cannot place selected card on ${slotId}.`);
      return;
    }

    if (this.selection?.kind === 'ACTIVE_SKILL') {
      if (this.applySelectedActiveSkillToSlot(slotId)) {
        return;
      }

      this.setStatus(`Selected skill has no target on ${slotId}.`);
      return;
    }

    if (this.selection?.kind === 'FIELD_CARD') {
      const moveAction = this.selection.moveActions.find(
        (candidate) => candidate.toSlotId === slotId,
      );
      if (moveAction) {
        this.setStatus('Move uses drag and drop. Drag the selected card onto a blue slot.');
        return;
      }

      if (this.selection.attackActions.some((candidate) => candidate.toSlotId === slotId)) {
        this.setStatus('Attack uses drag and drop. Drag the selected card onto a red target.');
        return;
      }

      this.setStatus(`Selected card has no action for ${slotId}.`);
      return;
    }

    const card = findBattlefieldCardAtSlot(this.runtime, slotId);
    if (card) {
      this.selectBattlefieldCard(card);
      return;
    }

    this.selectedSlotId = slotId;
    this.selection = null;
    this.redrawHighlight();
    this.refreshUtilityButtons();
    this.setStatus(`Selected ${slotId}`);
  }

  private selectHandCard(card: BattleCardRuntimeState): void {
    if (this.isAnimatingBattleEvents) {
      return;
    }

    if (this.isBattleEnded()) {
      this.setStatus('Battle is over.');
      return;
    }

    if (this.selection?.kind === 'BLOCK_DECISION') {
      this.setStatus('Choose Block or No Block.');
      return;
    }

    if (this.selection?.kind === 'FIELD_CARD_DRAG') {
      this.setStatus('Drop the card on a blue move slot or red attack target.');
      return;
    }

    if (!this.isPlayerControlActive()) {
      this.setStatus('Only the player MAIN turn accepts hand actions.');
      return;
    }

    const placeActions = listPlaceActions(this.runtime).filter(
      (action) => action.cardInstanceId === card.card.instance.instanceId,
    );
    if (placeActions.length === 0) {
      this.selection = null;
      this.selectedSlotId = null;
      this.redrawHighlight();
      this.refreshUtilityButtons();
      this.setStatus(`${card.card.instance.name} has no legal place slot.`);
      return;
    }

    this.selection = {
      kind: 'HAND_CARD',
      cardInstanceId: card.card.instance.instanceId,
      placeActions,
    };
    this.selectedSlotId = null;
    this.redrawHighlight();
    this.refreshUtilityButtons();
    this.setStatus(`Select a green slot to place ${card.card.instance.name}.`);
  }

  private selectBattlefieldCard(card: BattleCardRuntimeState): void {
    if (this.isAnimatingBattleEvents) {
      return;
    }

    if (this.isBattleEnded()) {
      this.setStatus('Battle is over.');
      return;
    }

    if (this.selection?.kind === 'BLOCK_DECISION') {
      this.setStatus('Choose Block or No Block.');
      return;
    }

    if (this.selection?.kind === 'FIELD_CARD_DRAG') {
      this.setStatus('Drop the card on a blue move slot or red attack target.');
      return;
    }

    if (this.selection?.kind === 'ACTIVE_SKILL' && card.battlefieldSlot !== null) {
      if (this.applySelectedActiveSkillToSlot(card.battlefieldSlot)) {
        return;
      }

      this.setStatus(`${card.card.instance.name} is not a selected skill target.`);
      return;
    }

    if (
      this.selection?.kind === 'FIELD_CARD' &&
      card.battlefieldSlot !== null &&
      card.side !== this.runtime.currentSide
    ) {
      if (
        this.selection.attackActions.some(
          (candidate) => candidate.toSlotId === card.battlefieldSlot,
        )
      ) {
        this.setStatus('Attack uses drag and drop. Drag the selected card onto this target.');
        return;
      }
    }

    if (!this.isPlayerControlActive()) {
      this.setStatus('Only the player turn accepts battlefield actions.');
      return;
    }

    if (card.side !== this.runtime.currentSide || card.battlefieldSlot === null) {
      this.setStatus(`${card.card.instance.name} is not a current-side card.`);
      return;
    }

    const moveActions = listMoveActions(this.runtime).filter(
      (action) => action.cardInstanceId === card.card.instance.instanceId,
    );
    const attackActions = listAttackActions(this.runtime).filter(
      (action) => action.attackerInstanceId === card.card.instance.instanceId,
    );
    const activeSkillActions = listActiveSkillActions(this.runtime).filter(
      (action) => action.cardInstanceId === card.card.instance.instanceId,
    );
    const activeSkillGroups = groupActiveSkillActions(card, activeSkillActions);
    if (moveActions.length === 0 && attackActions.length === 0 && activeSkillGroups.length === 0) {
      this.selection = null;
      this.selectedSlotId = card.battlefieldSlot;
      this.redrawHighlight();
      this.refreshUtilityButtons();
      this.setStatus(`${card.card.instance.name} has no legal action.`);
      return;
    }

    this.selection = {
      kind: 'FIELD_CARD',
      cardInstanceId: card.card.instance.instanceId,
      sourceSlotId: card.battlefieldSlot,
      moveActions,
      attackActions,
      activeSkillGroups,
    };
    this.selectedSlotId = null;
    this.redrawHighlight();
    this.refreshUtilityButtons();
    this.setStatus(
      formatFieldCardSelectionStatus(card, moveActions, attackActions, activeSkillGroups),
    );
  }

  private applySelectedActiveSkillToSlot(slotId: BattleSlotId): boolean {
    if (this.selection?.kind !== 'ACTIVE_SKILL') {
      return false;
    }

    const action = this.selection.activeSkillActions.find(
      (candidate) => candidate.targetSlotId === slotId,
    );
    if (!action) {
      return false;
    }

    applyActiveSkillAction(this.runtime, action);
    this.finishBattleAction(
      `${this.getCardName(action.cardInstanceId)} used ${this.selection.skillName} (${formatActiveSkillEffect(
        action,
      )}) on ${this.getCardName(action.targetInstanceId)}.`,
      [this.createActiveSkillPopupEvent(action, this.selection.skillName)],
    );
    return true;
  }

  private startFieldCardDrag(card: BattleCardRuntimeState, x: number, y: number): boolean {
    if (
      this.isBattleEnded() ||
      !this.isPlayerControlActive() ||
      this.selection?.kind === 'ACTIVE_SKILL' ||
      this.selection?.kind === 'BLOCK_DECISION' ||
      card.side !== this.runtime.currentSide ||
      card.battlefieldSlot === null
    ) {
      return false;
    }

    const moveActions = listMoveActions(this.runtime).filter(
      (action) => action.cardInstanceId === card.card.instance.instanceId,
    );
    const attackActions = listAttackActions(this.runtime).filter(
      (action) => action.attackerInstanceId === card.card.instance.instanceId,
    );
    if (moveActions.length === 0 && attackActions.length === 0) {
      return false;
    }

    this.hideCardInfo(card.card.instance.instanceId);
    this.destroyFieldCardDragPreview();
    this.selection = {
      kind: 'FIELD_CARD_DRAG',
      cardInstanceId: card.card.instance.instanceId,
      sourceSlotId: card.battlefieldSlot,
      moveActions,
      attackActions,
    };
    this.selectedSlotId = null;
    this.createFieldCardDragPreview(
      card,
      x,
      y,
      attackActions.length > 0 ? ATTACK_HIGHLIGHT_COLOR : MOVE_HIGHLIGHT_COLOR,
    );
    this.redrawHighlight();
    this.refreshUtilityButtons();
    this.setStatus(formatFieldCardDragStatus(card, moveActions, attackActions));
    return true;
  }

  private updateFieldCardDragPreview(x: number, y: number): void {
    if (!this.fieldCardDragPreview) {
      return;
    }

    this.fieldCardDragPreview.setPosition(x, y);
  }

  private finishFieldCardDrag(x: number, y: number): void {
    if (this.isBattleEnded()) {
      this.destroyFieldCardDragPreview();
      return;
    }

    if (this.selection?.kind !== 'FIELD_CARD_DRAG') {
      this.destroyFieldCardDragPreview();
      return;
    }

    const selection = this.selection;
    this.destroyFieldCardDragPreview();
    const targetSlotId = this.findFieldSlotAtPoint(x, y);
    const moveAction =
      targetSlotId === null
        ? null
        : (selection.moveActions.find((candidate) => candidate.toSlotId === targetSlotId) ?? null);
    if (moveAction) {
      const popupEvent = this.createActionPopupEvent(this.runtime.currentSide, moveAction);
      applyMoveAction(this.runtime, moveAction);
      this.finishBattleAction(
        `Moved ${this.getCardName(moveAction.cardInstanceId)} to ${targetSlotId}.`,
        [popupEvent],
      );
      return;
    }

    const attackAction =
      targetSlotId === null
        ? null
        : (selection.attackActions.find((candidate) => candidate.toSlotId === targetSlotId) ??
          null);
    if (!attackAction) {
      this.selection = null;
      this.selectedSlotId = null;
      this.redrawHighlight();
      this.refreshUtilityButtons();
      this.setStatus(
        'Action canceled. Drop the card on a blue slot to move or red target to attack.',
      );
      return;
    }

    applyAttackAction(this.runtime, attackAction);
    const popupEvent = this.createActionPopupEvent(this.runtime.currentSide, attackAction);
    this.finishBattleAction(
      `${this.getCardName(attackAction.attackerInstanceId)} attacked ${this.getCardName(
        attackAction.targetInstanceId,
      )}.`,
      [popupEvent],
    );
  }

  private createFieldCardDragPreview(
    card: BattleCardRuntimeState,
    x: number,
    y: number,
    borderColor: number,
  ): void {
    const container = this.add.container(x, y).setAlpha(0.78).setDepth(100);
    const width = Math.round(FIELD_SLOT_WIDTH * 0.72);
    const height = Math.round(FIELD_SLOT_HEIGHT * 0.72);
    const textureKey = `cards.webp.${card.card.instance.id}`;

    if (this.textures.exists(textureKey)) {
      container.add(this.add.image(0, 0, textureKey).setDisplaySize(width, height));
    } else {
      const fallback = this.add.rectangle(0, 0, width, height, 0x1c4238, 0.98);
      fallback.setStrokeStyle(2, 0xf6ffe3, 0.86);
      container.add(fallback);
      container.add(
        this.add
          .text(0, 0, card.card.instance.name, {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '18px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: width - 18 },
          })
          .setOrigin(0.5),
      );
    }

    const border = this.add.rectangle(0, 0, width + 8, height + 8, 0x000000, 0);
    border.setStrokeStyle(4, borderColor, 0.94);
    container.add(border);
    this.layers.effectLayer.add(container);
    this.fieldCardDragPreview = container;
  }

  private destroyFieldCardDragPreview(): void {
    this.fieldCardDragPreview?.destroy();
    this.fieldCardDragPreview = null;
  }

  private findFieldSlotAtPoint(x: number, y: number): BattleSlotId | null {
    for (const slotId of SLOT_ORDER) {
      const rect = FIELD_SLOT_RECTS[slotId];
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
        return slotId;
      }
    }

    return null;
  }

  private redrawHighlight(): void {
    this.highlightGraphics.clear();

    if (this.selection?.kind === 'HAND_CARD') {
      for (const action of this.selection.placeActions) {
        this.drawSlotHighlight(action.toSlotId, PLACE_HIGHLIGHT_COLOR, 0.94);
      }
    }

    if (this.selection?.kind === 'FIELD_CARD') {
      this.drawSlotHighlight(this.selection.sourceSlotId, SELECTED_HIGHLIGHT_COLOR, 0.98);
      for (const action of this.selection.moveActions) {
        this.drawSlotHighlight(action.toSlotId, MOVE_HIGHLIGHT_COLOR, 0.9);
      }
    }

    if (this.selection?.kind === 'ACTIVE_SKILL') {
      this.drawSlotHighlight(this.selection.sourceSlotId, SELECTED_HIGHLIGHT_COLOR, 0.98);
      for (const action of this.selection.activeSkillActions) {
        if (action.skillId !== this.selection.skillId) {
          continue;
        }

        this.drawSlotHighlight(action.targetSlotId, SKILL_HIGHLIGHT_COLOR, 0.92);
      }
    }

    if (this.selection?.kind === 'FIELD_CARD_DRAG') {
      this.drawSlotHighlight(this.selection.sourceSlotId, SELECTED_HIGHLIGHT_COLOR, 0.98);
      for (const action of this.selection.moveActions) {
        this.drawSlotHighlight(action.toSlotId, MOVE_HIGHLIGHT_COLOR, 0.9);
      }
      for (const action of this.selection.attackActions) {
        this.drawSlotHighlight(action.toSlotId, ATTACK_HIGHLIGHT_COLOR, 0.92);
      }
    }

    if (this.selection?.kind === 'BLOCK_DECISION') {
      this.drawSlotHighlight(this.selection.attackAction.toSlotId, ATTACK_HIGHLIGHT_COLOR, 0.88);
      for (const action of this.selection.blockActions) {
        this.drawSlotHighlight(action.blockerSlotId, BLOCK_HIGHLIGHT_COLOR, 0.94);
      }
    }

    if (this.selectedSlotId) {
      this.drawSlotHighlight(this.selectedSlotId, SELECTED_HIGHLIGHT_COLOR, 0.98);
    }
  }

  private drawSlotHighlight(slotId: BattleSlotId, color: number, alpha: number): void {
    const rect = FIELD_SLOT_RECTS[slotId];
    this.highlightGraphics.lineStyle(6, color, alpha);
    this.highlightGraphics.strokeRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6);
    this.highlightGraphics.lineStyle(2, 0xffffff, 0.72);
    this.highlightGraphics.strokeRect(rect.x + 11, rect.y + 11, rect.width - 22, rect.height - 22);
  }

  private finishBattleAction(message: string, popupEvents: BattlePopupEvent[]): void {
    const flow = this.settleTurnFlow();
    const messages = [message, ...flow.messages];
    if (this.runtime.outcome) {
      messages.push(`${formatSideLabel(this.runtime.outcome.winner)} wins.`);
    }
    this.commitBattleStateUpdate(messages, [...popupEvents, ...flow.popupEvents], {
      selection: flow.pendingBlockSelection,
    });
  }

  private endCurrentTurn(): void {
    if (this.isBattleEnded()) {
      return;
    }

    if (!this.isPlayerControlActive()) {
      return;
    }

    const flow = this.settleTurnFlow(applyTurnEnd(this.runtime, 'MANUAL'));
    this.commitBattleStateUpdate(flow.messages, flow.popupEvents, {
      selection: flow.pendingBlockSelection,
    });
  }

  private resolveBlockDecision(useBlock: boolean): void {
    if (
      this.isBattleEnded() ||
      this.isAnimatingBattleEvents ||
      this.selection?.kind !== 'BLOCK_DECISION'
    ) {
      return;
    }

    const selection = this.selection;
    const blockAction = useBlock ? (selection.blockActions[0] ?? null) : null;
    const popupEvents: BattlePopupEvent[] = [];
    let message: string;

    if (blockAction) {
      applyBlockAction(this.runtime, blockAction);
      popupEvents.push(this.createBlockPopupEvent(blockAction));
      message = `${this.getCardName(blockAction.blockerInstanceId)} blocked attack on ${this.getCardName(
        selection.attackAction.targetInstanceId,
      )}.`;
    } else {
      applyAttackAction(this.runtime, selection.attackAction);
      popupEvents.push(
        this.createActionPopupEvent(this.runtime.currentSide, selection.attackAction),
      );
      message = `${this.getCardName(selection.attackAction.attackerInstanceId)} attacked ${this.getCardName(
        selection.attackAction.targetInstanceId,
      )}.`;
    }

    const flow = this.settleTurnFlow([], selection.automatedActionCount + 1);
    const messages = [message, ...flow.messages];
    if (this.runtime.outcome) {
      messages.push(`${formatSideLabel(this.runtime.outcome.winner)} wins.`);
    }
    this.commitBattleStateUpdate(messages, [...popupEvents, ...flow.popupEvents], {
      selection: flow.pendingBlockSelection,
    });
  }

  private commitBattleStateUpdate(
    messages: string[],
    popupEvents: BattlePopupEvent[],
    options: {
      selection?: BattleSelection | null;
    } = {},
  ): void {
    this.selection = options.selection ?? null;
    this.selectedSlotId = null;
    this.statusMessage = messages.join(' ');
    this.isAnimatingBattleEvents = popupEvents.length > 0;
    this.renderBattleState();

    if (popupEvents.length > 0) {
      void this.playBattlePopupEvents(popupEvents);
    }
  }

  private settleTurnFlow(
    initialEvents: readonly BattleTurnEvent[] = [],
    initialAutomatedActionCount = 0,
  ): BattleFlowResult {
    const messages = this.formatTurnEvents(initialEvents);
    const popupEvents = this.createPopupEventsForTurnEvents(initialEvents);
    let pendingBlockSelection: Extract<BattleSelection, { kind: 'BLOCK_DECISION' }> | null = null;
    const stalledEvents: BattleTurnEvent[] = [];
    if (applyAutoTurnEndIfStalled(this.runtime, stalledEvents)) {
      messages.push(...this.formatTurnEvents(stalledEvents));
      popupEvents.push(...this.createPopupEventsForTurnEvents(stalledEvents));
    }

    if (this.runtime.currentSide === 'enemy' && this.runtime.phase !== 'GAME_OVER') {
      const enemyTurnResult = runAutomatedTurnUntilBlockDecision(this.runtime, 'enemy', {
        interruptForBlockSide: 'player',
        initialActionCount: initialAutomatedActionCount,
      });
      messages.push(...this.formatTurnEvents(enemyTurnResult.events));
      popupEvents.push(...this.createPopupEventsForTurnEvents(enemyTurnResult.events));

      if (enemyTurnResult.blockDecision) {
        pendingBlockSelection = {
          kind: 'BLOCK_DECISION',
          attackAction: enemyTurnResult.blockDecision.attackAction,
          blockActions: enemyTurnResult.blockDecision.blockActions,
          automatedActionCount: enemyTurnResult.actionCount,
        };
        messages.push(
          `${this.getCardName(
            pendingBlockSelection.attackAction.attackerInstanceId,
          )} is attacking ${this.getCardName(
            pendingBlockSelection.attackAction.targetInstanceId,
          )}. Choose Block or No Block.`,
        );
      }
    }

    return {
      messages,
      popupEvents,
      pendingBlockSelection,
    };
  }

  private isPlayerControlActive(): boolean {
    return (
      !this.isAnimatingBattleEvents &&
      this.runtime.currentSide === 'player' &&
      this.runtime.phase !== 'GAME_OVER'
    );
  }

  private isBattleEnded(): boolean {
    return (
      this.stageBattleResult !== null ||
      this.runtime.outcome !== null ||
      this.runtime.phase === 'GAME_OVER'
    );
  }

  private ensureStageBattleResult(): StageBattleResult | null {
    if (!this.runtime.outcome) {
      return null;
    }

    if (!this.stageBattleResult) {
      this.stageBattleResult = createStageBattleResult(this.runtime, this.stageDefinition);
      this.session = applyStageBattleResultToSession(this.session, this.stageBattleResult);
      this.resultReturnStatusMessage = 'Return to Stage to save this result.';
    }

    return this.stageBattleResult;
  }

  private async returnToStageWithBattleResult(): Promise<void> {
    const result = this.ensureStageBattleResult();
    if (!result || this.isReturningToStage) {
      return;
    }

    this.isReturningToStage = true;
    this.resultReturnStatusMessage = 'Saving result...';
    this.renderBattleState();

    try {
      const savedState = await saveSlotState(createSaveSlotStateFromGameSession(this.session));
      const savedSession = createGameSession(savedState);
      this.scene.start('StageScene', {
        session: savedSession,
        lastBattleResult: result,
      } satisfies StageSceneData);
    } catch (error: unknown) {
      this.isReturningToStage = false;
      const message = error instanceof Error ? error.message : String(error);
      this.resultReturnStatusMessage = `Save failed: ${message}`;
      this.renderBattleState();
    }
  }

  private getCardName(instanceId: string): string {
    const card = [
      ...this.runtime.battlefield,
      ...this.runtime.player.hand,
      ...this.runtime.enemy.hand,
      ...this.runtime.player.deck,
      ...this.runtime.enemy.deck,
      ...this.runtime.player.drop,
      ...this.runtime.enemy.drop,
      ...this.runtime.player.exile,
      ...this.runtime.enemy.exile,
    ].find((entry) => entry.card.instance.instanceId === instanceId);

    return card?.card.instance.name ?? instanceId;
  }

  private formatTurnEvents(events: readonly BattleTurnEvent[]): string[] {
    return events
      .map((event) => this.formatTurnEvent(event))
      .filter((message): message is string => message !== null);
  }

  private formatTurnEvent(event: BattleTurnEvent): string | null {
    if (event.type === 'TURN_START') {
      if (!event.drewCardInstanceId) {
        return `${formatSideLabel(event.side)} deck is empty.`;
      }

      return `${formatSideLabel(event.side)} drew ${this.getCardName(event.drewCardInstanceId)}.`;
    }

    if (event.type === 'TURN_END') {
      if (event.reason === 'STALLED') {
        return `${formatSideLabel(event.side)} had no actions and ended automatically.`;
      }
      if (event.reason === 'NO_ACTION') {
        return `${formatSideLabel(event.side)} had no automated action.`;
      }
      if (event.reason === 'ACTION_LIMIT') {
        return `${formatSideLabel(event.side)} ended after the action limit.`;
      }

      return `${formatSideLabel(event.side)} turn ended.`;
    }

    if (event.type === 'ACTION_LIMIT') {
      return `${formatSideLabel(event.side)} reached ${event.actionCount} automated actions.`;
    }

    if (event.action.type === 'PLACE') {
      return `${formatSideLabel(event.side)} placed ${this.getCardName(
        event.action.cardInstanceId,
      )} to ${event.action.toSlotId}.`;
    }

    if (event.action.type === 'MOVE') {
      return `${formatSideLabel(event.side)} moved ${this.getCardName(
        event.action.cardInstanceId,
      )} to ${event.action.toSlotId}.`;
    }

    return `${formatSideLabel(event.side)} attacked ${this.getCardName(
      event.action.targetInstanceId,
    )} with ${this.getCardName(event.action.attackerInstanceId)}.`;
  }

  private createPopupEventsForTurnEvents(events: readonly BattleTurnEvent[]): BattlePopupEvent[] {
    return events
      .filter(
        (event): event is Extract<BattleTurnEvent, { type: 'ACTION' }> => event.type === 'ACTION',
      )
      .map((event) => this.createActionPopupEvent(event.side, event.action));
  }

  private createActionPopupEvent(
    side: BattleSide,
    action: BattleAutomationAction,
  ): BattlePopupEvent {
    void side;
    if (action.type === 'PLACE') {
      return {
        kind: 'PLACE',
        slotId: action.toSlotId,
        text: 'PLACE',
      };
    }

    if (action.type === 'MOVE') {
      return {
        kind: 'MOVE',
        slotId: action.toSlotId,
        text: 'MOVE',
      };
    }

    return {
      kind: 'ATTACK',
      slotId: action.toSlotId,
      text: `ATTACK -${action.attack}`,
    };
  }

  private createBlockPopupEvent(action: BlockBattleAction): BattlePopupEvent {
    return {
      kind: 'BLOCK',
      slotId: action.blockerSlotId,
      text: `BLOCK -${action.attackAction.attack}`,
    };
  }

  private createActiveSkillPopupEvent(
    action: ActiveSkillBattleAction,
    skillName: string,
  ): BattlePopupEvent {
    if (action.effect === 'HEAL') {
      return {
        kind: 'SKILL',
        slotId: action.targetSlotId,
        text: `${skillName} +${action.value}`,
      };
    }

    if (action.effect === 'DAMAGE') {
      return {
        kind: 'SKILL',
        slotId: action.targetSlotId,
        text: `${skillName} -${action.value}`,
      };
    }

    return {
      kind: 'SKILL',
      slotId: action.targetSlotId,
      text: `${skillName} ATK+${action.value}`,
    };
  }

  private async playBattlePopupEvents(events: readonly BattlePopupEvent[]): Promise<void> {
    for (const event of events) {
      if (!this.scene.isActive()) {
        return;
      }

      await this.playBattlePopupEvent(event);
    }

    this.isAnimatingBattleEvents = false;
    this.renderBattleState();
  }

  private playBattlePopupEvent(event: BattlePopupEvent): Promise<void> {
    const rect = FIELD_SLOT_RECTS[event.slotId];
    const centerX = rect.x + rect.width / 2;
    const y = rect.y + 38;
    const style = POPUP_STYLE[event.kind];
    const container = this.add.container(centerX, y);
    container.setAlpha(1);

    const text = this.add
      .text(0, 0, event.text, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: style.color,
        stroke: '#07100d',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5);
    const bubble = this.add.rectangle(0, 0, Math.max(112, text.width + 34), 44, style.fill, 0.94);
    bubble.setStrokeStyle(3, style.stroke, 0.92);

    container.add([bubble, text]);
    this.layers.effectLayer.add(container);

    return new Promise((resolve) => {
      this.tweens.add({
        targets: container,
        y: y - 44,
        alpha: 0,
        scale: 1.08,
        duration: BATTLE_POPUP_DURATION_MS,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          container.destroy();
          resolve();
        },
      });
    });
  }

  private async saveCurrentSession(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.setStatus(`Saving Slot ${this.session.slotId}...`);

    try {
      const state = createSaveSlotStateFromGameSession(this.session);
      await saveSlotState(state);
      const reloadedState = await fetchSaveSlot(state.slotId);
      this.session = createGameSession(reloadedState);
      this.setStatus(`Saved ${formatSaveStatusDate(reloadedState.updatedAt)}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Save failed: ${message}`);
    } finally {
      this.isSaving = false;
    }
  }

  private setStatus(message: string): void {
    this.statusMessage = message;
    this.statusText?.setText(message);
  }
}

/**
 * 전장 grid의 cell 정의를 카드 배치, 드롭 판정, 하이라이트가 공유하는 rect로 변환한다.
 */
function createBattleGridRect(cell: BattleGridCell): Rect {
  return {
    x: BATTLE_GRID_COLUMN_X[cell.column],
    y: BATTLE_GRID_ROW_Y[cell.row],
    width: FIELD_SLOT_WIDTH,
    height: FIELD_SLOT_HEIGHT,
  };
}

/**
 * 포인터가 HandDeck을 펼친 상태로 유지해야 하는 화면 영역 안에 있는지 판정한다.
 */
function isPointerInHandDeckHoverArea(
  pointer: Phaser.Input.Pointer,
  expandedY: number,
  hiddenY: number,
): boolean {
  const x = pointer.worldX;
  const y = pointer.worldY;
  return (
    x >= HAND_RECT.x &&
    x <= HAND_RECT.x + HAND_RECT.width &&
    y >= expandedY &&
    y <= Math.min(GAME_HEIGHT, hiddenY + HAND_RECT.height)
  );
}

/**
 * 도메인 슬롯 id를 화면 슬롯 라벨로 축약한다.
 */
function formatSlotLabel(slotId: BattleSlotId): string {
  const [side, zone] = slotId.split(':') as ['player' | 'enemy', string];
  return `${side === 'enemy' ? 'E' : 'P'}${zone}`;
}

/**
 * 전투 진영을 HUD와 상태 메시지에 표시할 짧은 영문 라벨로 변환한다.
 */
function formatSideLabel(side: BattleSide): string {
  return side === 'player' ? 'PLAYER' : 'ENEMY';
}

/**
 * 같은 ACTION 능력에서 나온 대상별 액션을 하나의 선택 단위로 묶는다.
 * Scene은 이 그룹의 첫 번째 항목만 단일 Skill 버튼에 연결한다.
 */
function groupActiveSkillActions(
  card: BattleCardRuntimeState,
  actions: ActiveSkillBattleAction[],
): ActiveSkillActionGroup[] {
  const groupedActions = new Map<string, ActiveSkillBattleAction[]>();
  for (const action of actions) {
    const group = groupedActions.get(action.skillId);
    if (group) {
      group.push(action);
      continue;
    }

    groupedActions.set(action.skillId, [action]);
  }

  return [...groupedActions.entries()].map(([skillId, group]) => ({
    skillId,
    skillName: resolveActiveSkillName(card, skillId),
    actions: group,
  }));
}

/**
 * 카드 definition의 ACTION 능력 이름을 UI 표시명으로 해석한다.
 * 일치하는 카드 능력이 없으면 데이터 문제를 화면에서 추적할 수 있게 skillId를 그대로 사용한다.
 */
function resolveActiveSkillName(card: BattleCardRuntimeState, skillId: string): string {
  return card.card.definition.abilities.find((ability) => ability.id === skillId)?.name ?? skillId;
}

/**
 * 전장 카드 선택 상태 메시지를 후보 action 종류와 ACTION 능력명에 맞춰 구성한다.
 */
function formatFieldCardSelectionStatus(
  card: BattleCardRuntimeState,
  moveActions: readonly MoveBattleAction[],
  attackActions: readonly AttackBattleAction[],
  activeSkillGroups: readonly ActiveSkillActionGroup[],
): string {
  const actionLabels = [
    moveActions.length > 0 ? 'drag to move' : null,
    attackActions.length > 0 ? 'drag to attack' : null,
    activeSkillGroups.length > 0 ? 'Skill' : null,
  ].filter((label): label is string => label !== null);
  const skillText =
    activeSkillGroups.length > 0
      ? ` Skill: ${activeSkillGroups.map((group) => group.skillName).join(', ')}.`
      : '';

  return `Select ${actionLabels.join(', ')} for ${card.card.instance.name}.${skillText}`;
}

/**
 * 전장 카드 드래그 중 드롭 가능한 이동/공격 대상을 상태 메시지로 안내한다.
 */
function formatFieldCardDragStatus(
  card: BattleCardRuntimeState,
  moveActions: readonly MoveBattleAction[],
  attackActions: readonly AttackBattleAction[],
): string {
  const dropLabels = [
    moveActions.length > 0 ? 'a blue slot to move' : null,
    attackActions.length > 0 ? 'a red target to attack' : null,
  ].filter((label): label is string => label !== null);

  return `Drop ${card.card.instance.name} on ${dropLabels.join(' or ')}.`;
}

/**
 * 활성 스킬 효과를 상태 메시지에 넣을 짧은 영문 문구로 변환한다.
 */
function formatActiveSkillEffect(action: ActiveSkillBattleAction): string {
  if (action.effect === 'HEAL') {
    return `Heal +${action.value}`;
  }
  if (action.effect === 'DAMAGE') {
    return `Damage ${action.value}`;
  }

  return `Attack +${action.value}`;
}

/**
 * 저장 완료 상태에 표시할 갱신 시각을 한국어 로케일 문자열로 변환한다.
 */
function formatSaveStatusDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatStageBattleResultReason(result: StageBattleResult): string {
  if (result.reason === 'ENEMY_LEADER_DEFEATED') {
    return 'Enemy leader defeated.';
  }

  return 'Player leader defeated.';
}

function formatStageBattleResultRewards(result: StageBattleResult): string {
  if (result.rewardCardNames.length === 0) {
    return 'No rewards.';
  }

  return result.rewardCardNames.join('\n');
}

function formatStageBattleResultGrowth(result: StageBattleResult): string {
  if (result.growth.cardInstanceIds.length === 0 || result.growth.expPerCard <= 0) {
    return 'No growth EXP.';
  }

  return `+${result.growth.expPerCard} EXP to ${result.growth.cardInstanceIds.length} cards.`;
}
