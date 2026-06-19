import Phaser from 'phaser';
import { createInitialBattleRuntime } from '../../game/battle/create-battle-runtime';
import {
  INITIAL_HAND_SIZE,
  type BattleCardRuntimeState,
  type BattleRuntimeState,
} from '../../game/battle/types';
import { fetchSaveSlot, saveSlotState } from '../../game/save/client-api';
import {
  createGameSession,
  createSaveSlotStateFromGameSession,
  type GameSession,
} from '../../game/save/session';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { PerspectiveBattleField } from '../battlefield/PerspectiveBattleField';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
import type { BattlefieldSceneData } from './scene-data';

/**
 * 저장 슬롯에서 전달받은 GameSession을 전투 런타임 Zone으로 변환해 표시하는 전장 씬이다.
 * 전투 규칙과 카드 조작은 구현하지 않고, HUD, 전장 슬롯, 손패/덱 영역의 기본 배치를 담당한다.
 */
export class BattlefieldScene extends Phaser.Scene {
  private handDeckContainer: Phaser.GameObjects.Container | null = null;
  private session!: GameSession;
  private statusText!: Phaser.GameObjects.Text;
  private isSaving = false;

  constructor() {
    super({ key: 'BattlefieldScene' });
  }

  /**
   * 초기 전투 런타임을 만들고 세 영역의 전장 화면과 뒤로 가기 버튼을 구성한다.
   */
  create(data: BattlefieldSceneData): void {
    this.session = data.session;
    this.isSaving = false;
    this.handDeckContainer = null;
    const runtime = createInitialBattleRuntime(this.session);

    this.addBackground();
    this.addTitle();
    this.addStatusText();
    this.addBattlefieldLayout(this.session, runtime);
    this.addBackButton();
    this.addSaveButton();
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
      .text(GAME_WIDTH / 2, 58, 'BATTLEFIELD', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '44px',
        fontStyle: '700',
        color: '#f5faf0',
        stroke: '#182e27',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private addBattlefieldLayout(session: GameSession, runtime: BattleRuntimeState): void {
    this.addHudContainer(session, runtime);
    new PerspectiveBattleField(this, {
      runtime,
      onIntent: (intent) => {
        this.setStatus(`Selected ${intent.slotId}`);
      },
    }).render();
    this.addHandDeckContainer(runtime.player);
  }

  private addBackButton(): void {
    createMenuButton(this, {
      x: 146,
      y: 64,
      width: 154,
      height: 52,
      label: 'Back',
      enabled: true,
      onClick: () => {
        this.scene.start('SaveSlotScene');
      },
    });
  }

  private addSaveButton(): void {
    createMenuButton(this, {
      x: GAME_WIDTH - 146,
      y: 64,
      width: 154,
      height: 52,
      label: 'Save',
      enabled: true,
      onClick: () => {
        void this.saveCurrentSession();
      },
    });
  }

  private addStatusText(): void {
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 104, 'Back returns to the save slots without saving.', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '18px',
        color: '#d9ebd1',
        align: 'center',
        wordWrap: { width: 720 },
      })
      .setOrigin(0.5)
      .setAlpha(0.92);
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

  private addHudContainer(session: GameSession, runtime: BattleRuntimeState): void {
    const container = this.add.container(GAME_WIDTH / 2, 126);
    const panel = this.add.rectangle(0, 0, 980, 34, 0x12211c, 0.88);
    panel.setStrokeStyle(2, 0x7fa38a, 0.74);
    container.add(panel);

    container.add(
      this.add
        .text(-456, 0, `Slot ${session.slotId} | ${session.saveName}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '16px',
          color: '#b7c9ba',
          align: 'left',
        })
        .setOrigin(0, 0.5),
    );

    container.add(
      this.add
        .text(-162, 0, `Leader ${runtime.player.leader.card.definition.name}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '17px',
          color: '#f5fff0',
          align: 'left',
        })
        .setOrigin(0, 0.5),
    );

    container.add(
      this.add
        .text(168, 0, `Deck ${runtime.player.deck.length}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '18px',
          color: '#f5fff0',
          align: 'center',
        })
        .setOrigin(0.5),
    );

    container.add(
      this.add
        .text(286, 0, `Hand ${runtime.player.hand.length}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '18px',
          color: '#f5fff0',
          align: 'center',
        })
        .setOrigin(0.5),
    );

    container.add(
      this.add
        .text(
          418,
          0,
          `HP ${runtime.player.leader.card.instance.currentHp} / ATK ${runtime.player.leader.card.instance.currentAttack}`,
          {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '17px',
            color: '#d7ead4',
            align: 'center',
          },
        )
        .setOrigin(0.5),
    );
  }

  private addHandDeckContainer(runtime: BattleRuntimeState['player']): void {
    const hiddenY = 735;
    const expandedY = 650;
    const width = 1120;
    const height = 150;
    const container = this.add.container(GAME_WIDTH / 2, hiddenY);
    this.handDeckContainer = container;

    const panel = this.add.rectangle(0, 0, width, height, 0x10211b, 0.96).setOrigin(0.5, 0);
    panel.setStrokeStyle(2, 0xbfeec5, 0.82);
    container.add(panel);

    container.add(
      this.add
        .text(-520, 25, 'HAND', {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: '#a6d9b0',
          align: 'left',
        })
        .setOrigin(0, 0.5),
    );

    container.add(
      this.add
        .text(446, 25, `Deck ${runtime.deck.length}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '24px',
          color: '#f5fff0',
          align: 'right',
        })
        .setOrigin(0, 0.5),
    );

    this.addHandCards(container, runtime.hand);
    container.setSize(width, height);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, 0, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.moveHandDeckContainer(expandedY);
    });
    container.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.moveHandDeckContainer(hiddenY);
    });
  }

  private addHandCards(
    container: Phaser.GameObjects.Container,
    hand: BattleCardRuntimeState[],
  ): void {
    const cardWidth = 184;
    const cardHeight = 122;
    const gap = 20;
    const totalWidth = cardWidth * INITIAL_HAND_SIZE + gap * (INITIAL_HAND_SIZE - 1);
    const startX = -totalWidth / 2 + cardWidth / 2;
    const y = 92;

    for (let index = 0; index < INITIAL_HAND_SIZE; index += 1) {
      const card = hand[index] ?? null;
      const x = startX + index * (cardWidth + gap);
      const background = this.add.rectangle(x, y, cardWidth, cardHeight, 0x162b24, 0.96);
      background.setStrokeStyle(2, card ? 0x7fa38a : 0x4e5d57, card ? 0.9 : 0.74);
      container.add(background);

      const label = card ? card.card.definition.name : 'EMPTY';
      const labelColor = card ? '#f5fff0' : '#8e9a95';
      container.add(
        this.add
          .text(x, y - 18, label, {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: card ? '17px' : '18px',
            color: labelColor,
            align: 'center',
            wordWrap: { width: cardWidth - 24 },
          })
          .setOrigin(0.5),
      );

      container.add(
        this.add
          .text(
            x,
            y + 38,
            card
              ? `HP ${card.card.instance.currentHp}  ATK ${card.card.instance.currentAttack}`
              : '',
            {
              fontFamily: DEFAULT_FONT_FAMILY,
              fontSize: '15px',
              color: '#d7ead4',
              align: 'center',
            },
          )
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
}

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
