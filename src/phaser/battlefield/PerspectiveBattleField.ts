import Phaser from 'phaser';
import type {
  BattleCardRuntimeState,
  BattleRuntimeState,
  BattleSlotId,
} from '../../game/battle/types';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import {
  createFieldPointerIntent,
  PERSPECTIVE_FIELD_QUAD,
  PERSPECTIVE_SLOT_ROWS,
  slotCenter,
  slotQuad,
  type FieldPointerIntent,
  type FieldPoint,
} from './perspective-field';

type PerspectiveBattleFieldOptions = {
  runtime: BattleRuntimeState;
  onIntent: (intent: FieldPointerIntent) => void;
};

/**
 * 4행 x 3열 원근 전장을 Phaser GameObject로 표시하는 화면 전용 렌더러다.
 * 전투 규칙은 처리하지 않고, 런타임 전장 상태를 카드와 슬롯 마커로 투영하며 클릭은 intent로만 전달한다.
 */
export class PerspectiveBattleField {
  private readonly scene: Phaser.Scene;
  private readonly runtime: BattleRuntimeState;
  private readonly onIntent: (intent: FieldPointerIntent) => void;
  private readonly slotHighlights = new Map<BattleSlotId, Phaser.GameObjects.Graphics>();
  private debugText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, options: PerspectiveBattleFieldOptions) {
    this.scene = scene;
    this.runtime = options.runtime;
    this.onIntent = options.onIntent;
  }

  /**
   * 전장 배경, 슬롯 마커, 전장 카드, 입력 판정 영역을 생성한다.
   * 같은 인스턴스에서 여러 번 호출하는 용도는 아니며, Scene create lifecycle에서 한 번 호출한다.
   */
  render(): void {
    this.addFieldBase();
    this.addSlotMarkers();
    this.addBattlefieldCards();
    this.addDebugText();
    this.addInputZone();
  }

  private addFieldBase(): void {
    const quad = [
      PERSPECTIVE_FIELD_QUAD.tl,
      PERSPECTIVE_FIELD_QUAD.tr,
      PERSPECTIVE_FIELD_QUAD.br,
      PERSPECTIVE_FIELD_QUAD.bl,
    ];
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x12281f, 0.78);
    graphics.fillPoints(toVector2Points(quad), true);
    graphics.lineStyle(3, 0xbfeec5, 0.72);
    graphics.strokePoints(toVector2Points(quad), true);
  }

  private addSlotMarkers(): void {
    for (const row of PERSPECTIVE_SLOT_ROWS) {
      for (const slotId of row) {
        const quad = slotQuad(slotId);
        const center = slotCenter(slotId);
        const hasCard = this.runtime.battlefield.some((card) => card.battlefieldSlot === slotId);

        this.addSlotPolygon(slotId, quad, hasCard);
        this.addSlotLabel(slotId, center, hasCard);
      }
    }
  }

  private addSlotPolygon(slotId: BattleSlotId, quad: FieldPoint[], hasCard: boolean): void {
    const base = this.scene.add.graphics();
    base.fillStyle(hasCard ? 0x1c4635 : 0x173128, hasCard ? 0.52 : 0.36);
    base.fillPoints(toVector2Points(quad), true);
    base.lineStyle(1, hasCard ? 0xcaf3ce : 0x668074, hasCard ? 0.78 : 0.48);
    base.strokePoints(toVector2Points(quad), true);

    const highlight = this.scene.add.graphics();
    this.slotHighlights.set(slotId, highlight);
  }

  private addSlotLabel(slotId: BattleSlotId, center: FieldPoint, hasCard: boolean): void {
    this.scene.add
      .text(center.x, center.y + (hasCard ? 58 : 0), formatSlotLabel(slotId), {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '15px',
        color: hasCard ? '#d9f8d3' : '#8fa99b',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(hasCard ? 0.92 : 0.72);
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
    const center = slotCenter(slotId);
    const rowIndex = findRowIndex(slotId);
    const cardWidth = 84 + rowIndex * 8;
    const cardHeight = 116 + rowIndex * 8;
    const textureKey = `cards.webp.${card.card.definition.id}`;

    if (this.scene.textures.exists(textureKey)) {
      const image = this.scene.add.image(center.x, center.y - 8, textureKey);
      image.setDisplaySize(cardWidth, cardHeight);
      image.setDepth(5 + rowIndex);
    } else {
      const fallback = this.scene.add.rectangle(
        center.x,
        center.y - 8,
        cardWidth,
        cardHeight,
        card.side === 'enemy' ? 0x412334 : 0x1c3c2f,
        0.96,
      );
      fallback.setStrokeStyle(2, 0xf0f7d6, 0.84);
      fallback.setDepth(5 + rowIndex);
    }

    this.scene.add
      .text(center.x, center.y + cardHeight / 2 - 28, card.card.definition.name, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '14px',
        color: '#fff8df',
        stroke: '#0c1411',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: cardWidth + 34 },
      })
      .setOrigin(0.5)
      .setDepth(12 + rowIndex);

    this.scene.add
      .text(
        center.x,
        center.y + cardHeight / 2 - 9,
        `HP ${card.card.instance.currentHp} / ATK ${card.card.instance.currentAttack}`,
        {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '12px',
          color: '#e2f4dc',
          stroke: '#0c1411',
          strokeThickness: 3,
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setDepth(12 + rowIndex);
  }

  private addDebugText(): void {
    this.debugText = this.scene.add
      .text(640, 628, 'Perspective field ready: select a slot', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: '#c6d7cb',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
  }

  private addInputZone(): void {
    const bounds = new Phaser.Geom.Rectangle(220, 136, 840, 486);
    const zone = this.scene.add.zone(bounds.centerX, bounds.centerY, bounds.width, bounds.height);
    zone.setInteractive();
    zone.on(
      Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,
      (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
        const point = {
          x: bounds.x + localX,
          y: bounds.y + localY,
        };
        const intent = createFieldPointerIntent(point);
        if (intent) {
          this.selectSlot(intent.slotId);
          this.onIntent(intent);
        }
      },
    );
  }

  private selectSlot(slotId: BattleSlotId): void {
    this.debugText.setText(`Selected ${slotId}`);

    for (const [candidateSlotId, graphics] of this.slotHighlights) {
      graphics.clear();
      if (candidateSlotId === slotId) {
        graphics.lineStyle(4, 0xfff0a6, 0.96);
        graphics.strokePoints(toVector2Points(slotQuad(candidateSlotId)), true);
      }
    }
  }
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

function findRowIndex(slotId: BattleSlotId): number {
  for (let rowIndex = 0; rowIndex < PERSPECTIVE_SLOT_ROWS.length; rowIndex += 1) {
    const row = PERSPECTIVE_SLOT_ROWS[rowIndex] as readonly BattleSlotId[];
    if (row.includes(slotId)) {
      return rowIndex;
    }
  }

  return 0;
}

function toVector2Points(points: readonly FieldPoint[]): Phaser.Math.Vector2[] {
  return points.map((point) => new Phaser.Math.Vector2(point.x, point.y));
}
