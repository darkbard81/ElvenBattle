import { describe, expect, it } from 'vitest';

import { legalActions, simulateGame } from '../src/ai';
import { findUnitSlot } from '../src/board';
import { applyAction, advanceToFirstPlayablePhase, createPveGame } from '../src/game';
import type { GameAction, MoveUnitPayload, SummonUnitPayload } from '../src/rules';
import { createGameViewModel } from '../src/ui';

describe('Phase14 integration gate', () => {
  it('connects PvE setup, legal actions, board state, logs, and UI view model', () => {
    let state = advanceToFirstPlayablePhase(createPveGame());

    expect(state.gameStatus).toBe('RUNNING');
    expect(state.players.P1?.hand.length).toBeGreaterThan(0);
    expect(state.players.P1?.deck.length).toBeGreaterThan(0);

    const summon = legalActions(state, 'P1').find((candidate) => isSummonAction(candidate.action));

    expect(summon).toBeDefined();

    const summonResult = applyAction(state, summon!.action);

    expect(summonResult.ok).toBe(true);

    state = summonResult.state;

    const summonAction = summon!.action as GameAction<SummonUnitPayload>;
    const summonedId = summonAction.payload.instanceId;
    const summonedSlot = findUnitSlot(state.board, summonedId);

    expect(summonedSlot?.unit).toBe(summonedId);
    expect(state.eventLog.some((event) => event.type === 'UNIT_SUMMONED')).toBe(true);

    const move = legalActions(state, 'P1').find((candidate) => isMoveAction(candidate.action));

    expect(move).toBeDefined();

    const moveResult = applyAction(state, move!.action);

    expect(moveResult.ok).toBe(true);

    state = moveResult.state;

    expect(state.eventLog.some((event) => event.type === 'UNIT_MOVED')).toBe(true);
    expect(state.actionLog.every((entry) => entry.stateHashBefore && entry.stateHashAfter)).toBe(
      true,
    );

    const viewModel = createGameViewModel(state, { viewerId: 'P1' });

    expect(viewModel.boardSlots.some((slot) => slot.unit?.instanceId === summonedId)).toBe(true);
    expect(viewModel.actionLogItems.length).toBeGreaterThan(0);
    expect(viewModel.eventLogItems.length).toBeGreaterThan(0);
  });

  it('finishes intro and boss PvE simulations through the AI public API', () => {
    const intro = simulateGame(createPveGame({ scenarioId: 'pve_intro_duel' }), {
      maxTurns: 30,
      maxActions: 300,
    });
    const boss = simulateGame(createPveGame({ scenarioId: 'pve_boss_trial' }), {
      maxTurns: 30,
      maxActions: 300,
    });

    expect(intro.ok).toBe(true);
    expect(intro.finalState.gameStatus).toBe('FINISHED');
    expect(intro.finalState.eventLog.some((event) => event.type === 'GAME_ENDED')).toBe(true);
    expect(boss.ok).toBe(true);
    expect(boss.finalState.gameStatus).toBe('FINISHED');
    expect(boss.finalState.scenarioState?.bossUnitIds).toContain('boss-trial-vanguard');
  });
});

function isSummonAction(action: GameAction): action is GameAction<SummonUnitPayload> {
  return action.type === 'SUMMON_UNIT';
}

function isMoveAction(action: GameAction): action is GameAction<MoveUnitPayload> {
  return action.type === 'MOVE_UNIT';
}
