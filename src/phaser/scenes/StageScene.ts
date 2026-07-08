import Phaser from 'phaser';
import { saveSlotState } from '../../game/save/client-api';
import {
  createGameSession,
  createSaveSlotStateFromGameSession,
  type GameSession,
} from '../../game/save/session';
import { isStageUnlocked, listStageDefinitions } from '../../game/stage/stage-definitions';
import type {
  StageBattleResult,
  StageDefeatCondition,
  StageDefinition,
  StageVictoryCondition,
} from '../../game/stage/types';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
import type {
  BattlefieldSceneData,
  DeckBuildSceneData,
  EquipmentSceneData,
  GrowthSceneData,
  StageSceneData,
} from './scene-data';

const STAGE_BODY_X = 74;
const STAGE_BODY_Y = 248;
const STAGE_LIST_WIDTH = 398;
const STAGE_DETAIL_WIDTH = 618;
const STAGE_BODY_GAP = 36;
const STAGE_BODY_BOTTOM_GAP = 38;
const STAGE_BODY_STATUS_GAP = 78;
const STAGE_LIST_HEADER_HEIGHT = 74;
const STAGE_LIST_PANEL_PADDING_X = 24;
const STAGE_LIST_PANEL_PADDING_BOTTOM = 24;
const STAGE_LIST_SCROLLBAR_WIDTH = 10;
const STAGE_LIST_SCROLLBAR_GAP = 10;
const STAGE_CARD_WIDTH = 338;
const STAGE_CARD_HEIGHT = 104;
const STAGE_CARD_GAP = 14;
const MIN_VISIBLE_STAGE_ROWS = 3;
const DETAIL_ROW_WIDTH = 550;
const DETAIL_ROW_HEIGHT = 126;
const DETAIL_ROW_GAP = 24;
const DETAIL_PANEL_PADDING_TOP = 44;
const HUD_BUTTON_HEIGHT = 64;
const HUD_BUTTON_GAP = 20;
const HUD_BOTTOM_SAFE_MARGIN = 128;
const HUD_WIDTH = 180 + 250 + 128 * 4 + HUD_BUTTON_GAP * 5;
const STATUS_GAP_WITH_RESULT = 80;
const STATUS_GAP_WITHOUT_RESULT = 214;
const RESULT_SUMMARY_TO_STATUS_GAP = 232;
const MIN_STAGE_LIST_VIEWPORT_HEIGHT =
  STAGE_CARD_HEIGHT * MIN_VISIBLE_STAGE_ROWS + STAGE_CARD_GAP * (MIN_VISIBLE_STAGE_ROWS - 1);
const MIN_STAGE_BODY_HEIGHT =
  STAGE_LIST_HEADER_HEIGHT + MIN_STAGE_LIST_VIEWPORT_HEIGHT + STAGE_LIST_PANEL_PADDING_BOTTOM;

type StageLayoutMetrics = {
  bodyHeight: number;
  hudY: number;
  resultSummaryY: number;
  statusY: number;
};

/**
 * 저장 슬롯 선택 이후 전투 시작 전 Stage 목록과 상세 정보를 보여주는 허브 씬이다.
 * Stage 정의 배열을 기준으로 화면을 구성하고, 선택한 Stage ID를 전투 씬으로 전달한다.
 */
export class StageScene extends Phaser.Scene {
  private session!: GameSession;
  private selectedStageId!: string;
  private stageDefinitions: StageDefinition[] = [];
  private stageBodyContainer: Phaser.GameObjects.GameObject | null = null;
  private resultSummaryContainer: Phaser.GameObjects.Container | null = null;
  private hudContainer: Phaser.GameObjects.GameObject | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private lastBattleResult: StageBattleResult | null = null;
  private isStartingBattle = false;

  constructor() {
    super({ key: 'StageScene' });
  }

