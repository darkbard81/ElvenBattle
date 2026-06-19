import Phaser from 'phaser';
import { createInitialBattleRuntime } from '../../game/battle/create-battle-runtime';
import {
  INITIAL_HAND_SIZE,
  type BattleCardRuntimeState,
  type BattleRuntimeState,
  type BattleSlotId,
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

const FIELD_SLOT_WIDTH = 132;
const FIELD_SLOT_HEIGHT = 198;
const HAND_CARD_WIDTH = 144;
const HAND_CARD_HEIGHT = 216;
const SLOT_COLUMNS = {
  FR: GAME_WIDTH / 2 - 170,
  FC: GAME_WIDTH / 2,
  FL: GAME_WIDTH / 2 + 170,
} as const;
const SLOT_ROWS = {
  enemyBack: 360,
  enemyFront: 590,
  playerFront: 930,
  playerBack: 1160,
} as const;
const BOARD_RECT = {
  x: 96,
  y: 244,
  width: GAME_WIDTH - 192,
  height: 1078,
} as const satisfies Rect;
const HAND_RECT = {
  x: 190,
  y: 1496,
  width: GAME_WIDTH - 380,
  height: 334,
} as const satisfies Rect;
const FIELD_SLOT_RECTS: Record<BattleSlotId, Rect> = {
  'enemy:BR': createCenteredRect(SLOT_COLUMNS.FR, SLOT_ROWS.enemyBack, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'enemy:BC': createCenteredRect(SLOT_COLUMNS.FC, SLOT_ROWS.enemyBack, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'enemy:BL': createCenteredRect(SLOT_COLUMNS.FL, SLOT_ROWS.enemyBack, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'enemy:FR': createCenteredRect(SLOT_COLUMNS.FR, SLOT_ROWS.enemyFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'enemy:FC': createCenteredRect(SLOT_COLUMNS.FC, SLOT_ROWS.enemyFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'enemy:FL': createCenteredRect(SLOT_COLUMNS.FL, SLOT_ROWS.enemyFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'player:FR': createCenteredRect(SLOT_COLUMNS.FR, SLOT_ROWS.playerFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'player:FC': createCenteredRect(SLOT_COLUMNS.FC, SLOT_ROWS.playerFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'player:FL': createCenteredRect(SLOT_COLUMNS.FL, SLOT_ROWS.playerFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'player:BR': createCenteredRect(SLOT_COLUMNS.FR, SLOT_ROWS.playerBack, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'player:BC': createCenteredRect(SLOT_COLUMNS.FC, SLOT_ROWS.playerBack, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  'player:BL': createCenteredRect(SLOT_COLUMNS.FL, SLOT_ROWS.playerBack, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
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
  enemyDrop: createCenteredRect(210, SLOT_ROWS.enemyFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  enemyDeck: createCenteredRect(990, SLOT_ROWS.enemyFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  playerDrop: createCenteredRect(210, SLOT_ROWS.playerFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
  playerDeck: createCenteredRect(990, SLOT_ROWS.playerFront, FIELD_SLOT_WIDTH, FIELD_SLOT_HEIGHT),
} as const satisfies Record<string, Rect>;

/**
 * 저장 슬롯의 전투 런타임을 1200x1920 단순 전장 레이아웃으로 표시하는 씬이다.
 * 전투 규칙은 도메인 런타임에 두고, 이 씬은 카드 슬롯, 손패, HUD와 저장 입력만 담당한다.
 */
export class BattlefieldScene extends Phaser.Scene {
  private handDeckContainer: Phaser.GameObjects.Container | null = null;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private layers!: BattlefieldSceneLayers;
  private runtime!: BattleRuntimeState;
  private session!: GameSession;
  private statusText!: Phaser.GameObjects.Text;
  private isSaving = false;
  private selectedSlotId: BattleSlotId | null = null;

  constructor() {
    super({ key: 'BattlefieldScene' });
  }

  /**
   * 초기 전투 런타임을 만들고 1200x1920 기준의 단순 슬롯 전장을 구성한다.
   */
  create(data: BattlefieldSceneData): void {
    this.session = data.session;
    this.runtime = createInitialBattleRuntime(this.session);
    this.isSaving = false;
    this.selectedSlotId = null;
    this.handDeckContainer = null;

    this.layers = this.createLayers();
    this.highlightGraphics = this.add.graphics();
    this.layers.effectLayer.add(this.highlightGraphics);

    this.addBackground();
    this.addTopHud();
    this.addBoard();
    this.addFieldSlots();
    this.addPileSlots();
    this.addBattlefieldCards();
    this.addHandDeckContainer();
    this.addUtilityButtons();
    this.addStatusText();
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
    this.addInfoPanel(
      { x: 44, y: 52, width: 320, height: 138 },
      [
        `ENEMY ${this.runtime.enemy.leader.card.definition.name}`,
        `HP ${this.runtime.enemy.leader.card.instance.currentHp}  ATK ${this.runtime.enemy.leader.card.instance.currentAttack}`,
        `Deck ${this.runtime.enemy.deck.length}  Drop ${this.runtime.enemy.drop.length}`,
      ],
    );
    this.addInfoPanel(
      { x: 440, y: 52, width: 320, height: 138 },
      ['Phase', 'Turn 01', `Slot ${this.session.slotId}`],
    );
    this.addInfoPanel(
      { x: 836, y: 52, width: 320, height: 138 },
      [
        `PLAYER ${this.runtime.player.leader.card.definition.name}`,
        `HP ${this.runtime.player.leader.card.instance.currentHp}  ATK ${this.runtime.player.leader.card.instance.currentAttack}`,
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
    this.addPilePanel(PILE_RECTS.enemyDeck, `Enemy Deck\n${this.runtime.enemy.deck.length}`);
    this.addPilePanel(PILE_RECTS.playerDrop, `Player Drop\n${this.runtime.player.drop.length}`);
    this.addPilePanel(PILE_RECTS.playerDeck, `Player Deck\n${this.runtime.player.deck.length}`);
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
        this.addCardView(this.layers.cardLayer, FIELD_SLOT_RECTS[slotId], card, 'field');
      }
    }
  }

  private addCardView(
    parent: Phaser.GameObjects.Container,
    rect: Rect,
    card: BattleCardRuntimeState,
    mode: 'field' | 'hand',
  ): void {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const textureKey = `cards.webp.${card.card.definition.id}`;

    if (this.textures.exists(textureKey)) {
      parent.add(this.add.image(centerX, centerY, textureKey).setDisplaySize(rect.width, rect.height));
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

    parent.add(
      this.add
        .text(centerX, rect.y + rect.height - (mode === 'field' ? 34 : 42), card.card.definition.name, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: mode === 'field' ? '16px' : '18px',
          color: '#fff9dc',
          stroke: '#06100d',
          strokeThickness: 4,
          align: 'center',
          wordWrap: { width: rect.width - 10 },
        })
        .setOrigin(0.5),
    );
    parent.add(
      this.add
        .text(
          centerX,
          rect.y + rect.height - (mode === 'field' ? 13 : 16),
          `HP ${card.card.instance.currentHp} / ATK ${card.card.instance.currentAttack}`,
          {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: mode === 'field' ? '13px' : '14px',
            color: '#e3f7df',
            stroke: '#06100d',
            strokeThickness: 3,
            align: 'center',
          },
        )
        .setOrigin(0.5),
    );
  }

  private addHandDeckContainer(): void {
    const hiddenY = HAND_RECT.y + HAND_RECT.height - 42;
    const expandedY = HAND_RECT.y;
    const container = this.add.container(HAND_RECT.x + HAND_RECT.width / 2, hiddenY);
    this.handDeckContainer = container;
    this.layers.handLayer.add(container);

    const panel = this.add.rectangle(0, 0, HAND_RECT.width, HAND_RECT.height, 0x10211b, 0.95).setOrigin(0.5, 0);
    panel.setStrokeStyle(2, 0xcde7cb, 0.78);
    container.add(panel);
    container.add(this.add.rectangle(0, 0, HAND_RECT.width, 46, 0x1a2f26, 0.94).setOrigin(0.5, 0));
    container.add(
      this.add
        .text(-HAND_RECT.width / 2 + 28, 24, 'HAND', {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '24px',
          color: '#a6d9b0',
          align: 'left',
        })
        .setOrigin(0, 0.5),
    );
    container.add(
      this.add
        .text(HAND_RECT.width / 2 - 28, 24, `Deck ${this.runtime.player.deck.length}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '24px',
          color: '#f5fff0',
          align: 'right',
        })
        .setOrigin(1, 0.5),
    );
    this.addHandCards(container);
    container.setSize(HAND_RECT.width, HAND_RECT.height);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-HAND_RECT.width / 2, 0, HAND_RECT.width, HAND_RECT.height),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.moveHandDeckContainer(expandedY);
    });
    container.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.moveHandDeckContainer(hiddenY);
    });
  }

  private addHandCards(container: Phaser.GameObjects.Container): void {
    const gap = 18;
    const totalWidth = HAND_CARD_WIDTH * INITIAL_HAND_SIZE + gap * (INITIAL_HAND_SIZE - 1);
    const startX = -totalWidth / 2;
    const y = 176;

    for (let index = 0; index < INITIAL_HAND_SIZE; index += 1) {
      const card = this.runtime.player.hand[index] ?? null;
      const rect = {
        x: startX + index * (HAND_CARD_WIDTH + gap),
        y: y - HAND_CARD_HEIGHT / 2,
        width: HAND_CARD_WIDTH,
        height: HAND_CARD_HEIGHT,
      };

      if (card) {
        this.addCardView(container, rect, card, 'hand');
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

    this.tweens.add({
      targets: this.handDeckContainer,
      y,
      duration: 180,
      ease: 'Sine.easeOut',
    });
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
      enabled: false,
      parent: this.layers.buttonLayer,
    });
    createMenuButton(this, {
      x: 1110,
      y: 1818,
      width: 152,
      height: 52,
      label: 'Undo',
      enabled: false,
      parent: this.layers.buttonLayer,
    });
  }

  private addStatusText(): void {
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 1408, 'Select a battlefield slot. Save writes the current slot state.', {
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

  private selectSlot(slotId: BattleSlotId): void {
    this.selectedSlotId = slotId;
    this.redrawHighlight();
    this.setStatus(`Selected ${slotId}`);
  }

  private redrawHighlight(): void {
    this.highlightGraphics.clear();
    if (!this.selectedSlotId) {
      return;
    }

    const rect = FIELD_SLOT_RECTS[this.selectedSlotId];
    this.highlightGraphics.lineStyle(6, 0xfff1a3, 0.98);
    this.highlightGraphics.strokeRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6);
    this.highlightGraphics.lineStyle(2, 0xffffff, 0.72);
    this.highlightGraphics.strokeRect(rect.x + 11, rect.y + 11, rect.width - 22, rect.height - 22);
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
    this.statusText.setText(message);
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
 * 도메인 슬롯 id를 화면 슬롯 라벨로 축약한다.
 */
function formatSlotLabel(slotId: BattleSlotId): string {
  const [side, zone] = slotId.split(':') as ['player' | 'enemy', string];
  return `${side === 'enemy' ? 'E' : 'P'}${zone}`;
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
