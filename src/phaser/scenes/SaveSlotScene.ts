import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { createGameSession } from '../../game/save/session';
import type { SaveSlotSummary } from '../../game/save/types';
import { fetchSaveSlot, fetchSaveSlotSummaries, initializeSaveSlot } from '../../game/save/client-api';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
import type { BattlefieldSceneData, MainMenuSceneData } from './scene-data';

/**
 * `Start Game` 진입 후 3개의 저장 슬롯을 보여주는 선택 화면이다.
 * 서버의 `/api/save-slots` 응답을 읽어 실제 저장 상태를 렌더링한다.
 */
export class SaveSlotScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private retryButton: Phaser.GameObjects.Rectangle | null = null;
  private slotUiElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'SaveSlotScene' });
  }

  /**
   * 저장 슬롯 목록을 불러오기 전 초기 UI를 구성한다.
   */
  create(): void {
    this.addBackground();
    this.addTitle();
    this.addBackButton();
    this.showLoadingState();

    void this.loadSaveSlots();
  }

  private addBackground(): void {
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.56).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.14).setOrigin(0, 0);
  }

  private addTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, 104, 'START GAME', {
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
      .text(GAME_WIDTH / 2, 166, 'Choose a save slot', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
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
        this.scene.start('MainMenuScene', {
          loadedCount: 0,
          failedCount: 0,
        } satisfies MainMenuSceneData);
      },
    });
  }

  private showLoadingState(): void {
    this.clearSlotCards();
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 232, 'Loading save slots...', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#e6f4df',
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private async loadSaveSlots(): Promise<void> {
    try {
      const slots = await fetchSaveSlotSummaries();
      this.renderSlotCards(slots);
      this.setStatus('Select a slot to continue or create a new save.');
    } catch (error: unknown) {
      this.showFailureState(error);
    }
  }

  private renderSlotCards(slots: SaveSlotSummary[]): void {
    this.clearSlotCards();

    const cardWidth = 330;
    const cardHeight = 260;
    const cardGap = 28;
    const totalWidth = cardWidth * 3 + cardGap * 2;
    const startX = (GAME_WIDTH - totalWidth) / 2 + cardWidth / 2;
    const y = 392;

    slots.forEach((slot, index) => {
      const x = startX + index * (cardWidth + cardGap);
      this.createSlotCard(x, y, cardWidth, cardHeight, slot);
    });
  }

  private createSlotCard(
    x: number,
    y: number,
    width: number,
    height: number,
    slot: SaveSlotSummary,
  ): void {
    const fillColor = slot.isEmpty ? 0x12211c : 0x1a3a2d;
    const strokeColor = slot.isEmpty ? 0x4e5d57 : 0xbfeec5;
    const background = this.add.rectangle(x, y, width, height, fillColor, 0.96);
    background.setStrokeStyle(2, strokeColor, slot.isEmpty ? 0.7 : 0.94);
    background.setInteractive({ useHandCursor: true });
    this.slotUiElements.push(background);

    const titleColor = slot.isEmpty ? '#8e9a95' : '#f5fff0';
    const detailColor = slot.isEmpty ? '#7f8b85' : '#d7ead4';
    const accentColor = slot.isEmpty ? '#9cadb0' : '#a6d9b0';
    const slotLabel = `Slot ${slot.slotId}`;
    const title = slot.isEmpty ? 'Empty Slot' : slot.saveName ?? slotLabel;
    const subtitle = slot.isEmpty ? 'Create New Save' : formatSaveSlotSubtitle(slot);

    const slotLabelText = this.add
      .text(x, y - 88, slotLabel, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '20px',
        color: accentColor,
        align: 'center',
      })
      .setOrigin(0.5);
    this.slotUiElements.push(slotLabelText);

    const titleText = this.add
      .text(x, y - 36, title, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: slot.isEmpty ? '28px' : '26px',
        color: titleColor,
        align: 'center',
        wordWrap: { width: width - 48 },
      })
      .setOrigin(0.5);
    this.slotUiElements.push(titleText);

    const subtitleText = this.add
      .text(x, y + 6, subtitle, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: detailColor,
        align: 'center',
        wordWrap: { width: width - 48 },
      })
      .setOrigin(0.5);
    this.slotUiElements.push(subtitleText);

    const footerText = this.add
      .text(x, y + 74, slot.isEmpty ? 'Click to create' : 'Click to load', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '15px',
        color: slot.isEmpty ? '#b7c9ba' : '#dff3de',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.92);
    this.slotUiElements.push(footerText);

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      background.setFillStyle(slot.isEmpty ? 0x173027 : 0x24513d, 0.99);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      background.setFillStyle(fillColor, 0.96);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      void this.handleSlotSelection(slot);
    });
  }

  private showFailureState(error: unknown): void {
    this.clearSlotCards();
    const message = error instanceof Error ? error.message : String(error);
    this.setStatus(`Failed to load save slots: ${message}`);
    this.retryButton = this.add.rectangle(GAME_WIDTH / 2, 478, 280, 64, 0x1d3f31, 0.96);
    this.retryButton.setStrokeStyle(2, 0xdaf6d3, 0.9);
    this.retryButton.setInteractive({ useHandCursor: true });
    this.slotUiElements.push(this.retryButton);
    const retryText = this.add
      .text(GAME_WIDTH / 2, 478, 'Retry', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '26px',
        color: '#f5fff0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.slotUiElements.push(retryText);
    this.retryButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.scene.restart();
    });
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
  }

  private clearSlotCards(): void {
    this.slotUiElements.forEach((child) => {
      child.destroy();
    });
    this.slotUiElements = [];
    this.retryButton = null;
  }

  private async handleSlotSelection(slot: SaveSlotSummary): Promise<void> {
    try {
      if (slot.isEmpty) {
        this.setStatus(`Initializing Slot ${slot.slotId}...`);
        const result = await initializeSaveSlot(slot.slotId);
        const session = createGameSession(result.state);
        this.scene.start('BattlefieldScene', { session } satisfies BattlefieldSceneData);
        return;
      }

      this.setStatus(`Loading Slot ${slot.slotId}...`);
      const state = await fetchSaveSlot(slot.slotId);
      const session = createGameSession(state);
      this.scene.start('BattlefieldScene', { session } satisfies BattlefieldSceneData);
    } catch (error: unknown) {
      this.showFailureState(error);
    }
  }
}

function formatSaveSlotSubtitle(slot: SaveSlotSummary): string {
  if (slot.isEmpty) {
    return 'Create New Save';
  }

  const lines: string[] = [];
  if (slot.updatedAt) {
    lines.push(`Updated ${formatSaveSlotDate(slot.updatedAt)}`);
  }
  if (slot.deckCardCount !== null) {
    lines.push(`${slot.deckCardCount} cards`);
  }
  if (slot.leaderName) {
    lines.push(`Leader: ${slot.leaderName}`);
  }

  return lines.length > 0 ? lines.join(' · ') : 'Ready to load';
}

function formatSaveSlotDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