  /**
   * 세션의 최근 선택 Stage를 기준으로 목록, 상세 패널, 하단 HUD를 구성한다.
   */
  create(data: StageSceneData): void {
    this.session = data.session;
    this.lastBattleResult = data.lastBattleResult ?? null;
    this.stageDefinitions = listStageDefinitions();
    this.selectedStageId = this.resolveInitialSelectedStage().id;
    this.isStartingBattle = false;

    this.addBackground();
    this.addTitle();
    this.addStatusText();
    this.renderStageBody();
    this.renderBattleResultSummary();
    this.renderHud();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
    });
  }

  private addBackground(): void {
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.62).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.16).setOrigin(0, 0);
  }

  private addTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, 96, 'STAGE SELECT', {
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
      .text(GAME_WIDTH / 2, 154, 'Choose a battle stage', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '24px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
  }

  private addStatusText(): void {
    this.statusText = this.add
      .text(
        GAME_WIDTH / 2,
        this.getStageLayoutMetrics().statusY,
        'Select a stage and start battle.',
        {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '22px',
          color: '#e6f4df',
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 120 },
        },
      )
      .setOrigin(0.5);
  }

  private renderStageBody(): void {
    this.stageBodyContainer?.destroy();
    const metrics = this.getStageLayoutMetrics();
    const bodyLayout = this.rexUI.add.sizer(
      STAGE_BODY_X,
      STAGE_BODY_Y,
      GAME_WIDTH - STAGE_BODY_X * 2,
      metrics.bodyHeight,
      'x',
      {
        origin: 0,
        space: { item: STAGE_BODY_GAP },
      },
    );

    bodyLayout.add(this.createStageListPanel(), {
      align: 'left-top',
      minWidth: STAGE_LIST_WIDTH,
      minHeight: metrics.bodyHeight,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    bodyLayout.add(this.createStageDetailPanel(), {
      align: 'left-top',
      minWidth: STAGE_DETAIL_WIDTH,
      minHeight: metrics.bodyHeight,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    bodyLayout.layout();
    this.stageBodyContainer = bodyLayout;
  }

  private createStageListPanel(): Phaser.GameObjects.Container {
    const { bodyHeight } = this.getStageLayoutMetrics();
    const viewportHeight = Math.max(
      MIN_STAGE_LIST_VIEWPORT_HEIGHT,
      bodyHeight - STAGE_LIST_HEADER_HEIGHT - STAGE_LIST_PANEL_PADDING_BOTTOM,
    );
    const container = this.add.container(0, 0);
    container.setSize(STAGE_LIST_WIDTH, bodyHeight);
    const panel = this.add
      .rectangle(0, 0, STAGE_LIST_WIDTH, bodyHeight, 0x10221d, 0.92)
      .setOrigin(0, 0);
    panel.setStrokeStyle(2, 0x9ecfaa, 0.54);
    container.add(panel);

    container.add(
      this.add
        .text(28, 30, 'Stages', {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '28px',
          color: '#f1f9ed',
          align: 'left',
        })
        .setOrigin(0, 0.5),
    );

    const cardLayoutHeight = Math.max(
      viewportHeight,
      this.stageDefinitions.length * STAGE_CARD_HEIGHT +
        Math.max(0, this.stageDefinitions.length - 1) * STAGE_CARD_GAP,
    );
    const cardLayout = this.rexUI.add.sizer(0, 0, STAGE_CARD_WIDTH, cardLayoutHeight, 'y', {
      origin: 0,
      space: { item: STAGE_CARD_GAP },
    });
    let selectedStageCard: Phaser.GameObjects.GameObject | null = null;
    this.stageDefinitions.forEach((stageDefinition) => {
      const stageCard = this.createStageCard(stageDefinition);
      if (stageDefinition.id === this.selectedStageId) {
        selectedStageCard = stageCard;
      }

      cardLayout.add(stageCard, {
        align: 'left-top',
        minWidth: STAGE_CARD_WIDTH,
        minHeight: STAGE_CARD_HEIGHT,
      });
    });

    cardLayout.layout();
    const scrollPanelWidth =
      STAGE_CARD_WIDTH + STAGE_LIST_SCROLLBAR_GAP + STAGE_LIST_SCROLLBAR_WIDTH;
    const scrollPanel = this.rexUI.add.scrollablePanel({
      x: STAGE_LIST_PANEL_PADDING_X,
      y: STAGE_LIST_HEADER_HEIGHT,
      width: scrollPanelWidth,
      height: viewportHeight,
      origin: 0,
      scrollMode: 'y',
      clampChildOY: true,
      panel: {
        child: cardLayout,
        mask: { padding: 2 },
      },
      space: {
        sliderY: STAGE_LIST_SCROLLBAR_GAP,
      },
      slider: {
        track: this.add.rectangle(0, 0, STAGE_LIST_SCROLLBAR_WIDTH, viewportHeight, 0x07130f, 0.72),
        thumb: this.add.rectangle(0, 0, STAGE_LIST_SCROLLBAR_WIDTH, 48, 0xbfeec5, 0.78),
        position: 'right',
        input: 'drag',
        hideUnscrollableSlider: true,
        disableUnscrollableDrag: true,
        adaptThumbSize: true,
        minThumbSize: 42,
      },
      scroller: {
        threshold: 8,
        slidingDeceleration: 4200,
        backDeceleration: 2200,
        pointerOutRelease: true,
      },
      mouseWheelScroller: {
        focus: false,
        speed: 0.22,
      },
      scrollDetectionMode: 'rectBounds',
    });
    scrollPanel.layout();
    if (selectedStageCard) {
      scrollPanel.scrollToChild(selectedStageCard, 'centerY');
    }

    container.add(scrollPanel);
    return container;
  }

  private createStageCard(stageDefinition: StageDefinition): Phaser.GameObjects.GameObject {
    const stageCard = this.rexUI.add.overlapSizer(0, 0, STAGE_CARD_WIDTH, STAGE_CARD_HEIGHT, {
      origin: 0,
    });
    const unlocked = isStageUnlocked(stageDefinition, this.session.stageProgress);
    const cleared = this.session.stageProgress.clearedStageIds.includes(stageDefinition.id);
    const selected = stageDefinition.id === this.selectedStageId;
    const fillColor = unlocked ? 0x1a3a2d : 0x15201d;
    const strokeColor = selected ? 0xffe4a8 : unlocked ? 0xbfeec5 : 0x51605a;
    const titleColor = unlocked ? '#f5fff0' : '#7e8b84';
    const detailColor = unlocked ? '#c8dfc7' : '#69756f';

    const background = this.add
      .rectangle(0, 0, STAGE_CARD_WIDTH, STAGE_CARD_HEIGHT, fillColor, 0.95)
      .setOrigin(0, 0);
    background.setStrokeStyle(selected ? 4 : 2, strokeColor, selected ? 0.96 : 0.7);
    background.setInteractive({ useHandCursor: true });
    stageCard.addBackground(background);

    const cardTextWidth = STAGE_CARD_WIDTH - 44;
    const textLayout = this.rexUI.add.sizer(0, 0, cardTextWidth, STAGE_CARD_HEIGHT - 24, 'y', {
      origin: 0,
    });
    const orderText = this.add
      .text(0, 0, `Stage ${stageDefinition.order}`, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '14px',
        color: selected ? '#fff3c2' : detailColor,
        align: 'left',
        fixedWidth: cardTextWidth,
        fixedHeight: 16,
      })
      .setOrigin(0, 0.5);
    const titleText = this.add
      .text(0, 0, stageDefinition.name, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '23px',
        color: titleColor,
        align: 'left',
        fixedWidth: cardTextWidth,
        fixedHeight: 32,
        maxLines: 1,
        wordWrap: { width: cardTextWidth },
      })
      .setOrigin(0, 0.5);
    const stateText = this.add
      .text(0, 0, cleared ? 'CLEARED' : unlocked ? 'Unlocked' : 'Locked', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '14px',
        color: cleared ? '#fff3c2' : detailColor,
        align: 'left',
        fixedWidth: cardTextWidth,
        fixedHeight: 16,
      })
      .setOrigin(0, 0.5);
    textLayout.add(orderText, {
      align: 'left-center',
      minWidth: cardTextWidth,
      minHeight: 16,
      expand: true,
    });
    textLayout.add(titleText, {
      align: 'left-center',
      minWidth: cardTextWidth,
      minHeight: 32,
      padding: { top: 4, bottom: 4 },
      expand: true,
    });
    textLayout.add(stateText, {
      align: 'left-center',
      minWidth: cardTextWidth,
      minHeight: 16,
      padding: { top: 6 },
      expand: true,
    });
    stageCard.add(textLayout, {
      align: 'left-top',
      padding: { left: 22, top: 12, right: 22, bottom: 12 },
      expand: true,
    });

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      background.setFillStyle(unlocked ? 0x24513d : 0x1d2a26, 0.98);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      background.setFillStyle(fillColor, 0.95);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.selectStage(stageDefinition.id);
    });

    stageCard.layout();
    return stageCard;
  }

  private createStageDetailPanel(): Phaser.GameObjects.Container {
    const { bodyHeight } = this.getStageLayoutMetrics();
    const container = this.add.container(0, 0);
    container.setSize(STAGE_DETAIL_WIDTH, bodyHeight);
    const stageDefinition = this.getSelectedStageDefinition();

    const panel = this.add
      .rectangle(0, 0, STAGE_DETAIL_WIDTH, bodyHeight, 0x10261f, 0.94)
      .setOrigin(0, 0);
    panel.setStrokeStyle(2, 0xbfeec5, 0.64);
    container.add(panel);

    container.add(
      this.add
        .text(34, 38, stageDefinition.name, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '36px',
          fontStyle: '700',
          color: '#f5fff0',
          align: 'left',
          fixedWidth: 548,
          fixedHeight: 48,
          maxLines: 1,
          wordWrap: { width: 548 },
        })
        .setOrigin(0, 0.5),
    );

    const rows: Array<[string, string]> = [
      ['Victory', formatVictoryCondition(stageDefinition.victoryCondition)],
      ['Defeat', stageDefinition.defeatConditions.map(formatDefeatCondition).join('\n')],
    ];

    const rowLayout = this.rexUI.add.sizer(
      34,
      DETAIL_PANEL_PADDING_TOP + 50,
      DETAIL_ROW_WIDTH,
      0,
      'y',
      {
        origin: 0,
        space: { item: DETAIL_ROW_GAP },
      },
    );
    rows.forEach(([label, value]) => {
      rowLayout.add(this.createDetailRow(label, value), {
        align: 'left-top',
        minWidth: DETAIL_ROW_WIDTH,
        minHeight: DETAIL_ROW_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      });
    });
    rowLayout.layout();
    container.add(rowLayout);
    return container;
  }

  private renderBattleResultSummary(): void {
    this.resultSummaryContainer?.destroy();
    if (!this.lastBattleResult) {
      this.resultSummaryContainer = null;
      return;
    }

    const container = this.add.container(74, this.getStageLayoutMetrics().resultSummaryY);
    this.resultSummaryContainer = container;
    const result = this.lastBattleResult;
    const stageName = this.getStageName(result.stageId);
    const panel = this.add.rectangle(0, 0, 1052, 196, 0x10261f, 0.94).setOrigin(0, 0);
    panel.setStrokeStyle(2, result.outcome === 'WIN' ? 0xffe4a8 : 0xff8e8e, 0.82);
    container.add(panel);

    container.add(
      this.add
        .text(
          28,
          28,
          result.outcome === 'WIN' ? 'Recent Result: VICTORY' : 'Recent Result: DEFEAT',
          {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '26px',
            color: result.outcome === 'WIN' ? '#fff3c2' : '#ffd8d8',
            align: 'left',
          },
        )
        .setOrigin(0, 0.5),
    );
    container.add(
      this.add
        .text(28, 66, `${stageName} · ${formatBattleResultReason(result)}`, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '20px',
          color: '#d7ead4',
          align: 'left',
          wordWrap: { width: 980 },
        })
        .setOrigin(0, 0.5),
    );
    container.add(
      this.add
        .text(
          28,
          108,
          `Rewards: ${formatBattleResultRewards(result)}\nGrowth: ${formatBattleResultGrowth(
            result,
          )}`,
          {
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: '19px',
            color: '#f1f8ec',
            align: 'left',
            wordWrap: { width: 980 },
          },
        )
        .setOrigin(0, 0),
    );
  }

  private createDetailRow(label: string, value: string): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setSize(DETAIL_ROW_WIDTH, DETAIL_ROW_HEIGHT);
    const background = this.add
      .rectangle(0, 0, DETAIL_ROW_WIDTH, DETAIL_ROW_HEIGHT, 0x17352d, 0.72)
      .setOrigin(0, 0);
    background.setStrokeStyle(1, 0x78a98d, 0.42);
    container.add(background);
    container.add(
      this.add
        .text(24, 22, label, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '18px',
          color: '#a8d2af',
          align: 'left',
        })
        .setOrigin(0, 0.5),
    );
    container.add(
      this.add
        .text(24, 54, value, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '20px',
          color: '#f1f8ec',
          align: 'left',
          fixedWidth: 496,
          fixedHeight: 56,
          maxLines: 2,
          wordWrap: { width: 496 },
        })
        .setOrigin(0, 0),
    );
    return container;
  }

  private renderHud(): void {
    this.hudContainer?.destroy();
    const layout = this.rexUI.add.sizer(
      (GAME_WIDTH - HUD_WIDTH) / 2,
      this.getStageLayoutMetrics().hudY,
      HUD_WIDTH,
      HUD_BUTTON_HEIGHT,
      'x',
      {
        origin: 0,
        space: { item: HUD_BUTTON_GAP },
      },
    );
    const stageDefinition = this.getSelectedStageDefinition();
    const unlocked = isStageUnlocked(stageDefinition, this.session.stageProgress);

    layout.add(
      this.createHudButton('Back', 180, true, () => {
        if (this.isStartingBattle) {
          return;
        }

        this.scene.start('SaveSlotScene');
      }),
      {
        align: 'left-top',
        minWidth: 180,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );
    layout.add(
      this.createHudButton('Start Battle', 250, unlocked, () => {
        void this.handleStartBattle();
      }),
      {
        align: 'left-top',
        minWidth: 250,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );

    layout.add(
      this.createHudButton('구성', 128, !this.isStartingBattle, () => {
        this.scene.start('DeckBuildScene', {
          session: this.session,
        } satisfies DeckBuildSceneData);
      }),
      {
        align: 'left-top',
        minWidth: 128,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );
    layout.add(
      this.createHudButton('장비', 128, !this.isStartingBattle, () => {
        this.scene.start('EquipmentScene', {
          session: this.session,
        } satisfies EquipmentSceneData);
      }),
      {
        align: 'left-top',
        minWidth: 128,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );
    layout.add(
      this.createHudButton('성장', 128, !this.isStartingBattle, () => {
        this.scene.start('GrowthScene', {
          session: this.session,
        } satisfies GrowthSceneData);
      }),
      {
        align: 'left-top',
        minWidth: 128,
        minHeight: HUD_BUTTON_HEIGHT,
        offsetOriginX: -0.5,
        offsetOriginY: -0.5,
      },
    );
    layout.add(this.createHudButton('연성', 128, false), {
      align: 'left-top',
      minWidth: 128,
      minHeight: HUD_BUTTON_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });

    layout.layout();
    this.hudContainer = layout;
  }

  private createHudButton(
    label: string,
    width: number,
    enabled: boolean,
    onClick?: () => void,
  ): Phaser.GameObjects.Container {
    const slot = this.add.container(0, 0);
    slot.setSize(width, HUD_BUTTON_HEIGHT);
    const button = enabled
      ? createMenuButton(this, {
          x: width / 2,
          y: HUD_BUTTON_HEIGHT / 2,
          width,
          height: HUD_BUTTON_HEIGHT,
          label,
          enabled,
          onClick: onClick ?? (() => undefined),
        })
      : createMenuButton(this, {
          x: width / 2,
          y: HUD_BUTTON_HEIGHT / 2,
          width,
          height: HUD_BUTTON_HEIGHT,
          label,
          enabled,
        });

    slot.add(button);
    return slot;
  }

  private selectStage(stageId: string): void {
    this.selectedStageId = stageId;
    this.session = {
      ...this.session,
      stageProgress: {
        ...this.session.stageProgress,
        clearedStageIds: [...this.session.stageProgress.clearedStageIds],
        lastSelectedStageId: stageId,
      },
    };
    this.renderStageBody();
    this.renderBattleResultSummary();
    this.renderHud();
    this.setStatus(`Selected ${this.getSelectedStageDefinition().name}.`);
  }

  private async handleStartBattle(): Promise<void> {
    if (this.isStartingBattle) {
      return;
    }

    const stageDefinition = this.getSelectedStageDefinition();
    if (!isStageUnlocked(stageDefinition, this.session.stageProgress)) {
      this.setStatus('This stage is locked.');
      return;
    }

    this.isStartingBattle = true;
    this.setStatus(`Preparing ${stageDefinition.name}...`);

    const nextSession: GameSession = {
      ...this.session,
      stageProgress: {
        ...this.session.stageProgress,
        clearedStageIds: [...this.session.stageProgress.clearedStageIds],
        lastSelectedStageId: stageDefinition.id,
      },
    };

    try {
      const savedState = await saveSlotState(createSaveSlotStateFromGameSession(nextSession));
      const savedSession = createGameSession(savedState);
      this.scene.start('BattlefieldScene', {
        session: savedSession,
        stageId: stageDefinition.id,
      } satisfies BattlefieldSceneData);
    } catch (error: unknown) {
      this.isStartingBattle = false;
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to start battle: ${message}`);
    }
  }

  private resolveInitialSelectedStage(): StageDefinition {
    const lastSelectedStage = this.stageDefinitions.find(
      (stageDefinition) =>
        stageDefinition.id === this.session.stageProgress.lastSelectedStageId &&
        isStageUnlocked(stageDefinition, this.session.stageProgress),
    );
    if (lastSelectedStage) {
      return lastSelectedStage;
    }

    const firstUnlockedStage = this.stageDefinitions.find((stageDefinition) =>
      isStageUnlocked(stageDefinition, this.session.stageProgress),
    );
    if (firstUnlockedStage) {
      return firstUnlockedStage;
    }

    const firstStage = this.stageDefinitions[0];
    if (!firstStage) {
      throw new Error('No stage definitions registered');
    }

    return firstStage;
  }

  private getSelectedStageDefinition(): StageDefinition {
    const selectedStage = this.stageDefinitions.find(
      (stageDefinition) => stageDefinition.id === this.selectedStageId,
    );
    if (selectedStage) {
      return selectedStage;
    }

    return this.resolveInitialSelectedStage();
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
  }

  private getStageName(stageId: string): string {
    return (
      this.stageDefinitions.find((stageDefinition) => stageDefinition.id === stageId)?.name ??
      stageId
    );
  }

  private handleScaleResize(): void {
    const { statusY } = this.getStageLayoutMetrics();
    this.statusText.setY(statusY);
    this.renderStageBody();
    this.renderBattleResultSummary();
    this.renderHud();
  }

  private getStageLayoutMetrics(): StageLayoutMetrics {
    const gameHeight = this.getGameHeight();
    const hudY = gameHeight - HUD_BOTTOM_SAFE_MARGIN - HUD_BUTTON_HEIGHT;
    const statusY =
      hudY - (this.lastBattleResult ? STATUS_GAP_WITH_RESULT : STATUS_GAP_WITHOUT_RESULT);
    const resultSummaryY = statusY - RESULT_SUMMARY_TO_STATUS_GAP;
    const bodyBottom = this.lastBattleResult
      ? resultSummaryY - STAGE_BODY_BOTTOM_GAP
      : statusY - STAGE_BODY_STATUS_GAP;

    return {
      bodyHeight: Math.max(MIN_STAGE_BODY_HEIGHT, bodyBottom - STAGE_BODY_Y),
      hudY,
      resultSummaryY,
      statusY,
    };
  }

  private getGameHeight(): number {
    const gameHeight = this.scale.gameSize.height;
    return gameHeight > 0 ? gameHeight : GAME_HEIGHT;
  }
}

function formatVictoryCondition(condition: StageVictoryCondition): string {
  if (condition.type === 'DEFEAT_ENEMY_LEADER') {
    return 'Defeat the enemy leader.';
  }

  return `Survive ${condition.turns} turns.`;
}

function formatDefeatCondition(condition: StageDefeatCondition): string {
  if (condition.type === 'PLAYER_LEADER_DEFEATED') {
    return 'Player leader defeated.';
  }
  if (condition.type === 'TURN_LIMIT') {
    return `Turn limit: ${condition.turns}.`;
  }

  return 'Deck out.';
}

function formatBattleResultReason(result: StageBattleResult): string {
  if (result.reason === 'ENEMY_LEADER_DEFEATED') {
    return 'Enemy leader defeated';
  }

  return 'Player leader defeated';
}

function formatBattleResultRewards(result: StageBattleResult): string {
  if (result.rewardCardNames.length === 0) {
    return 'No rewards';
  }

  return result.rewardCardNames.join(', ');
}

function formatBattleResultGrowth(result: StageBattleResult): string {
  if (result.growth.cardInstanceIds.length === 0 || result.growth.expPerCard <= 0) {
    return 'No growth EXP';
  }

  return `+${result.growth.expPerCard} EXP to ${result.growth.cardInstanceIds.length} cards`;
}
