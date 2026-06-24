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
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
import type { BattlefieldSceneData } from './scene-data';

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
      kind: 'ATTACK_DRAG';
      cardInstanceId: string;
      sourceSlotId: BattleSlotId;
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

type CardViewOptions = {
  highlightColor?: number;
  onClick?: () => void;
  onAttackDragStart?: (
    pointer: Phaser.Input.Pointer,
    dragX: number,
    dragY: number,
  ) => boolean;
  onAttackDrag?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;
  onAttackDragEnd?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;
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

const FIELD_SLOT_WIDTH = 180;
const FIELD_SLOT_HEIGHT = 270;
const HAND_CARD_WIDTH = 144;
const BATTLE_POPUP_DURATION_MS = 500;
const PLACE_HIGHLIGHT_COLOR = 0x71d879;
const MOVE_HIGHLIGHT_COLOR = 0x79b8ff;
const ATTACK_HIGHLIGHT_COLOR = 0xff6f6f;
const SKILL_HIGHLIGHT_COLOR = 0xf4c95d;
const BLOCK_HIGHLIGHT_COLOR = 0xc8f47a;
const SELECTED_HIGHLIGHT_COLOR = 0xfff1a3;
const CARD_BACK_TEXTURE_KEY = 'cards.webp.card_back';
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
const SLOT_COLUMNS = {
  FR: GAME_WIDTH / 2 - 210,
  FC: GAME_WIDTH / 2,
  FL: GAME_WIDTH / 2 + 210,
} as const;
const SLOT_ROWS = {
  enemyBack: 400,
  enemyFront: 700,
  playerFront: 1100,
  playerBack: 1400,
} as const;
const BOARD_RECT = {
  x: 44,
  y: 244,
  width: GAME_WIDTH - 88,
  height: 1314,
} as const satisfies Rect;
const HAND_RECT = {
  x: 190,
  y: 1526,
  width: GAME_WIDTH - 380,
  height: 288,
} as const satisfies Rect;
const FIELD_SLOT_RECTS: Record<BattleSlotId, Rect> = {
  'enemy:BR': createCenteredRect(
    SLOT_COLUMNS.FR,
    SLOT_ROWS.enemyBack,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'enemy:BC': createCenteredRect(
    SLOT_COLUMNS.FC,
    SLOT_ROWS.enemyBack,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'enemy:BL': createCenteredRect(
    SLOT_COLUMNS.FL,
    SLOT_ROWS.enemyBack,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'enemy:FR': createCenteredRect(
    SLOT_COLUMNS.FR,
    SLOT_ROWS.enemyFront,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'enemy:FC': createCenteredRect(
    SLOT_COLUMNS.FC,
    SLOT_ROWS.enemyFront,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'enemy:FL': createCenteredRect(
    SLOT_COLUMNS.FL,
    SLOT_ROWS.enemyFront,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'player:FR': createCenteredRect(
    SLOT_COLUMNS.FR,
    SLOT_ROWS.playerFront,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'player:FC': createCenteredRect(
    SLOT_COLUMNS.FC,
    SLOT_ROWS.playerFront,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'player:FL': createCenteredRect(
    SLOT_COLUMNS.FL,
    SLOT_ROWS.playerFront,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'player:BR': createCenteredRect(
    SLOT_COLUMNS.FR,
    SLOT_ROWS.playerBack,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'player:BC': createCenteredRect(
    SLOT_COLUMNS.FC,
    SLOT_ROWS.playerBack,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
  'player:BL': createCenteredRect(
    SLOT_COLUMNS.FL,
    SLOT_ROWS.playerBack,
    FIELD_SLOT_WIDTH,
    FIELD_SLOT_HEIGHT,
  ),
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
const PILE_RECTS = {
  enemyDrop: createCenteredRect(1040, SLOT_ROWS.enemyFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  enemyExile: createCenteredRect(1040, SLOT_ROWS.enemyBack, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  enemyDeck: createCenteredRect(160, SLOT_ROWS.enemyFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  playerDrop: createCenteredRect(160, SLOT_ROWS.playerFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  playerExile: createCenteredRect(160, SLOT_ROWS.playerBack, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  playerDeck: createCenteredRect(1040, SLOT_ROWS.playerFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
} as const satisfies Record<string, Rect>;

/**
 * 저장 슬롯의 전투 런타임을 1200x1920 단순 전장 레이아웃으로 표시하는 씬이다.
 * 전투 규칙은 도메인 런타임에 두고, 이 씬은 카드 슬롯, 손패, HUD와 저장 입력만 담당한다.
 */
export class BattlefieldScene extends Phaser.Scene {
  private handDeckContainer: Phaser.GameObjects.Container | null = null;
  private handDeckTargetY: number | null = null;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private layers!: BattlefieldSceneLayers;
  private runtime!: BattleRuntimeState;
  private session!: GameSession;
  private statusText: Phaser.GameObjects.Text | null = null;
  private isAnimatingBattleEvents = false;
  private isSaving = false;
  private selectedSlotId: BattleSlotId | null = null;
  private selection: BattleSelection | null = null;
  private attackDragPreview: Phaser.GameObjects.Container | null = null;
  private statusMessage = 'Select a hand card or battlefield card.';

  constructor() {
    super({ key: 'BattlefieldScene' });
  }

  /**
   * 초기 전투 런타임을 만들고 1200x1920 기준의 단순 슬롯 전장을 구성한다.
   */
  create(data: BattlefieldSceneData): void {
    this.session = data.session;
    this.runtime = createInitialBattleRuntime(this.session);
    this.isAnimatingBattleEvents = false;
    this.isSaving = false;
    this.selectedSlotId = null;
    this.selection = null;
    this.attackDragPreview = null;
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

    this.layers.boardLayer.removeAll(true);
    this.layers.cardLayer.removeAll(true);
    this.layers.hudLayer.removeAll(true);
    this.layers.handLayer.removeAll(true);
    this.layers.buttonLayer.removeAll(true);
    this.highlightGraphics.clear();
    this.attackDragPreview = null;

    this.addTopHud();
    this.addBoard();
    this.addFieldSlots();
    this.addPileSlots();
    this.addBattlefieldCards();
    this.addHandDeckContainer();
    this.addUtilityButtons();
    this.addStatusText();
    this.redrawHighlight();
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

  private addTopHud(): void {
    this.addInfoPanel({ x: 44, y: 52, width: 320, height: 138 }, [
      `ENEMY ${this.runtime.enemy.leader.card.definition.name}`,
      `HP ${getEffectiveHp(this.runtime, this.runtime.enemy.leader)}  ATK ${getEffectiveAttack(
        this.runtime,
        this.runtime.enemy.leader,
      )}`,
      `Deck ${this.runtime.enemy.deck.length}  Drop ${this.runtime.enemy.drop.length}`,
    ]);
    this.addInfoPanel({ x: 440, y: 52, width: 320, height: 138 }, [
      `${formatSideLabel(this.runtime.currentSide)} TURN`,
      `Round ${this.runtime.turnNumber}`,
      this.runtime.outcome
        ? `${formatSideLabel(this.runtime.outcome.winner)} WINS`
        : this.runtime.phase,
    ]);
    this.addInfoPanel({ x: 836, y: 52, width: 320, height: 138 }, [
      `PLAYER ${this.runtime.player.leader.card.definition.name}`,
      `HP ${getEffectiveHp(this.runtime, this.runtime.player.leader)}  ATK ${getEffectiveAttack(
        this.runtime,
        this.runtime.player.leader,
      )}`,
      `Deck ${this.runtime.player.deck.length}  Hand ${this.runtime.player.hand.length}`,
    ]);
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

    const ys = [rect.y + 28, rect.y + 68, rect.y + 108] as const;
    const sizes = ['18px', '24px', '17px'] as const;
    const colors = ['#a8c7af', '#fff7d2', '#d5e7d1'] as const;
    for (let index = 0; index < lines.length; index += 1) {
      this.layers.hudLayer.add(
        this.add
          .text(rect.x + rect.width / 2, ys[index]!, lines[index]!, {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: sizes[index]!,
            color: colors[index]!,
            align: 'center',
            wordWrap: { width: rect.width - 28 },
          })
          .setOrigin(0.5),
      );
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
      GAME_WIDTH / 2,
      (SLOT_ROWS.enemyFront + SLOT_ROWS.playerFront) / 2,
      BOARD_RECT.width - 48,
      3,
      0xcde7cb,
      0.35,
    );
    this.layers.boardLayer.add(divider);

    this.layers.boardLayer.add(
      this.add
        .text(GAME_WIDTH / 2, BOARD_RECT.y + 34, 'BATTLEFIELD', {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '24px',
          color: '#9fd2ba',
          align: 'center',
        })
        .setOrigin(0.5)
        .setAlpha(0.78),
    );
  }

  private addFieldSlots(): void {
    for (const slotId of SLOT_ORDER) {
      this.addSlotRect(slotId, FIELD_SLOT_RECTS[slotId], formatSlotLabel(slotId));
    }
  }

  private addSlotRect(slotId: BattleSlotId, rect: Rect, label: string): void {
    const slot = this.add.rectangle(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width,
      rect.height,
      0x173b34,
      0.58,
    );
    slot.setStrokeStyle(
      slotId.endsWith(':BC') ? 3 : 2,
      slotId.endsWith(':BC') ? 0xffe4a8 : 0x93b9a9,
      slotId.endsWith(':BC') ? 0.84 : 0.56,
    );
    slot.setInteractive({ useHandCursor: true });
    slot.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.selectSlot(slotId);
    });
    this.layers.boardLayer.add(slot);

    this.layers.boardLayer.add(
      this.add
        .text(rect.x + 10, rect.y + 14, label, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#a9c9b6',
          align: 'left',
        })
        .setOrigin(0, 0.5)
        .setAlpha(0.84),
    );
  }

  private addPileSlots(): void {
    this.addPilePanel(PILE_RECTS.enemyDrop, `Enemy Drop\n${this.runtime.enemy.drop.length}`);
    this.addDeckPilePanel(PILE_RECTS.enemyDeck, 'Enemy Deck', this.runtime.enemy.deck.length);
    this.addPilePanel(PILE_RECTS.enemyExile, `Enemy Exile\n${this.runtime.enemy.exile.length}`);
    this.addPilePanel(PILE_RECTS.playerDrop, `Player Drop\n${this.runtime.player.drop.length}`);
    this.addDeckPilePanel(PILE_RECTS.playerDeck, 'Player Deck', this.runtime.player.deck.length);
    this.addPilePanel(PILE_RECTS.playerExile, `Player Exile\n${this.runtime.player.exile.length}`);
  }

  private addPilePanel(rect: Rect, label: string): void {
    const panel = this.add.rectangle(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width,
      rect.height,
      0x14231f,
      0.9,
    );
    panel.setStrokeStyle(2, 0x91ab9f, 0.58);
    this.layers.boardLayer.add(panel);
    this.layers.boardLayer.add(
      this.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2, label, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#d9ead9',
          align: 'center',
        })
        .setOrigin(0.5),
    );
  }

  private addDeckPilePanel(rect: Rect, label: string, cardCount: number): void {
    if (cardCount <= 0 || !this.textures.exists(CARD_BACK_TEXTURE_KEY)) {
      this.addPilePanel(rect, `${label}\n${cardCount}`);
      return;
    }

    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const panel = this.add.rectangle(centerX, centerY, rect.width, rect.height, 0x14231f, 0.9);
    panel.setStrokeStyle(2, 0x91ab9f, 0.58);
    this.layers.boardLayer.add(panel);
    this.layers.boardLayer.add(
      this.add
        .image(centerX, centerY, CARD_BACK_TEXTURE_KEY)
        .setDisplaySize(rect.width - 14, rect.height - 20)
        .setAlpha(0.96),
    );
    this.layers.boardLayer.add(
      this.add
        .text(centerX, rect.y + rect.height - 28, `${label} ${cardCount}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#f8ffe9',
          stroke: '#111b18',
          strokeThickness: 4,
          align: 'center',
        })
        .setOrigin(0.5),
    );
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
          cardViewOptions.onAttackDragStart = (_pointer, dragX, dragY) =>
            this.startAttackDrag(card, dragX, dragY);
          cardViewOptions.onAttackDrag = (_pointer, dragX, dragY) => {
            this.updateAttackDragPreview(dragX, dragY);
          };
          cardViewOptions.onAttackDragEnd = (pointer) => {
            this.finishAttackDrag(pointer.worldX, pointer.worldY);
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
        draggable: options.onAttackDragStart !== undefined,
      });
      hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, options.onClick);
      if (options.onAttackDragStart) {
        let isAttackDragActive = false;
        hitArea.on(
          Phaser.Input.Events.GAMEOBJECT_DRAG_START,
          (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            isAttackDragActive = options.onAttackDragStart?.(pointer, dragX, dragY) ?? false;
          },
        );
        hitArea.on(
          Phaser.Input.Events.GAMEOBJECT_DRAG,
          (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            if (isAttackDragActive) {
              options.onAttackDrag?.(pointer, dragX, dragY);
            }
          },
        );
        hitArea.on(
          Phaser.Input.Events.GAMEOBJECT_DRAG_END,
          (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            if (isAttackDragActive) {
              options.onAttackDragEnd?.(pointer, dragX, dragY);
            }
            isAttackDragActive = false;
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

  private addHandDeckContainer(): void {
    const hiddenY = HAND_RECT.y + HAND_RECT.height - 42;
    const container = this.add.container(HAND_RECT.x + HAND_RECT.width / 2, hiddenY);
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
    const y = 146;

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
    const expandedY = HAND_RECT.y + 42;
    const hiddenY = HAND_RECT.y + HAND_RECT.height - 42;
    this.moveHandDeckContainer(
      isPointerInHandDeckHoverArea(pointer, expandedY, hiddenY) ? expandedY : hiddenY,
    );
  }

  private addUtilityButtons(): void {
    createMenuButton(this, {
      x: 82,
      y: 1710,
      width: 132,
      height: 52,
      label: 'Back',
      enabled: true,
      parent: this.layers.buttonLayer,
      onClick: () => {
        this.scene.start('SaveSlotScene');
      },
    });
    createMenuButton(this, {
      x: 82,
      y: 1778,
      width: 132,
      height: 52,
      label: 'Save',
      enabled: true,
      parent: this.layers.buttonLayer,
      onClick: () => {
        void this.saveCurrentSession();
      },
    });
    createMenuButton(this, {
      x: 82,
      y: 1846,
      width: 132,
      height: 52,
      label: 'Auto',
      enabled: false,
      parent: this.layers.buttonLayer,
    });
    createMenuButton(this, {
      x: 1110,
      y: 1744,
      width: 152,
      height: 58,
      label: 'Turn End',
      enabled: this.isPlayerControlActive(),
      parent: this.layers.buttonLayer,
      onClick: () => {
        this.endCurrentTurn();
      },
    });
    createMenuButton(this, {
      x: 1110,
      y: 1818,
      width: 152,
      height: 52,
      label: 'Skill',
      enabled: this.canStartActiveSkillTargeting(),
      parent: this.layers.buttonLayer,
      onClick: () => {
        this.startActiveSkillTargeting();
      },
    });

    if (this.selection?.kind === 'BLOCK_DECISION') {
      this.addBlockDecisionButtons();
    }
  }

  private addBlockDecisionButtons(): void {
    createMenuButton(this, {
      x: 500,
      y: 1468,
      width: 150,
      height: 56,
      label: 'Block',
      enabled: !this.isAnimatingBattleEvents,
      parent: this.layers.buttonLayer,
      onClick: () => {
        this.resolveBlockDecision(true);
      },
    });
    createMenuButton(this, {
      x: 700,
      y: 1468,
      width: 170,
      height: 56,
      label: 'No Block',
      enabled: !this.isAnimatingBattleEvents,
      parent: this.layers.buttonLayer,
      onClick: () => {
        this.resolveBlockDecision(false);
      },
    });
  }

  private addStatusText(): void {
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 1408, this.statusMessage, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '22px',
        color: '#c7d7ca',
        align: 'center',
        wordWrap: { width: 920 },
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
    this.layers.hudLayer.add(this.statusText);
  }

  private canStartActiveSkillTargeting(): boolean {
    return (
      this.isPlayerControlActive() &&
      this.selection?.kind === 'FIELD_CARD' &&
      this.selection.activeSkillGroups.length > 0
    );
  }

  private startActiveSkillTargeting(): void {
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

    if (this.runtime.phase === 'GAME_OVER') {
      this.setStatus('Battle is over.');
      return;
    }

    if (this.selection?.kind === 'BLOCK_DECISION') {
      this.setStatus('Choose Block or No Block.');
      return;
    }

    if (this.selection?.kind === 'ATTACK_DRAG') {
      this.setStatus('Drop the card on a red target to attack.');
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
        const popupEvent = this.createActionPopupEvent(this.runtime.currentSide, moveAction);
        applyMoveAction(this.runtime, moveAction);
        this.finishBattleAction(
          `Moved ${this.getCardName(moveAction.cardInstanceId)} to ${slotId}.`,
          [popupEvent],
        );
        return;
      }

      if (this.selection.attackActions.some((candidate) => candidate.toSlotId === slotId)) {
        this.setStatus('Attack uses drag and drop. Drag the selected card onto the target.');
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
    this.setStatus(`Selected ${slotId}`);
  }

  private selectHandCard(card: BattleCardRuntimeState): void {
    if (this.isAnimatingBattleEvents) {
      return;
    }

    if (this.selection?.kind === 'BLOCK_DECISION') {
      this.setStatus('Choose Block or No Block.');
      return;
    }

    if (this.selection?.kind === 'ATTACK_DRAG') {
      this.setStatus('Drop the card on a red target to attack.');
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
    this.setStatus(`Select a green slot to place ${card.card.instance.name}.`);
  }

  private selectBattlefieldCard(card: BattleCardRuntimeState): void {
    if (this.isAnimatingBattleEvents) {
      return;
    }

    if (this.selection?.kind === 'BLOCK_DECISION') {
      this.setStatus('Choose Block or No Block.');
      return;
    }

    if (this.selection?.kind === 'ATTACK_DRAG') {
      this.setStatus('Drop the card on a red target to attack.');
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

  private startAttackDrag(card: BattleCardRuntimeState, x: number, y: number): boolean {
    if (
      !this.isPlayerControlActive() ||
      this.selection?.kind === 'ACTIVE_SKILL' ||
      this.selection?.kind === 'BLOCK_DECISION' ||
      card.side !== this.runtime.currentSide ||
      card.battlefieldSlot === null
    ) {
      return false;
    }

    const attackActions = listAttackActions(this.runtime).filter(
      (action) => action.attackerInstanceId === card.card.instance.instanceId,
    );
    if (attackActions.length === 0) {
      return false;
    }

    this.destroyAttackDragPreview();
    this.selection = {
      kind: 'ATTACK_DRAG',
      cardInstanceId: card.card.instance.instanceId,
      sourceSlotId: card.battlefieldSlot,
      attackActions,
    };
    this.selectedSlotId = null;
    this.createAttackDragPreview(card, x, y);
    this.redrawHighlight();
    this.setStatus(`Drop ${card.card.instance.name} on a red target to attack.`);
    return true;
  }

  private updateAttackDragPreview(x: number, y: number): void {
    if (!this.attackDragPreview) {
      return;
    }

    this.attackDragPreview.setPosition(x, y);
  }

  private finishAttackDrag(x: number, y: number): void {
    if (this.selection?.kind !== 'ATTACK_DRAG') {
      this.destroyAttackDragPreview();
      return;
    }

    const selection = this.selection;
    this.destroyAttackDragPreview();
    const targetSlotId = this.findFieldSlotAtPoint(x, y);
    const attackAction =
      targetSlotId === null
        ? null
        : (selection.attackActions.find((candidate) => candidate.toSlotId === targetSlotId) ??
          null);
    if (!attackAction) {
      this.selection = null;
      this.selectedSlotId = null;
      this.redrawHighlight();
      this.setStatus('Attack canceled. Drop the card on a red target to attack.');
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

  private createAttackDragPreview(card: BattleCardRuntimeState, x: number, y: number): void {
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
    border.setStrokeStyle(4, ATTACK_HIGHLIGHT_COLOR, 0.94);
    container.add(border);
    this.layers.effectLayer.add(container);
    this.attackDragPreview = container;
  }

  private destroyAttackDragPreview(): void {
    this.attackDragPreview?.destroy();
    this.attackDragPreview = null;
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

    if (this.selection?.kind === 'ATTACK_DRAG') {
      this.drawSlotHighlight(this.selection.sourceSlotId, SELECTED_HIGHLIGHT_COLOR, 0.98);
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
    if (!this.isPlayerControlActive()) {
      return;
    }

    const flow = this.settleTurnFlow(applyTurnEnd(this.runtime, 'MANUAL'));
    this.commitBattleStateUpdate(flow.messages, flow.popupEvents, {
      selection: flow.pendingBlockSelection,
    });
  }

  private resolveBlockDecision(useBlock: boolean): void {
    if (this.isAnimatingBattleEvents || this.selection?.kind !== 'BLOCK_DECISION') {
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
      popupEvents.push(this.createActionPopupEvent(this.runtime.currentSide, selection.attackAction));
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
 * 중심 좌표와 2:3 슬롯 크기를 Phaser rectangle 배치에 쓰는 좌상단 rect로 변환한다.
 */
function createCenteredRect(x: number, y: number, width: number, height: number): Rect {
  return {
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
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
    moveActions.length > 0 ? 'blue move slot' : null,
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
