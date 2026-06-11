import Phaser from 'phaser';

import { playAiTurn } from '../ai';
import { hashActionLog, hashEventLog } from '../replay';
import { advanceToFirstPlayablePhase, createPveGame, type PveScenarioId } from '../game';
import type { GameState, PlayerId } from '../core';
import type { ActionTarget } from '../rules';
import {
  createGameLayout,
  createGameViewModel,
  createPhaseButtonAction,
  findUiActionForAttackTarget,
  findUiActionForSlot,
  formatPlayerStatus,
  submitUiAction,
  type BoardSlotViewModel,
  type CardViewModel,
  type GameViewModel,
  type UiSelection,
} from '../ui';
import { CARD_BACK_TEXTURE_KEY, getCardTextureKey } from './boot-scene';

const HUMAN_PLAYER_ID = 'P1';
const AI_PLAYER_ID = 'P2';

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private selected: UiSelection | null = null;
  private errorText = '';
  private scenarioId: PveScenarioId = 'pve_intro_duel';

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.startScenario(this.scenarioId);
  }

  private startScenario(scenarioId: PveScenarioId): void {
    this.scenarioId = scenarioId;
    this.selected = null;
    this.errorText = '';
    this.state = advanceToFirstPlayablePhase(createPveGame({ scenarioId }));
    this.runAiIfNeeded();
    this.render();
  }

  private render(): void {
    this.children.removeAll();
    this.add.rectangle(640, 360, 1280, 720, 0x172026, 1);

    const viewModel = createGameViewModel(this.state, {
      viewerId: HUMAN_PLAYER_ID,
      selected: this.selected,
      maxLogItems: 8,
    });
    const layout = createGameLayout([HUMAN_PLAYER_ID, AI_PLAYER_ID], 1280, 720);

    this.renderStatusPanels(viewModel);
    this.renderBoard(viewModel);
    this.renderHand(viewModel);
    this.renderControls(viewModel);
    this.renderLogPanel(viewModel);

    if (this.errorText.length > 0) {
      this.add.text(928, 294, this.errorText, {
        color: '#fca5a5',
        fixedWidth: layout.controls.width,
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        wordWrap: { width: layout.controls.width },
      });
    }

    if (viewModel.result) {
      this.scene.launch('ResultScene', {
        title: viewModel.result.winner === HUMAN_PLAYER_ID ? 'Victory' : 'Defeat',
        detail: `${viewModel.result.status} / ${viewModel.result.reason}`,
      });
    }
  }

  private renderStatusPanels(viewModel: GameViewModel): void {
    const yByPlayer: Record<PlayerId, number> = {
      [AI_PLAYER_ID]: 28,
      [HUMAN_PLAYER_ID]: 380,
    };

    for (const panel of viewModel.players) {
      const y = yByPlayer[panel.playerId] ?? 28;
      const legalPlayerTarget = viewModel.legalTargets.some(
        (target) => target.type === 'PLAYER' && target.playerId === panel.playerId,
      );
      const background = panel.hasPriority ? 0x244b5a : panel.isActive ? 0x263642 : 0x1f2933;
      const rect = this.add
        .rectangle(184, y + 52, 320, 104, legalPlayerTarget ? 0x5b4f22 : background, 1)
        .setStrokeStyle(2, legalPlayerTarget ? 0xfacc15 : 0x52606d);

      if (legalPlayerTarget) {
        rect.setInteractive({ useHandCursor: true });
        rect.on('pointerup', () =>
          this.submitAttackTarget({
            type: 'PLAYER',
            playerId: panel.playerId,
          }),
        );
      }

      this.add.text(36, y + 16, formatPlayerStatus(panel), {
        color: '#e5e7eb',
        fixedWidth: 292,
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        lineSpacing: 4,
        wordWrap: { width: 292 },
      });
    }
  }

  private renderBoard(viewModel: GameViewModel): void {
    const layout = createGameLayout([HUMAN_PLAYER_ID, AI_PLAYER_ID], 1280, 720);

    for (const slot of viewModel.boardSlots) {
      const rect = layout.boardSlots[slot.slotId];

      if (!rect) {
        continue;
      }

      const fill = slot.isLegalTarget
        ? 0x4f4622
        : slot.ownerSide === HUMAN_PLAYER_ID
          ? 0x243447
          : 0x2d3340;
      const border = slot.isSelected ? 0x60a5fa : slot.isLegalTarget ? 0xfacc15 : 0x64748b;
      const slotRect = this.add
        .rectangle(rect.x, rect.y, rect.width, rect.height, fill, 1)
        .setOrigin(0, 0)
        .setStrokeStyle(2, border)
        .setInteractive({ useHandCursor: true });

      slotRect.on('pointerup', () => this.handleSlotClick(slot));
      this.add.text(rect.x + 8, rect.y + 8, `${slot.ownerSide} ${slot.row} ${slot.column + 1}`, {
        color: '#cbd5e1',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
      });

      if (slot.unit) {
        this.renderBoardCard(slot.unit, rect.x + 10, rect.y + 32, slot);
      }
    }
  }

  private renderBoardCard(
    card: CardViewModel,
    x: number,
    y: number,
    slot: BoardSlotViewModel,
  ): void {
    const legalUnitTarget = slot.unit
      ? createGameViewModel(this.state, {
          viewerId: HUMAN_PLAYER_ID,
          selected: this.selected,
        }).legalTargets.some(
          (target) => target.type === 'UNIT' && target.unitId === slot.unit?.instanceId,
        )
      : false;
    const cardRect = this.add
      .rectangle(x, y, 112, 112, legalUnitTarget ? 0x6b4f1d : 0x111827, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, legalUnitTarget ? 0xfacc15 : 0x94a3b8)
      .setInteractive({ useHandCursor: true });

    cardRect.on('pointerup', () => {
      if (legalUnitTarget) {
        this.submitAttackTarget({ type: 'UNIT', unitId: card.instanceId });
        return;
      }

      if (card.controllerId === HUMAN_PLAYER_ID) {
        this.selected = { type: 'BOARD_UNIT', unitId: card.instanceId };
        this.render();
      }
    });

    this.addCardImage(card, x + 6, y + 6, 100, 100);

    this.add.text(x + 8, y + 8, card.name, {
      color: card.exhausted ? '#94a3b8' : '#f8fafc',
      fixedWidth: 96,
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      wordWrap: { width: 96 },
    });
    this.add.text(x + 8, y + 76, this.formatCardNumbers(card), {
      color: '#fde68a',
      fixedWidth: 96,
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
    });
  }

  private renderHand(viewModel: GameViewModel): void {
    this.add.text(28, 142, 'Opponent Hand', {
      color: '#e5e7eb',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
    });
    for (let index = 0; index < viewModel.opponentHandCount; index += 1) {
      const x = 28 + index * 42;
      const y = 170;

      if (this.textures.exists(CARD_BACK_TEXTURE_KEY)) {
        this.add.image(x + 18, y + 26, CARD_BACK_TEXTURE_KEY).setDisplaySize(36, 52);
      } else {
        this.add.rectangle(x, y, 36, 52, 0x0f172a, 1).setOrigin(0, 0);
      }
    }

    this.add.text(28, 500, `Hand / Opponent hand ${viewModel.opponentHandCount}`, {
      color: '#e5e7eb',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    });

    viewModel.hand.forEach((card, index) => {
      const x = 28 + index * 108;
      const y = 532;
      const selected =
        this.selected?.type === 'HAND_CARD' && this.selected.instanceId === card.instanceId;
      const cardRect = this.add
        .rectangle(x, y, 96, 146, selected ? 0x1d4ed8 : 0x111827, 1)
        .setOrigin(0, 0)
        .setStrokeStyle(2, selected ? 0x93c5fd : 0x94a3b8)
        .setInteractive({ useHandCursor: true });

      cardRect.on('pointerup', () => {
        this.selected = { type: 'HAND_CARD', instanceId: card.instanceId };
        this.render();
      });
      this.addCardImage(card, x + 6, y + 6, 84, 126);
      this.add.text(x + 8, y + 10, card.name, {
        color: '#f8fafc',
        fixedWidth: 80,
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        wordWrap: { width: 80 },
      });
      this.add.text(x + 8, y + 104, this.formatCardNumbers(card), {
        color: '#fde68a',
        fixedWidth: 80,
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
      });
    });
  }

  private renderControls(viewModel: GameViewModel): void {
    this.add.text(920, 28, `Scenario ${this.scenarioId} / Phase ${viewModel.phase}`, {
      color: '#f8fafc',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    });
    this.addButton(920, 64, 'End Phase', () => this.submitPhaseAction('END_PHASE'));
    this.addButton(1088, 64, 'End Turn', () => this.submitPhaseAction('END_TURN'));
    this.addButton(920, 116, 'Intro Duel', () => this.startScenario('pve_intro_duel'));
    this.addButton(1088, 116, 'Boss Trial', () => this.startScenario('pve_boss_trial'));
    this.addButton(920, 168, 'Clear Selection', () => {
      this.selected = null;
      this.render();
    });
  }

  private renderLogPanel(viewModel: GameViewModel): void {
    this.add.text(920, 340, 'Debug Log', {
      color: '#f8fafc',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    });
    this.add.text(
      920,
      368,
      [
        `actionHash ${hashActionLog(this.state.actionLog)}`,
        `eventHash ${hashEventLog(this.state.eventLog)}`,
        ...viewModel.eventLogItems.map((item) => item.summary),
      ].join('\n'),
      {
        color: '#cbd5e1',
        fixedWidth: 320,
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        lineSpacing: 4,
        wordWrap: { width: 320 },
      },
    );
  }

  private handleSlotClick(slot: BoardSlotViewModel): void {
    const search = findUiActionForSlot(this.state, HUMAN_PLAYER_ID, this.selected, slot.slotId);

    if (search.action) {
      this.submitAction(search.action);
      return;
    }

    if (slot.unit?.controllerId === HUMAN_PLAYER_ID) {
      this.selected = { type: 'BOARD_UNIT', unitId: slot.unit.instanceId };
      this.errorText = '';
      this.render();
      return;
    }

    this.errorText = 'No legal action for that slot.';
    this.render();
  }

  private submitAttackTarget(target: ActionTarget): void {
    const search = findUiActionForAttackTarget(this.state, HUMAN_PLAYER_ID, this.selected, target);

    if (!search.action) {
      this.errorText = 'No legal attack for that target.';
      this.render();
      return;
    }

    this.submitAction(search.action);
  }

  private submitPhaseAction(type: 'END_PHASE' | 'END_TURN'): void {
    this.submitAction(createPhaseButtonAction(this.state, HUMAN_PLAYER_ID, type));
  }

  private submitAction(action: Parameters<typeof submitUiAction>[1]): void {
    const submitted = submitUiAction(this.state, action);

    if (!submitted.result.ok) {
      this.errorText = submitted.result.errorCodes.join(', ');
      this.render();
      return;
    }

    this.state = advanceToFirstPlayablePhase(submitted.state);
    this.selected = null;
    this.errorText = '';
    this.runAiIfNeeded();
    this.render();
  }

  private runAiIfNeeded(): void {
    while (
      this.state.gameStatus === 'RUNNING' &&
      this.state.priorityPlayerId === AI_PLAYER_ID &&
      this.state.players[AI_PLAYER_ID]?.kind === 'AI'
    ) {
      const result = playAiTurn(this.state, AI_PLAYER_ID, { maxActionsPerTurn: 12 });

      if (!result.ok) {
        this.errorText = result.errors.join(', ');
        this.state = result.finalState;
        return;
      }

      this.state = advanceToFirstPlayablePhase(result.finalState);
    }
  }

  private addButton(x: number, y: number, label: string, onClick: () => void): void {
    const button = this.add
      .text(x, y, label, {
        backgroundColor: '#334155',
        color: '#f8fafc',
        fixedWidth: 144,
        fixedHeight: 36,
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        padding: { x: 12, y: 9 },
      })
      .setInteractive({ useHandCursor: true });

    button.on('pointerup', onClick);
  }

  private addCardImage(
    card: CardViewModel,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const textureKey = getCardTextureKey(card.cardId);

    if (!this.textures.exists(textureKey)) {
      return;
    }

    this.add
      .image(x + width / 2, y + height / 2, textureKey)
      .setDisplaySize(width, height)
      .setAlpha(card.exhausted ? 0.55 : 0.82);
  }

  private formatCardNumbers(card: CardViewModel): string {
    return card.runtimeNumbers
      .filter((number) => number.value !== null)
      .map((number) => `${number.field}:${number.value}`)
      .join(' ');
  }
}
