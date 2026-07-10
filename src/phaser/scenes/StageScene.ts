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
import { UI_THEME } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { CanvasUiFactory, type UiLayoutChild } from '../ui/CanvasUiFactory';
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
  private readonly ui = new CanvasUiFactory(this);
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
    this.ui.image({
      x: 0,
      y: 0,
      key: 'title-background',
      origin: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'stageBackdrop',
      origin: 0,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'screenShade',
      origin: 0,
    });
  }

  private addTitle(): void {
    this.ui.text({
      x: GAME_WIDTH / 2,
      y: 96,
      text: 'STAGE SELECT',
      variant: 'screenTitle',
      align: 'center',
      origin: 0.5,
    });
    this.ui.text({
      x: GAME_WIDTH / 2,
      y: 154,
      text: 'Choose a battle stage',
      variant: 'subtitle',
      align: 'center',
      origin: 0.5,
      alpha: 0.9,
    });
  }

  private addStatusText(): void {
    this.statusText = this.ui.text({
      x: GAME_WIDTH / 2,
      y: this.getStageLayoutMetrics().statusY,
      text: 'Select a stage and start battle.',
      variant: 'status',
      align: 'center',
      origin: 0.5,
      wordWrapWidth: GAME_WIDTH - 120,
    });
  }

  private renderStageBody(): void {
    this.stageBodyContainer?.destroy();
    const metrics = this.getStageLayoutMetrics();
    const bodyLayout = this.ui.stack({
      x: STAGE_BODY_X,
      y: STAGE_BODY_Y,
      width: GAME_WIDTH - STAGE_BODY_X * 2,
      height: metrics.bodyHeight,
      orientation: 'x',
      origin: 0,
      gap: STAGE_BODY_GAP,
      children: [
        {
          gameObject: this.createStageListPanel(),
          align: 'left-top',
          minWidth: STAGE_LIST_WIDTH,
          minHeight: metrics.bodyHeight,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createStageDetailPanel(),
          align: 'left-top',
          minWidth: STAGE_DETAIL_WIDTH,
          minHeight: metrics.bodyHeight,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
    this.stageBodyContainer = bodyLayout;
  }

  private createStageListPanel(): Phaser.GameObjects.Container {
    const { bodyHeight } = this.getStageLayoutMetrics();
    const viewportHeight = Math.max(
      MIN_STAGE_LIST_VIEWPORT_HEIGHT,
      bodyHeight - STAGE_LIST_HEADER_HEIGHT - STAGE_LIST_PANEL_PADDING_BOTTOM,
    );
    const container = this.ui.container({ width: STAGE_LIST_WIDTH, height: bodyHeight });
    const panel = this.ui.panel({
      x: 0,
      y: 0,
      width: STAGE_LIST_WIDTH,
      height: bodyHeight,
      variant: 'stageListPanel',
      origin: 0,
    });
    container.add(panel);

    container.add(
      this.ui.text({
        x: 28,
        y: 30,
        text: 'Stages',
        variant: 'stageListTitle',
        align: 'left',
        origin: { x: 0, y: 0.5 },
      }),
    );

    const cardLayoutHeight = Math.max(
      viewportHeight,
      this.stageDefinitions.length * STAGE_CARD_HEIGHT +
        Math.max(0, this.stageDefinitions.length - 1) * STAGE_CARD_GAP,
    );
    const cardChildren: UiLayoutChild[] = [];
    let selectedStageCard: Phaser.GameObjects.GameObject | null = null;
    this.stageDefinitions.forEach((stageDefinition) => {
      const stageCard = this.createStageCard(stageDefinition);
      if (stageDefinition.id === this.selectedStageId) {
        selectedStageCard = stageCard;
      }

      cardChildren.push({
        gameObject: stageCard,
        align: 'left-top',
        minWidth: STAGE_CARD_WIDTH,
        minHeight: STAGE_CARD_HEIGHT,
      });
    });

    const cardLayout = this.ui.stack({
      x: 0,
      y: 0,
      width: STAGE_CARD_WIDTH,
      height: cardLayoutHeight,
      orientation: 'y',
      origin: 0,
      gap: STAGE_CARD_GAP,
      children: cardChildren,
    });
    const scrollPanelWidth =
      STAGE_CARD_WIDTH + STAGE_LIST_SCROLLBAR_GAP + STAGE_LIST_SCROLLBAR_WIDTH;
    const scrollPanel = this.ui.scrollPanel({
      x: STAGE_LIST_PANEL_PADDING_X,
      y: STAGE_LIST_HEADER_HEIGHT,
      width: scrollPanelWidth,
      height: viewportHeight,
      child: cardLayout,
      ...(selectedStageCard ? { focusChild: selectedStageCard } : {}),
      scrollbarWidth: STAGE_LIST_SCROLLBAR_WIDTH,
      scrollbarGap: STAGE_LIST_SCROLLBAR_GAP,
    });

    container.add(scrollPanel);
    return container;
  }

  private createStageCard(stageDefinition: StageDefinition): Phaser.GameObjects.GameObject {
    const unlocked = isStageUnlocked(stageDefinition, this.session.stageProgress);
    const cleared = this.session.stageProgress.clearedStageIds.includes(stageDefinition.id);
    const selected = stageDefinition.id === this.selectedStageId;
    const detailColor = unlocked ? UI_THEME.colors.stageDetail : UI_THEME.colors.stageLockedDetail;
    const background = this.ui.pressableSurface({
      x: 0,
      y: 0,
      width: STAGE_CARD_WIDTH,
      height: STAGE_CARD_HEIGHT,
      variant: selected ? 'stageCardSelected' : unlocked ? 'stageCard' : 'stageCardLocked',
      hoverVariant: unlocked ? 'rowHover' : 'stageCardLockedHover',
      origin: 0,
      onClick: () => this.selectStage(stageDefinition.id),
    });

    const cardTextWidth = STAGE_CARD_WIDTH - 44;
    const orderText = this.ui.text({
      x: 0,
      y: 0,
      text: `Stage ${stageDefinition.order}`,
      variant: 'stageCardOrder',
      color: selected ? UI_THEME.colors.primaryWarm : detailColor,
      align: 'left',
      origin: { x: 0, y: 0.5 },
      fixedWidth: cardTextWidth,
      fixedHeight: 16,
    });
    const titleText = this.ui.text({
      x: 0,
      y: 0,
      text: stageDefinition.name,
      variant: 'stageCardName',
      color: unlocked ? UI_THEME.colors.primary : UI_THEME.text.buttonLabelDisabled.color,
      align: 'left',
      origin: { x: 0, y: 0.5 },
      fixedWidth: cardTextWidth,
      fixedHeight: 32,
      maxLines: 1,
      wordWrapWidth: cardTextWidth,
    });
    const stateText = this.ui.text({
      x: 0,
      y: 0,
      text: cleared ? 'CLEARED' : unlocked ? 'Unlocked' : 'Locked',
      variant: 'stageCardOrder',
      color: cleared ? UI_THEME.colors.primaryWarm : detailColor,
      align: 'left',
      origin: { x: 0, y: 0.5 },
      fixedWidth: cardTextWidth,
      fixedHeight: 16,
    });
    const textLayout = this.ui.stack({
      x: 0,
      y: 0,
      width: cardTextWidth,
      height: STAGE_CARD_HEIGHT - 24,
      orientation: 'y',
      origin: 0,
      children: [
        {
          gameObject: orderText,
          align: 'left-center',
          minWidth: cardTextWidth,
          minHeight: 16,
          expand: true,
        },
        {
          gameObject: titleText,
          align: 'left-center',
          minWidth: cardTextWidth,
          minHeight: 32,
          padding: { top: 4, bottom: 4 },
          expand: true,
        },
        {
          gameObject: stateText,
          align: 'left-center',
          minWidth: cardTextWidth,
          minHeight: 16,
          padding: { top: 6 },
          expand: true,
        },
      ],
    });
    return this.ui.overlay({
      x: 0,
      y: 0,
      width: STAGE_CARD_WIDTH,
      height: STAGE_CARD_HEIGHT,
      origin: 0,
      background,
      children: [
        {
          gameObject: textLayout,
          align: 'left-top',
          padding: { left: 22, top: 12, right: 22, bottom: 12 },
          expand: true,
        },
      ],
    });
  }

  private createStageDetailPanel(): Phaser.GameObjects.Container {
    const { bodyHeight } = this.getStageLayoutMetrics();
    const container = this.ui.container({ width: STAGE_DETAIL_WIDTH, height: bodyHeight });
    const stageDefinition = this.getSelectedStageDefinition();

    const panel = this.ui.panel({
      x: 0,
      y: 0,
      width: STAGE_DETAIL_WIDTH,
      height: bodyHeight,
      variant: 'panel',
      origin: 0,
    });
    container.add(panel);

    container.add(
      this.ui.text({
        x: 34,
        y: 38,
        text: stageDefinition.name,
        variant: 'detailTitle',
        align: 'left',
        origin: { x: 0, y: 0.5 },
        fixedWidth: 548,
        fixedHeight: 48,
        maxLines: 1,
        wordWrapWidth: 548,
      }),
    );

    const rows: Array<[string, string]> = [
      ['Victory', formatVictoryCondition(stageDefinition.victoryCondition)],
      ['Defeat', stageDefinition.defeatConditions.map(formatDefeatCondition).join('\n')],
    ];

    const rowChildren = rows.map(
      ([label, value]) =>
        ({
          gameObject: this.createDetailRow(label, value),
          align: 'left-top',
          minWidth: DETAIL_ROW_WIDTH,
          minHeight: DETAIL_ROW_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        }) as const,
    );
    const rowLayout = this.ui.stack({
      x: 34,
      y: DETAIL_PANEL_PADDING_TOP + 50,
      width: DETAIL_ROW_WIDTH,
      height: 0,
      orientation: 'y',
      origin: 0,
      gap: DETAIL_ROW_GAP,
      children: rowChildren,
    });
    container.add(rowLayout);
    return container;
  }

  private renderBattleResultSummary(): void {
    this.resultSummaryContainer?.destroy();
    if (!this.lastBattleResult) {
      this.resultSummaryContainer = null;
      return;
    }

    const container = this.ui.container({ x: 74, y: this.getStageLayoutMetrics().resultSummaryY });
    this.resultSummaryContainer = container;
    const result = this.lastBattleResult;
    const stageName = this.getStageName(result.stageId);
    const panel = this.ui.panel({
      x: 0,
      y: 0,
      width: 1052,
      height: 196,
      variant: result.outcome === 'WIN' ? 'resultWin' : 'resultLoss',
      origin: 0,
    });
    container.add(panel);

    container.add(
      this.ui.text({
        x: 28,
        y: 28,
        text: result.outcome === 'WIN' ? 'Recent Result: VICTORY' : 'Recent Result: DEFEAT',
        variant: 'stageResultTitle',
        color: result.outcome === 'WIN' ? UI_THEME.colors.primaryWarm : UI_THEME.colors.danger,
        align: 'left',
        origin: { x: 0, y: 0.5 },
      }),
    );
    container.add(
      this.ui.text({
        x: 28,
        y: 66,
        text: `${stageName} · ${formatBattleResultReason(result)}`,
        variant: 'bodyLarge',
        color: UI_THEME.colors.secondarySoft,
        align: 'left',
        origin: { x: 0, y: 0.5 },
        wordWrapWidth: 980,
      }),
    );
    container.add(
      this.ui.text({
        x: 28,
        y: 108,
        text: `Rewards: ${formatBattleResultRewards(result)}\nGrowth: ${formatBattleResultGrowth(result)}`,
        variant: 'body',
        align: 'left',
        origin: 0,
        wordWrapWidth: 980,
      }),
    );
  }

  private createDetailRow(label: string, value: string): Phaser.GameObjects.Container {
    const container = this.ui.container({ width: DETAIL_ROW_WIDTH, height: DETAIL_ROW_HEIGHT });
    const background = this.ui.panel({
      x: 0,
      y: 0,
      width: DETAIL_ROW_WIDTH,
      height: DETAIL_ROW_HEIGHT,
      variant: 'detailRow',
      origin: 0,
    });
    container.add(background);
    container.add(
      this.ui.text({
        x: 24,
        y: 22,
        text: label,
        variant: 'panelSubtitle',
        align: 'left',
        origin: { x: 0, y: 0.5 },
      }),
    );
    container.add(
      this.ui.text({
        x: 24,
        y: 54,
        text: value,
        variant: 'bodyLarge',
        align: 'left',
        origin: 0,
        fixedWidth: 496,
        fixedHeight: 56,
        maxLines: 2,
        wordWrapWidth: 496,
      }),
    );
    return container;
  }

  private renderHud(): void {
    this.hudContainer?.destroy();
    const stageDefinition = this.getSelectedStageDefinition();
    const unlocked = isStageUnlocked(stageDefinition, this.session.stageProgress);
    const child = (gameObject: Phaser.GameObjects.GameObject, width: number): UiLayoutChild => ({
      gameObject,
      align: 'left-top',
      minWidth: width,
      minHeight: HUD_BUTTON_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    const layout = this.ui.stack({
      x: (GAME_WIDTH - HUD_WIDTH) / 2,
      y: this.getStageLayoutMetrics().hudY,
      width: HUD_WIDTH,
      height: HUD_BUTTON_HEIGHT,
      orientation: 'x',
      origin: 0,
      gap: HUD_BUTTON_GAP,
      children: [
        child(
          this.createHudButton('Back', 180, true, () => {
            if (this.isStartingBattle) {
              return;
            }
            this.scene.start('SaveSlotScene');
          }),
          180,
        ),
        child(
          this.createHudButton('Start Battle', 250, unlocked, () => {
            void this.handleStartBattle();
          }),
          250,
        ),
        child(
          this.createHudButton('구성', 128, !this.isStartingBattle, () => {
            this.scene.start('DeckBuildScene', {
              session: this.session,
            } satisfies DeckBuildSceneData);
          }),
          128,
        ),
        child(
          this.createHudButton('장비', 128, !this.isStartingBattle, () => {
            this.scene.start('EquipmentScene', {
              session: this.session,
            } satisfies EquipmentSceneData);
          }),
          128,
        ),
        child(
          this.createHudButton('성장', 128, !this.isStartingBattle, () => {
            this.scene.start('GrowthScene', {
              session: this.session,
            } satisfies GrowthSceneData);
          }),
          128,
        ),
        child(this.createHudButton('연성', 128, false), 128),
      ],
    });
    this.hudContainer = layout;
  }

  private createHudButton(
    label: string,
    width: number,
    enabled: boolean,
    onClick?: () => void,
  ): Phaser.GameObjects.Container {
    const slot = this.ui.container({ width, height: HUD_BUTTON_HEIGHT });
    const button = enabled
      ? this.ui.button({
          x: width / 2,
          y: HUD_BUTTON_HEIGHT / 2,
          width,
          height: HUD_BUTTON_HEIGHT,
          label,
          enabled,
          onClick: onClick ?? (() => undefined),
        })
      : this.ui.button({
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
