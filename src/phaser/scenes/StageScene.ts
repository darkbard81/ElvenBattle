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
  StageRewardDefinition,
  StageUnlockCondition,
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

/**
 * 저장 슬롯 선택 이후 전투 시작 전 Stage 목록과 상세 정보를 보여주는 허브 씬이다.
 * Stage 정의 배열을 기준으로 화면을 구성하고, 선택한 Stage ID를 전투 씬으로 전달한다.
 */
export class StageScene extends Phaser.Scene {
  private session!: GameSession;
  private selectedStageId!: string;
  private stageDefinitions: StageDefinition[] = [];
  private stageListContainer: Phaser.GameObjects.Container | null = null;
  private detailContainer: Phaser.GameObjects.Container | null = null;
  private resultSummaryContainer: Phaser.GameObjects.Container | null = null;
  private hudContainer: Phaser.GameObjects.Container | null = null;
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
    this.renderStageList();
    this.renderStageDetail();
    this.renderBattleResultSummary();
    this.renderHud();
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
        this.lastBattleResult ? 1648 : 1514,
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

  private renderStageList(): void {
    this.stageListContainer?.destroy();
    const container = this.add.container(74, 248);
    this.stageListContainer = container;

    const panel = this.add.rectangle(0, 0, 398, 1130, 0x10221d, 0.92).setOrigin(0, 0);
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

    this.stageDefinitions.forEach((stageDefinition, index) => {
      this.addStageCard(container, stageDefinition, 92 + index * 158);
    });
  }

