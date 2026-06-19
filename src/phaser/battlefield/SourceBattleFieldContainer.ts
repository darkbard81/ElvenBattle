import Phaser from 'phaser';
import type {
  BattleCardRuntimeState,
  BattleRuntimeState,
  BattleSlotId,
} from '../../game/battle/types';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import {
  FIELD_COLUMN_COUNT,
  FIELD_ROW_COUNT,
  PERSPECTIVE_SLOT_ROWS,
  type FieldRect,
} from './fieldHomography';

export const SOURCE_FIELD_WIDTH = 760;
export const SOURCE_FIELD_HEIGHT = 520;

export const SOURCE_FIELD_RECT = {
  x: 0,
  y: 0,
  width: SOURCE_FIELD_WIDTH,
  height: SOURCE_FIELD_HEIGHT,
} as const satisfies FieldRect;

type SourceBattleFieldContainerOptions = {
  runtime: BattleRuntimeState;
};

/**
 * warp 전에 캡처할 직사각형 배틀필드 원본을 구성한다.
 * 이 컨테이너는 화면에 직접 표시하지 않고 DynamicTexture 캡처 대상으로만 사용한다.
 */
export class SourceBattleFieldContainer {
  private readonly scene: Phaser.Scene;
  private readonly runtime: BattleRuntimeState;
  private readonly root: Phaser.GameObjects.Container;
  private readonly highlightGraphics: Phaser.GameObjects.Graphics;
  private selectedSlotId: BattleSlotId | null = null;

  constructor(scene: Phaser.Scene, options: SourceBattleFieldContainerOptions) {
    this.scene = scene;
    this.runtime = options.runtime;
    this.root = scene.add.container(0, 0);
    this.root.removeFromDisplayList();

    this.addFieldBase();
    this.addSlotGrid();
    this.addBattlefieldCards();

    this.highlightGraphics = scene.add.graphics();
    this.root.add(this.highlightGraphics);
  }

  /**
   * DynamicTexture가 그릴 원본 Phaser 컨테이너를 반환한다.
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.root;
  }

  /**
   * 선택 슬롯 하이라이트를 source field에 반영한다.
   * 변경된 하이라이트는 다음 capture redraw 때 warp texture에 포함된다.
   */
  selectSlot(slotId: BattleSlotId | null): void {
    this.selectedSlotId = slotId;
    this.redrawHighlight();
  }

  /**
   * source field의 모든 Phaser GameObject를 해제한다.
   */
  destroy(): void {
    this.root.destroy(true);
  }

  private addFieldBase(): void {
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x0a1b22, 0.96);
    graphics.fillRect(0, 0, SOURCE_FIELD_WIDTH, SOURCE_FIELD_HEIGHT);
    graphics.fillStyle(0x103a38, 0.84);
    graphics.fillRect(14, 14, SOURCE_FIELD_WIDTH - 28, SOURCE_FIELD_HEIGHT - 28);
    graphics.lineStyle(6, 0x89e7f1, 0.58);
    graphics.strokeRect(4, 4, SOURCE_FIELD_WIDTH - 8, SOURCE_FIELD_HEIGHT - 8);
    graphics.lineStyle(2, 0xc8f7ef, 0.28);

    for (let col = 1; col < FIELD_COLUMN_COUNT; col += 1) {
      const x = (SOURCE_FIELD_WIDTH / FIELD_COLUMN_COUNT) * col;
      graphics.lineBetween(x, 20, x, SOURCE_FIELD_HEIGHT - 20);
    }

    for (let row = 1; row < FIELD_ROW_COUNT; row += 1) {
      const y = (SOURCE_FIELD_HEIGHT / FIELD_ROW_COUNT) * row;
      graphics.lineBetween(20, y, SOURCE_FIELD_WIDTH - 20, y);
    }

