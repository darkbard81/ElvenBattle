import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import type { GameSession } from '../../game/save/session';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
import type { BattlefieldSceneData } from './scene-data';

/**
 * `SaveSlotScene`에서 전달받은 GameSession을 화면 뼈대로만 보여주는 전장 씬이다.
 * 전투 규칙과 상호작용은 두지 않고, 리더와 배치 영역의 자리만 표시한다.
 */
export class BattlefieldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattlefieldScene' });
  }

  /**
   * 세션 요약 레이아웃과 돌아가기 버튼을 구성한다.
   */
  create(data: BattlefieldSceneData): void {
    this.addBackground();
    this.addTitle();
    this.addBattlefieldLayout(data.session);
    this.addBackButton();
  }

  private addBackground(): void {
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.58).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.16).setOrigin(0, 0);
  }

  private addTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, 110, 'BATTLEFIELD', {
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
      .text(GAME_WIDTH / 2, 172, 'session handoff verified', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
  }

  private addBattlefieldLayout(session: GameSession): void {
    this.addLeaderArea(session);
    this.addDeckArea(session);
    this.addHandArea();
    this.addBattlefieldGrid();
    this.addSessionFooter(session);
  }

  private addBackButton(): void {
    createMenuButton(this, {
      x: 160,
      y: 86,
      width: 180,
      height: 58,
      label: 'Back',
      enabled: true,
      onClick: () => {
        this.scene.start('SaveSlotScene');
      },
    });
  }

  private addLeaderArea(session: GameSession): void {
    const x = 322;
    const y = 286;
    this.add.rectangle(x, y, 560, 150, 0x12211c, 0.96).setStrokeStyle(2, 0xbfeec5, 0.92);

    this.add
      .text(x - 236, y - 58, 'LEADER', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '22px',
        color: '#a6d9b0',
        align: 'left',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(x - 236, y - 22, session.deck.leader.definition.name, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '30px',
        color: '#f5fff0',
        align: 'left',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(
        x - 236,
        y + 18,
        `HP ${session.deck.leader.instance.currentHp}  |  ATK ${session.deck.leader.instance.currentAttack}`,
        {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: '#d7ead4',
          align: 'left',
        },
      )
      .setOrigin(0, 0.5);

    this.add
      .text(x - 236, y + 56, `Slot ${session.slotId}  |  ${session.saveName}`, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: '#b7c9ba',
        align: 'left',
      })
      .setOrigin(0, 0.5);
  }

  private addDeckArea(session: GameSession): void {
    const x = 995;
    const y = 286;
    this.add.rectangle(x, y, 210, 150, 0x12211c, 0.96).setStrokeStyle(2, 0xbfeec5, 0.92);

    this.add
      .text(x, y - 36, 'DECK', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '22px',
        color: '#a6d9b0',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(x, y + 6, `${session.deck.cards.length}`, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '60px',
        color: '#f5fff0',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(x, y + 56, 'cards remaining', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: '#b7c9ba',
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private addHandArea(): void {
    const x = GAME_WIDTH / 2;
    const y = 520;
    this.add.rectangle(x, y, 1060, 150, 0x10211b, 0.9).setStrokeStyle(2, 0x7fa38a, 0.7);

    this.add
      .text(x - 498, y - 48, 'HAND', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '22px',
        color: '#a6d9b0',
        align: 'left',
      })
      .setOrigin(0, 0.5);

    const slotWidth = 176;
    const slotHeight = 84;
    const gap = 18;
    const totalWidth = slotWidth * 5 + gap * 4;
    const startX = x - totalWidth / 2 + slotWidth / 2;

    for (let index = 0; index < 5; index += 1) {
      const slotX = startX + index * (slotWidth + gap);
      const slot = this.add.rectangle(slotX, y + 6, slotWidth, slotHeight, 0x162b24, 0.96);
      slot.setStrokeStyle(2, 0x4e5d57, 0.9);

      this.add
        .text(slotX, y + 0, 'EMPTY', {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '18px',
          color: '#8e9a95',
          align: 'center',
        })
        .setOrigin(0.5);
    }
  }

  private addBattlefieldGrid(): void {
    const x = GAME_WIDTH / 2;
    const y = 664;
    this.add.rectangle(x, y, 1060, 150, 0x10211b, 0.9).setStrokeStyle(2, 0x7fa38a, 0.7);

    this.add
      .text(x - 498, y - 48, 'BATTLEFIELD', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '22px',
        color: '#a6d9b0',
        align: 'left',
      })
      .setOrigin(0, 0.5);

    const cols = 4;
    const rows = 2;
    const cellWidth = 220;
    const cellHeight = 42;
    const gapX = 18;
    const gapY = 12;
    const totalWidth = cols * cellWidth + (cols - 1) * gapX;
    const totalHeight = rows * cellHeight + (rows - 1) * gapY;
    const startX = x - totalWidth / 2 + cellWidth / 2;
    const startY = y - totalHeight / 2 + cellHeight / 2 + 12;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cellX = startX + col * (cellWidth + gapX);
        const cellY = startY + row * (cellHeight + gapY);
        this.add.rectangle(cellX, cellY, cellWidth, cellHeight, 0x162b24, 0.9).setStrokeStyle(
          2,
          0x4e5d57,
          0.85,
        );
      }
    }
  }

  private addSessionFooter(session: GameSession): void {
    this.add
      .text(
        GAME_WIDTH / 2,
        744,
        `Loaded slot ${session.slotId}. Battlefield is a static layout only, with no card placement or combat rules.`,
        {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '16px',
          color: '#b7c9ba',
          align: 'center',
          wordWrap: { width: 920 },
        },
      )
      .setOrigin(0.5);
  }
}