  private addStageCard(
    container: Phaser.GameObjects.Container,
    stageDefinition: StageDefinition,
    y: number,
  ): void {
    const unlocked = isStageUnlocked(stageDefinition, this.session.stageProgress);
    const cleared = this.session.stageProgress.clearedStageIds.includes(stageDefinition.id);
    const selected = stageDefinition.id === this.selectedStageId;
    const fillColor = unlocked ? 0x1a3a2d : 0x15201d;
    const strokeColor = selected ? 0xffe4a8 : unlocked ? 0xbfeec5 : 0x51605a;
    const titleColor = unlocked ? '#f5fff0' : '#7e8b84';
    const detailColor = unlocked ? '#c8dfc7' : '#69756f';

    const background = this.add.rectangle(24, y, 350, 132, fillColor, 0.95).setOrigin(0, 0.5);
    background.setStrokeStyle(selected ? 4 : 2, strokeColor, selected ? 0.96 : 0.7);
    background.setInteractive({ useHandCursor: true });
    container.add(background);

    const orderText = this.add
      .text(52, y - 38, `Stage ${stageDefinition.order}`, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: selected ? '#fff3c2' : detailColor,
        align: 'left',
      })
      .setOrigin(0, 0.5);
    const titleText = this.add
      .text(52, y - 6, stageDefinition.name, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '28px',
        color: titleColor,
        align: 'left',
        wordWrap: { width: 290 },
      })
      .setOrigin(0, 0.5);
    const stateText = this.add
      .text(52, y + 36, cleared ? 'CLEARED' : unlocked ? 'Unlocked' : 'Locked', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: cleared ? '#fff3c2' : detailColor,
        align: 'left',
      })
      .setOrigin(0, 0.5);
    container.add([orderText, titleText, stateText]);

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      background.setFillStyle(unlocked ? 0x24513d : 0x1d2a26, 0.98);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      background.setFillStyle(fillColor, 0.95);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.selectStage(stageDefinition.id);
    });
  }

  private renderStageDetail(): void {
    this.detailContainer?.destroy();
    const container = this.add.container(508, 248);
    this.detailContainer = container;
    const stageDefinition = this.getSelectedStageDefinition();
    const unlocked = isStageUnlocked(stageDefinition, this.session.stageProgress);

    const panel = this.add.rectangle(0, 0, 618, 1130, 0x10261f, 0.94).setOrigin(0, 0);
    panel.setStrokeStyle(2, 0xbfeec5, 0.64);
    container.add(panel);

    container.add(
      this.add
        .text(34, 40, stageDefinition.name, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '42px',
          fontStyle: '700',
          color: '#f5fff0',
          align: 'left',
          wordWrap: { width: 548 },
        })
        .setOrigin(0, 0.5),
    );
    container.add(
      this.add
        .text(34, 102, stageDefinition.description, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '19px',
          color: '#d7ead4',
          align: 'left',
          wordWrap: { width: 548 },
        })
        .setOrigin(0, 0),
    );

    const rows: Array<[string, string]> = [
      ['Victory', formatVictoryCondition(stageDefinition.victoryCondition)],
      ['Defeat', stageDefinition.defeatConditions.map(formatDefeatCondition).join('\n')],
      ['Enemy Deck', `${stageDefinition.enemyDeckId}\n${stageDefinition.enemyDeckPath}`],
      ['Rewards', formatRewards(stageDefinition.rewards)],
      ['Unlock', formatUnlockCondition(stageDefinition.unlock, unlocked)],
    ];

    rows.forEach(([label, value], index) => {
      this.addDetailRow(container, label, value, 244 + index * 156);
    });
  }

  private renderBattleResultSummary(): void {
    this.resultSummaryContainer?.destroy();
    if (!this.lastBattleResult) {
      this.resultSummaryContainer = null;
      return;
    }

    const container = this.add.container(74, 1416);
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

  private addDetailRow(
    container: Phaser.GameObjects.Container,
    label: string,
    value: string,
    y: number,
  ): void {
    const background = this.add.rectangle(34, y, 550, 126, 0x17352d, 0.72).setOrigin(0, 0);
    background.setStrokeStyle(1, 0x78a98d, 0.42);
    container.add(background);
    container.add(
      this.add
        .text(58, y + 22, label, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '18px',
          color: '#a8d2af',
          align: 'left',
        })
        .setOrigin(0, 0.5),
    );
    container.add(
      this.add
        .text(58, y + 54, value, {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: '20px',
          color: '#f1f8ec',
          align: 'left',
          wordWrap: { width: 496 },
        })
        .setOrigin(0, 0),
    );
  }

  private renderHud(): void {
    this.hudContainer?.destroy();
    const container = this.add.container(0, 0);
    this.hudContainer = container;
    const stageDefinition = this.getSelectedStageDefinition();
    const unlocked = isStageUnlocked(stageDefinition, this.session.stageProgress);

    createMenuButton(this, {
      x: 150,
      y: 1760,
      width: 180,
      height: 64,
      label: 'Back',
      enabled: true,
      parent: container,
      onClick: () => {
        if (this.isStartingBattle) {
          return;
        }

        this.scene.start('SaveSlotScene');
      },
    });
    createMenuButton(this, {
      x: 382,
      y: 1760,
      width: 250,
      height: 64,
      label: 'Start Battle',
      enabled: unlocked,
      parent: container,
      onClick: () => {
        void this.handleStartBattle();
      },
    });

    createMenuButton(this, {
      x: 604,
      y: 1760,
      width: 128,
      height: 64,
      label: '구성',
      enabled: !this.isStartingBattle,
      parent: container,
      onClick: () => {
        this.scene.start('DeckBuildScene', {
          session: this.session,
        } satisfies DeckBuildSceneData);
      },
    });

    createMenuButton(this, {
      x: 752,
      y: 1760,
      width: 128,
      height: 64,
      label: '장비',
      enabled: !this.isStartingBattle,
      parent: container,
      onClick: () => {
        this.scene.start('EquipmentScene', {
          session: this.session,
        } satisfies EquipmentSceneData);
      },
    });
    createMenuButton(this, {
      x: 900,
      y: 1760,
      width: 128,
      height: 64,
      label: '성장',
      enabled: !this.isStartingBattle,
      parent: container,
      onClick: () => {
        this.scene.start('GrowthScene', {
          session: this.session,
        } satisfies GrowthSceneData);
      },
    });
    createMenuButton(this, {
      x: 1048,
      y: 1760,
      width: 128,
      height: 64,
      label: '연성',
      enabled: false,
      parent: container,
    });
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
    this.renderStageList();
    this.renderStageDetail();
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

function formatRewards(rewards: StageRewardDefinition): string {
  if (!rewards.enemyCardDrop) {
    return rewards.description;
  }

  const leaderText = rewards.enemyCardDrop.excludeLeader ? 'Leader excluded.' : 'Leader included.';
  return `${rewards.description}\nEnemy card drop ${rewards.enemyCardDrop.chancePercent}%, up to ${rewards.enemyCardDrop.maxCards}. ${leaderText}`;
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

function formatUnlockCondition(condition: StageUnlockCondition, unlocked: boolean): string {
  if (condition.type === 'ALWAYS') {
    return 'Always unlocked.';
  }

  return unlocked ? 'Unlocked.' : `Locked until ${condition.stageId} is cleared.`;
}
