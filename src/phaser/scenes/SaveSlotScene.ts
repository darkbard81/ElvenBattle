import Phaser from 'phaser';
import { UI_THEME } from '../../theme';
import { createGameSession } from '../../game/save/session';
import type { SaveSlotSummary } from '../../game/save/types';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { getGameServices } from '../services/game-services';
import { CanvasUiFactory } from '../ui/CanvasUiFactory';
import type { MainMenuSceneData, StageSceneData, TitleSceneData } from './scene-data';

const SLOT_CARD_WIDTH = 330;
const SLOT_CARD_HEIGHT = 260;
const SLOT_CARD_GAP = 28;
const SLOT_LIST_WIDTH = SLOT_CARD_WIDTH * 3 + SLOT_CARD_GAP * 2;
const TITLE_GROUP_HEIGHT = 190;
const BACK_BUTTON_X = 70;
const BACK_BUTTON_Y = 57;
const BACK_BUTTON_WIDTH = 180;
const BACK_BUTTON_HEIGHT = 58;
const LOGOUT_BUTTON_X = GAME_WIDTH - BACK_BUTTON_X - BACK_BUTTON_WIDTH;
const STATUS_GROUP_Y = 232;
const STATUS_GROUP_HEIGHT = 1;
const DELETE_BUTTON_WIDTH = 280;
const DELETE_BUTTON_HEIGHT = 64;
const DELETE_BUTTON_X = (GAME_WIDTH - DELETE_BUTTON_WIDTH) / 2;
const DELETE_BUTTON_Y = 570;
const RETRY_BUTTON_WIDTH = 280;
const RETRY_BUTTON_HEIGHT = 64;
const RETRY_BUTTON_X = (GAME_WIDTH - RETRY_BUTTON_WIDTH) / 2;
const RETRY_BUTTON_Y = 446;

/**
 * `Start Game` 진입 후 3개의 저장 슬롯을 보여주는 선택 화면이다.
 * 서버의 `/api/save-slots` 응답을 읽어 실제 저장 상태를 렌더링한다.
 */
export class SaveSlotScene extends Phaser.Scene {
  private readonly ui = new CanvasUiFactory(this);
  private statusText!: Phaser.GameObjects.Text;
  private slotContentContainer: Phaser.GameObjects.GameObject | null = null;
  private deleteButtonGroup!: Phaser.GameObjects.Container;
  private slotSummaries: SaveSlotSummary[] = [];
  private deleteMode = false;
  private isSlotActionPending = false;
  private isLoggingOut = false;

  constructor() {
    super({ key: 'SaveSlotScene' });
  }

  /**
   * 저장 슬롯 목록을 불러오기 전 초기 UI를 구성한다.
   */
  create(): void {
    this.isLoggingOut = false;
    this.isSlotActionPending = false;
    this.deleteMode = false;
    this.slotSummaries = [];
    this.addBackground();
    this.addForegroundUi();
    this.showLoadingState();

    void this.loadSaveSlots();
  }

  private addBackground(): void {
    this.ui.image({
      x: 0,
      y: 0,
      key: 'title-background',
      origin: { x: 0, y: 0 },
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'saveBackdrop',
      origin: 0,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'saveShade',
      origin: 0,
    });
  }

  private addForegroundUi(): void {
    this.ui.overlay({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      origin: 0,
      anchor: {
        left: 'left',
        top: 'top',
        width: '100%',
        height: '100%',
      },
      children: [
        {
          gameObject: this.createTitleGroup(),
          align: 'left-top',
          minWidth: GAME_WIDTH,
          minHeight: TITLE_GROUP_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createBackButton(),
          align: 'left-top',
          minWidth: BACK_BUTTON_WIDTH,
          minHeight: BACK_BUTTON_HEIGHT,
          offsetX: BACK_BUTTON_X,
          offsetY: BACK_BUTTON_Y,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createLogoutButton(),
          align: 'left-top',
          minWidth: BACK_BUTTON_WIDTH,
          minHeight: BACK_BUTTON_HEIGHT,
          offsetX: LOGOUT_BUTTON_X,
          offsetY: BACK_BUTTON_Y,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createStatusGroup(),
          align: 'left-top',
          minWidth: GAME_WIDTH,
          minHeight: STATUS_GROUP_HEIGHT,
          offsetY: STATUS_GROUP_Y,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createDeleteButtonGroup(),
          align: 'left-top',
          minWidth: DELETE_BUTTON_WIDTH,
          minHeight: DELETE_BUTTON_HEIGHT,
          offsetX: DELETE_BUTTON_X,
          offsetY: DELETE_BUTTON_Y,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.ui.container({ width: GAME_WIDTH, height: TITLE_GROUP_HEIGHT });
    const title = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 104,
      text: 'START GAME',
      variant: 'screenTitle',
      align: 'center',
      origin: 0.5,
    });
    const subtitle = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 166,
      text: 'Choose a save slot',
      variant: 'subtitle',
      align: 'center',
      origin: 0.5,
      alpha: 0.9,
    });

    group.add([title, subtitle]);
    return group;
  }

