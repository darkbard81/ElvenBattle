import { describe, expect, it } from 'vitest';
import { createUnitDestroyedEvent } from '../src/events';
import {
  checkWinConditions,
  evaluateTurnLimitWinCondition,
  getDominanceObjectiveProgressKey,
} from '../src/game';
import { addBoardUnit, createPhase6State } from './phase6-helpers';
import { createTestGameState } from './helpers/game-state';

describe('win conditions', () => {
  it('detects single and simultaneous HP defeat deterministically', () => {
    const p2Defeated = createTestGameState({
      players: {
        ...createTestGameState().players,
        P2: { ...createTestGameState().players.P2!, hp: 0 },
      },
    });
    expect(checkWinConditions(p2Defeated)).toMatchObject({
      winner: 'P1',
      loser: 'P2',
      reason: 'OPPONENT_HP_ZERO',
    });

    const bothDefeated = createTestGameState({
      players: {
        ...createTestGameState().players,
        P1: { ...createTestGameState().players.P1!, hp: 0 },
        P2: { ...createTestGameState().players.P2!, hp: 0 },
      },
    });
    expect(checkWinConditions(bothDefeated)).toMatchObject({
      winner: null,
      loser: null,
      reason: 'BOTH_PLAYERS_HP_ZERO',
    });
  });

  it('evaluates turn limit and scenario objectives', () => {
    const turnLimit = evaluateTurnLimitWinCondition(createTestGameState({ turnNumber: 5 }), {
      type: 'TURN_LIMIT',
      maxTurns: 5,
      result: 'WIN',
    });
    expect(turnLimit).toMatchObject({ winner: 'P1', reason: 'TURN_LIMIT' });

    const bossState = addBoardUnit(createPhase6State(), 'boss-1', 'unit_basic_vanguard');
    const destroyedEvent = createUnitDestroyedEvent(bossState, 'boss-1', 'EFFECT');
    expect(
      checkWinConditions({
        ...bossState,
        eventLog: [destroyedEvent],
        scenarioState: {
          scenarioId: 'boss-test',
          version: '1',
          objectiveState: {},
          winConditions: [{ type: 'BOSS_DEFEATED', bossUnitId: 'boss-1', winnerId: 'P1' }],
        },
      }),
    ).toMatchObject({ winner: 'P1', reason: 'BOSS_DEFEATED' });

    expect(
      checkWinConditions({
        ...createTestGameState(),
        scenarioState: {
          scenarioId: 'puzzle-test',
          version: '1',
          objectiveState: {},
          objectives: {
            objectiveA: { objectiveId: 'objectiveA', completed: true },
          },
          winConditions: [{ type: 'PUZZLE_OBJECTIVE', objectiveId: 'objectiveA', winnerId: 'P1' }],
        },
      }),
    ).toMatchObject({ winner: 'P1', reason: 'PUZZLE_OBJECTIVE' });
  });

  it('evaluates dominance objectives with deterministic progress state', () => {
    const condition = {
      type: 'DOMINANCE_OBJECTIVE',
      playerId: 'P1',
      threshold: 3,
      turns: 2,
    } as const;
    const progressKey = getDominanceObjectiveProgressKey(condition);
    const state = createTestGameState({
      players: {
        ...createTestGameState().players,
        P1: {
          ...createTestGameState().players.P1!,
          dominance: { ...createTestGameState().players.P1!.dominance, boardValue: 3 },
        },
      },
      scenarioState: {
        scenarioId: 'dominance-test',
        version: '1',
        objectiveState: { [progressKey]: 2 },
        winConditions: [condition],
      },
    });

    expect(checkWinConditions(state)).toMatchObject({
      winner: 'P1',
      reason: 'DOMINANCE_OBJECTIVE',
    });
  });
});