    this.root.add(graphics);
  }

  private addSlotGrid(): void {
    const slotCards = createBattlefieldSlotMap(this.runtime.battlefield);

    for (const row of PERSPECTIVE_SLOT_ROWS) {
      for (const slotId of row) {
        const rect = sourceSlotRect(slotId);
        const hasCard = slotCards.has(slotId);
        const slot = this.scene.add.rectangle(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          rect.width,
          rect.height,
          hasCard ? 0x1b5147 : 0x183837,
          hasCard ? 0.56 : 0.38,
        );
        slot.setStrokeStyle(2, hasCard ? 0xd1fff2 : 0x71918c, hasCard ? 0.76 : 0.48);
        this.root.add(slot);

        const label = this.scene.add
          .text(rect.x + 14, rect.y + 16, formatSlotLabel(slotId), {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '18px',
            fontStyle: '700',
            color: hasCard ? '#dfffee' : '#83a4a0',
            stroke: '#071018',
            strokeThickness: 3,
            align: 'left',
          })
          .setOrigin(0, 0.5)
          .setAlpha(hasCard ? 0.96 : 0.82);
        this.root.add(label);
      }
    }
  }

  private addBattlefieldCards(): void {
    const slotCards = createBattlefieldSlotMap(this.runtime.battlefield);

    for (const row of PERSPECTIVE_SLOT_ROWS) {
      for (const slotId of row) {
        const card = slotCards.get(slotId) ?? null;
        if (card) {
          this.addBattlefieldCard(slotId, card);
        }
      }
    }
  }

  private addBattlefieldCard(slotId: BattleSlotId, card: BattleCardRuntimeState): void {
    const rect = sourceSlotRect(slotId);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2 + 4;
    const cardWidth = 104;
    const cardHeight = 116;
    const textureKey = `cards.webp.${card.card.definition.id}`;

    if (this.scene.textures.exists(textureKey)) {
      const image = this.scene.add.image(centerX, centerY, textureKey);
      image.setDisplaySize(cardWidth, cardHeight);
      this.root.add(image);
    } else {
      const fallback = this.scene.add.rectangle(
        centerX,
        centerY,
        cardWidth,
        cardHeight,
        card.side === 'enemy' ? 0x42233c : 0x1c4238,
        0.98,
      );
      fallback.setStrokeStyle(2, 0xf6ffe3, 0.86);
      this.root.add(fallback);
    }

    this.root.add(
      this.scene.add
        .text(centerX, centerY + 30, card.card.definition.name, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '14px',
          color: '#fff9dc',
          stroke: '#06100d',
          strokeThickness: 4,
          align: 'center',
          wordWrap: { width: cardWidth + 42 },
        })
        .setOrigin(0.5),
    );

    this.root.add(
      this.scene.add
        .text(
          centerX,
          centerY + 49,
          `HP ${card.card.instance.currentHp} / ATK ${card.card.instance.currentAttack}`,
          {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '12px',
            color: '#e3f7df',
            stroke: '#06100d',
            strokeThickness: 3,
            align: 'center',
          },
        )
        .setOrigin(0.5),
    );
  }

  private redrawHighlight(): void {
    this.highlightGraphics.clear();

    if (!this.selectedSlotId) {
      return;
    }

    const rect = sourceSlotRect(this.selectedSlotId);
    this.highlightGraphics.lineStyle(6, 0xfff1a3, 0.98);
    this.highlightGraphics.strokeRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6);
    this.highlightGraphics.lineStyle(2, 0xffffff, 0.72);
    this.highlightGraphics.strokeRect(rect.x + 10, rect.y + 10, rect.width - 20, rect.height - 20);
  }
}

function sourceSlotRect(slotId: BattleSlotId): FieldRect {
  const position = findSlotPosition(slotId);
  const gapX = 18;
  const gapY = 12;
  const cellWidth = SOURCE_FIELD_WIDTH / FIELD_COLUMN_COUNT;
  const cellHeight = SOURCE_FIELD_HEIGHT / FIELD_ROW_COUNT;

  return {
    x: position.col * cellWidth + gapX,
    y: position.row * cellHeight + gapY,
    width: cellWidth - gapX * 2,
    height: cellHeight - gapY * 2,
  };
}

function createBattlefieldSlotMap(
  cards: BattleCardRuntimeState[],
): Map<BattleSlotId, BattleCardRuntimeState> {
  const slotCards = new Map<BattleSlotId, BattleCardRuntimeState>();

  cards.forEach((card) => {
    if (card.battlefieldSlot) {
      slotCards.set(card.battlefieldSlot, card);
    }
  });

  return slotCards;
}

function formatSlotLabel(slotId: BattleSlotId): string {
  const [side, zone] = slotId.split(':') as ['player' | 'enemy', string];
  return `${side === 'enemy' ? 'E' : 'P'}${zone}`;
}

function findSlotPosition(slotId: BattleSlotId): { row: number; col: number } {
  for (let row = 0; row < PERSPECTIVE_SLOT_ROWS.length; row += 1) {
    const rowSlots = PERSPECTIVE_SLOT_ROWS[row] as readonly BattleSlotId[];
    const col = rowSlots.indexOf(slotId);
    if (col >= 0) {
      return { row, col };
    }
  }

  throw new Error(`Unknown battle slot id: ${slotId}`);
}