  private createBackButton(): Phaser.GameObjects.Container {
    const slot = this.ui.container({ width: BACK_BUTTON_WIDTH, height: BACK_BUTTON_HEIGHT });
    const button = this.ui.button({
      x: BACK_BUTTON_WIDTH / 2,
      y: BACK_BUTTON_HEIGHT / 2,
      width: BACK_BUTTON_WIDTH,
      height: BACK_BUTTON_HEIGHT,
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

  private createLogoutButton(): Phaser.GameObjects.Container {
    const slot = this.ui.container({ width: BACK_BUTTON_WIDTH, height: BACK_BUTTON_HEIGHT });
    const button = this.ui.button({
      x: BACK_BUTTON_WIDTH / 2,
      y: BACK_BUTTON_HEIGHT / 2,
      width: BACK_BUTTON_WIDTH,
      height: BACK_BUTTON_HEIGHT,
      label: 'Logout',
      enabled: true,
      onClick: () => {
        void this.logout();
      },
    });

    slot.add(button);
    return slot;
  }

  private createStatusGroup(): Phaser.GameObjects.Container {
    const group = this.ui.container({ width: GAME_WIDTH, height: STATUS_GROUP_HEIGHT });
    this.statusText = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 0,
      text: 'Loading save slots...',
      variant: 'statusLarge',
      align: 'center',
      origin: 0.5,
    });
    group.add(this.statusText);
    return group;
  }

  private createDeleteButtonGroup(): Phaser.GameObjects.Container {
    this.deleteButtonGroup = this.ui.container({
      width: DELETE_BUTTON_WIDTH,
      height: DELETE_BUTTON_HEIGHT,
    });
    this.renderDeleteButton();
    return this.deleteButtonGroup;
  }

  private renderDeleteButton(): void {
    this.deleteButtonGroup.removeAll(true);
    this.deleteButtonGroup.add(
      this.ui.button({
        x: DELETE_BUTTON_WIDTH / 2,
        y: DELETE_BUTTON_HEIGHT / 2,
        width: DELETE_BUTTON_WIDTH,
        height: DELETE_BUTTON_HEIGHT,
        label: this.deleteMode ? 'Cancel Delete' : 'Delete',
        enabled: true,
        onClick: () => {
          this.toggleDeleteMode();
        },
      }),
    );
  }

  private showLoadingState(): void {
    this.clearSlotCards();
    this.setStatus('Loading save slots...');
  }

  private async loadSaveSlots(): Promise<void> {
    try {
      const slots = await getGameServices(this).saveSlots.fetchSummaries();
      if (this.isLoggingOut) {
        return;
      }
      this.slotSummaries = slots;
      this.renderSlotCards(slots);
      this.setStatus('Select a slot to continue or create a new save.');
    } catch (error: unknown) {
      if (this.isLoggingOut) {
        return;
      }
      this.showFailureState(error);
    }
  }

  private renderSlotCards(slots: SaveSlotSummary[]): void {
    this.clearSlotCards();
    const children = slots.map(
      (slot) =>
        ({
          gameObject: this.createSlotCard(slot),
          align: 'left-top',
          minWidth: SLOT_CARD_WIDTH,
          minHeight: SLOT_CARD_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        }) as const,
    );
    const cardLayout = this.ui.stack({
      x: GAME_WIDTH / 2,
      y: 392,
      width: SLOT_LIST_WIDTH,
      height: SLOT_CARD_HEIGHT,
      orientation: 'x',
      origin: 0.5,
      gap: SLOT_CARD_GAP,
      children,
    });
    this.slotContentContainer = cardLayout;
  }

  private createSlotCard(slot: SaveSlotSummary): Phaser.GameObjects.Container {
    const group = this.ui.container({ width: SLOT_CARD_WIDTH, height: SLOT_CARD_HEIGHT });
    const isDeleteTarget = this.deleteMode && !slot.isEmpty;
    const background = this.ui.pressableSurface({
      x: SLOT_CARD_WIDTH / 2,
      y: SLOT_CARD_HEIGHT / 2,
      width: SLOT_CARD_WIDTH,
      height: SLOT_CARD_HEIGHT,
      variant: isDeleteTarget ? 'slotDelete' : slot.isEmpty ? 'slotEmpty' : 'slotReady',
      hoverVariant: isDeleteTarget
        ? 'slotDeleteHover'
        : slot.isEmpty
          ? 'slotEmptyHover'
          : 'slotReadyHover',
      onClick: () => {
        void this.handleSlotSelection(slot);
      },
    });
    const slotLabel = `Slot ${slot.slotId}`;
    const title = slot.isEmpty ? 'Empty Slot' : (slot.saveName ?? slotLabel);
    const subtitle = slot.isEmpty ? 'Create New Save' : formatSaveSlotSubtitle(slot);

    const slotLabelText = this.ui.text({
      x: SLOT_CARD_WIDTH / 2,
      y: SLOT_CARD_HEIGHT / 2 - 88,
      text: slotLabel,
      variant: 'slotLabel',
      color: isDeleteTarget
        ? UI_THEME.colors.danger
        : slot.isEmpty
          ? UI_THEME.colors.disabledAccent
          : UI_THEME.colors.readyAccent,
      align: 'center',
      origin: 0.5,
    });
    const titleText = this.ui.text({
      x: SLOT_CARD_WIDTH / 2,
      y: SLOT_CARD_HEIGHT / 2 - 36,
      text: title,
      variant: slot.isEmpty ? 'slotTitleEmpty' : 'slotTitle',
      align: 'center',
      origin: 0.5,
      wordWrapWidth: SLOT_CARD_WIDTH - 48,
    });
    const subtitleText = this.ui.text({
      x: SLOT_CARD_WIDTH / 2,
      y: SLOT_CARD_HEIGHT / 2 + 6,
      text: subtitle,
      variant: 'slotSubtitle',
      color: slot.isEmpty ? UI_THEME.colors.disabledDetail : UI_THEME.colors.secondarySoft,
      align: 'center',
      origin: 0.5,
      wordWrapWidth: SLOT_CARD_WIDTH - 48,
    });
    const footerText = this.ui.text({
      x: SLOT_CARD_WIDTH / 2,
      y: SLOT_CARD_HEIGHT / 2 + 74,
      text: this.deleteMode
        ? slot.isEmpty
          ? 'Already empty'
          : 'Click to delete'
        : slot.isEmpty
          ? 'Click to create'
          : 'Click to load',
      variant: 'slotFooter',
      color: isDeleteTarget
        ? UI_THEME.colors.danger
        : slot.isEmpty
          ? UI_THEME.text.caption.color
          : UI_THEME.colors.readyFooter,
      align: 'center',
      origin: 0.5,
      alpha: 0.92,
    });

    group.add([background, slotLabelText, titleText, subtitleText, footerText]);
    return group;
  }

  private showFailureState(error: unknown): void {
    this.clearSlotCards();
    const message = error instanceof Error ? error.message : String(error);
    this.setStatus(`Failed to load save slots: ${message}`);
    const root = this.ui.overlay({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      origin: 0,
      anchor: {
        left: 'left',
        top: 'top',
        width: '100%',
        height: '100%',
      },
      children: [
        {
          gameObject: this.createRetryButton(),
          align: 'left-top',
          minWidth: RETRY_BUTTON_WIDTH,
          minHeight: RETRY_BUTTON_HEIGHT,
          offsetX: RETRY_BUTTON_X,
          offsetY: RETRY_BUTTON_Y,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
    this.slotContentContainer = root;
  }

  private createRetryButton(): Phaser.GameObjects.Container {
    const slot = this.ui.container({ width: RETRY_BUTTON_WIDTH, height: RETRY_BUTTON_HEIGHT });
    const button = this.ui.button({
      x: RETRY_BUTTON_WIDTH / 2,
      y: RETRY_BUTTON_HEIGHT / 2,
      width: RETRY_BUTTON_WIDTH,
      height: RETRY_BUTTON_HEIGHT,
      label: 'Retry',
      enabled: true,
      onClick: () => {
        this.scene.restart();
      },
    });

    slot.add(button);
    return slot;
  }

  private setStatus(
    message: string,
    color: typeof UI_THEME.text.statusLarge.color = UI_THEME.text.statusLarge.color,
  ): void {
    this.statusText.setText(message);
    this.statusText.setColor(color.css);
  }

  private clearSlotCards(): void {
    this.slotContentContainer?.destroy();
    this.slotContentContainer = null;
  }

  private async logout(): Promise<void> {
    if (this.isLoggingOut) {
      return;
    }
    this.isLoggingOut = true;
    this.input.enabled = false;
    this.setStatus('Signing out...');
    try {
      await getGameServices(this).auth.logout();
      this.scene.start('TitleScene', {
        statusMessage: 'You have been logged out.',
      } satisfies TitleSceneData);
    } catch (error: unknown) {
      this.isLoggingOut = false;
      this.input.enabled = true;
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private async handleSlotSelection(slot: SaveSlotSummary): Promise<void> {
    if (this.isSlotActionPending || this.isLoggingOut) {
      return;
    }
    if (this.deleteMode) {
      await this.deleteSlot(slot);
      return;
    }

    this.isSlotActionPending = true;
    try {
      if (slot.isEmpty) {
        this.setStatus(`Initializing Slot ${slot.slotId}...`);
        const result = await getGameServices(this).saveSlots.initialize(slot.slotId);
        if (this.isLoggingOut) {
          return;
        }
        const session = createGameSession(result.state);
        this.scene.start('StageScene', { session } satisfies StageSceneData);
        return;
      }

      this.setStatus(`Loading Slot ${slot.slotId}...`);
      const state = await getGameServices(this).saveSlots.fetch(slot.slotId);
      if (this.isLoggingOut) {
        return;
      }
      const session = createGameSession(state);
      this.scene.start('StageScene', { session } satisfies StageSceneData);
    } catch (error: unknown) {
      if (this.isLoggingOut) {
        return;
      }
      this.showFailureState(error);
    } finally {
      this.isSlotActionPending = false;
    }
  }

  private toggleDeleteMode(): void {
    if (this.isSlotActionPending || this.isLoggingOut) {
      return;
    }
    if (this.slotSummaries.length === 0) {
      this.setStatus('Save slots are not available yet.');
      return;
    }

    this.deleteMode = !this.deleteMode;
    this.renderDeleteButton();
    this.renderSlotCards(this.slotSummaries);
    if (this.deleteMode) {
      this.setStatus('Delete mode: select a saved slot to delete.', UI_THEME.colors.danger);
      return;
    }
    this.setStatus('Select a slot to continue or create a new save.');
  }

  private async deleteSlot(slot: SaveSlotSummary): Promise<void> {
    if (slot.isEmpty) {
      this.setStatus(`Slot ${slot.slotId} is already empty.`, UI_THEME.colors.danger);
      return;
    }

    this.isSlotActionPending = true;
    this.setStatus(`Deleting Slot ${slot.slotId}...`, UI_THEME.colors.danger);
    try {
      const summary = await getGameServices(this).saveSlots.delete(slot.slotId);
      if (this.isLoggingOut) {
        return;
      }

      this.slotSummaries = this.slotSummaries.map((entry) =>
        entry.slotId === summary.slotId ? summary : entry,
      );
      this.deleteMode = false;
      this.renderDeleteButton();
      this.renderSlotCards(this.slotSummaries);
      this.setStatus(`Slot ${slot.slotId} deleted. Select a slot to continue.`);
    } catch (error: unknown) {
      if (this.isLoggingOut) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to delete Slot ${slot.slotId}: ${message}`, UI_THEME.colors.danger);
    } finally {
      this.isSlotActionPending = false;
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
