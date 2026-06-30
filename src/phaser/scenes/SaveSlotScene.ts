import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { createGameSession } from '../../game/save/session';
import type { SaveSlotSummary } from '../../game/save/types';
import {
  fetchSaveSlot,
  fetchSaveSlotSummaries,
  initializeSaveSlot,
} from '../../game/save/client-api';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { LayoutBox } from '../ui/LayoutBox';
import { createMenuButton } from '../ui/menu-button';
import type { MainMenuSceneData, StageSceneData } from './scene-data';

const SLOT_CARD_WIDTH = 330;
const SLOT_CARD_HEIGHT = 260;
const SLOT_CARD_GAP = 28;
const SLOT_LIST_WIDTH = SLOT_CARD_WIDTH * 3 + SLOT_CARD_GAP * 2;

/**
 * `Start Game` 진입 후 3개의 저장 슬롯을 보여주는 선택 화면이다.
 * 서버의 `/api/save-slots` 응답을 읽어 실제 저장 상태를 렌더링한다.
 */
export class SaveSlotScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private slotContentContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'SaveSlotScene' });
  }

  /**
   * 저장 슬롯 목록을 불러오기 전 초기 UI를 구성한다.
   */
  create(): void {
    this.addBackground();
    this.addForegroundUi();
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

  private addForegroundUi(): void {
    const root = new LayoutBox(this, 'vbox');

    root.addOverlay(this.createTitleGroup(), {
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: 190,
    });
    root.addOverlay(this.createBackButton(), {
      x: 70,
      y: 57,
      width: 180,
      height: 58,
    });
    root.addOverlay(this.createStatusGroup(), {
      x: 0,
      y: 232,
      width: GAME_WIDTH,
      height: 1,
    });
    root.layout(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    const title = this.add
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

    const subtitle = this.add
      .text(GAME_WIDTH / 2, 166, 'Choose a save slot', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);

    group.add([title, subtitle]);
    return group;
  }

  private createBackButton(): Phaser.GameObjects.Container {
    const slot = this.add.container(0, 0);
    const button = createMenuButton(this, {
      x: 90,
      y: 29,
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

    slot.add(button);
    return slot;
  }

  private createStatusGroup(): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 0, 'Loading save slots...', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#e6f4df',
        align: 'center',
      })
      .setOrigin(0.5);
    group.add(this.statusText);
    return group;
  }

  private showLoadingState(): void {
    this.clearSlotCards();
    this.setStatus('Loading save slots...');
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
    const root = new LayoutBox(this, 'vbox');
    const cardLayout = new LayoutBox(this, 'hbox', {
      gap: SLOT_CARD_GAP,
      align: 'center',
    });

    slots.forEach((slot) => {
      cardLayout.add(this.createSlotCard(slot), {
        width: SLOT_CARD_WIDTH,
        height: SLOT_CARD_HEIGHT,
      });
    });

    root.addOverlay(cardLayout, {
      x: '50%',
      y: 392,
      width: SLOT_LIST_WIDTH,
      height: SLOT_CARD_HEIGHT,
      anchor: 'center',
    });
    root.layout(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.slotContentContainer = root.container;
  }

  private createSlotCard(slot: SaveSlotSummary): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    const fillColor = slot.isEmpty ? 0x12211c : 0x1a3a2d;
    const strokeColor = slot.isEmpty ? 0x4e5d57 : 0xbfeec5;
    const background = this.add.rectangle(
      SLOT_CARD_WIDTH / 2,
      SLOT_CARD_HEIGHT / 2,
      SLOT_CARD_WIDTH,
      SLOT_CARD_HEIGHT,
      fillColor,
      0.96,
    );
    background.setStrokeStyle(2, strokeColor, slot.isEmpty ? 0.7 : 0.94);
    background.setInteractive({ useHandCursor: true });

    const titleColor = slot.isEmpty ? '#8e9a95' : '#f5fff0';
    const detailColor = slot.isEmpty ? '#7f8b85' : '#d7ead4';
    const accentColor = slot.isEmpty ? '#9cadb0' : '#a6d9b0';
    const slotLabel = `Slot ${slot.slotId}`;
    const title = slot.isEmpty ? 'Empty Slot' : (slot.saveName ?? slotLabel);
    const subtitle = slot.isEmpty ? 'Create New Save' : formatSaveSlotSubtitle(slot);

    const slotLabelText = this.add
      .text(SLOT_CARD_WIDTH / 2, SLOT_CARD_HEIGHT / 2 - 88, slotLabel, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '20px',
        color: accentColor,
        align: 'center',
      })
      .setOrigin(0.5);

    const titleText = this.add
      .text(SLOT_CARD_WIDTH / 2, SLOT_CARD_HEIGHT / 2 - 36, title, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: slot.isEmpty ? '28px' : '26px',
        color: titleColor,
        align: 'center',
        wordWrap: { width: SLOT_CARD_WIDTH - 48 },
      })
      .setOrigin(0.5);

    const subtitleText = this.add
      .text(SLOT_CARD_WIDTH / 2, SLOT_CARD_HEIGHT / 2 + 6, subtitle, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: detailColor,
        align: 'center',
        wordWrap: { width: SLOT_CARD_WIDTH - 48 },
      })
      .setOrigin(0.5);

    const footerText = this.add
      .text(
        SLOT_CARD_WIDTH / 2,
        SLOT_CARD_HEIGHT / 2 + 74,
        slot.isEmpty ? 'Click to create' : 'Click to load',
        {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '15px',
          color: slot.isEmpty ? '#b7c9ba' : '#dff3de',
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.92);

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      background.setFillStyle(slot.isEmpty ? 0x173027 : 0x24513d, 0.99);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      background.setFillStyle(fillColor, 0.96);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      void this.handleSlotSelection(slot);
    });

    group.add([background, slotLabelText, titleText, subtitleText, footerText]);
    return group;
  }

  private showFailureState(error: unknown): void {
    this.clearSlotCards();
    const message = error instanceof Error ? error.message : String(error);
    this.setStatus(`Failed to load save slots: ${message}`);
    const root = new LayoutBox(this, 'vbox');

    root.addOverlay(this.createRetryButton(), {
      x: '50%',
      y: 478,
      width: 280,
      height: 64,
      anchor: 'center',
    });
    root.layout(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.slotContentContainer = root.container;
  }

  private createRetryButton(): Phaser.GameObjects.Container {
    const slot = this.add.container(0, 0);
    const button = createMenuButton(this, {
      x: 140,
      y: 32,
      width: 280,
      height: 64,
      label: 'Retry',
      enabled: true,
      onClick: () => {
        this.scene.restart();
      },
    });

    slot.add(button);
    return slot;
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
  }

  private clearSlotCards(): void {
    this.slotContentContainer?.destroy();
    this.slotContentContainer = null;
  }

  private async handleSlotSelection(slot: SaveSlotSummary): Promise<void> {
    try {
      if (slot.isEmpty) {
        this.setStatus(`Initializing Slot ${slot.slotId}...`);
        const result = await initializeSaveSlot(slot.slotId);
        const session = createGameSession(result.state);
        this.scene.start('StageScene', { session } satisfies StageSceneData);
        return;
      }

      this.setStatus(`Loading Slot ${slot.slotId}...`);
      const state = await fetchSaveSlot(slot.slotId);
      const session = createGameSession(state);
      this.scene.start('StageScene', { session } satisfies StageSceneData);
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
