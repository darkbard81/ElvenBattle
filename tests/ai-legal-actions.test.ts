import { describe, expect, it } from 'vitest';

import { createSlotId } from '../src/board';
import { legalActions } from '../src/ai';
import { applyAction } from '../src/game';
import { addBoardUnit, addHandCard, createPhase6State } from './phase6-helpers';

describe('AI legal actions', () => {
  it('returns no actions without priority', () => {
    const state = createPhase6State({ priorityPlayerId: 'P2' });

    expect(legalActions(state, 'P1')).toEqual([]);
  });

  it('generates legal MAIN phase summon, move, and end phase actions', () => {
    const withHand = addHandCard(createPhase6State(), 'hand-unit', 'unit_basic_vanguard');
    const state = addBoardUnit(withHand, 'board-unit', 'unit_basic_vanguard');
    const actions = legalActions(state, 'P1');

    expect(actions.some((candidate) => candidate.action.type === 'SUMMON_UNIT')).toBe(true);
    expect(actions.some((candidate) => candidate.action.type === 'MOVE_UNIT')).toBe(true);
    expect(actions.at(-1)?.action.type).toBe('END_PHASE');
    expect(actions.every((candidate) => applyAction(state, candidate.action).ok)).toBe(true);
  });

  it('excludes resource, row restriction, and already moved violations', () => {
    const resourcePoor = addHandCard(
      createPhase6State({
        players: {
          ...createPhase6State().players,
          P1: {
            ...createPhase6State().players.P1!,
            resource: {
              ...createPhase6State().players.P1!.resource,
              current: 0,
            },
          },
        },
      }),
      'hand-unit',
      'unit_basic_vanguard',
    );

    expect(
      legalActions(resourcePoor, 'P1').some((candidate) => candidate.action.type === 'SUMMON_UNIT'),
    ).toBe(false);

    const frontOnlyViolation = addHandCard(
      createPhase6State({
        board: {
          ...createPhase6State().board,
          slots: Object.fromEntries(
            Object.entries(createPhase6State().board.slots).filter(([slotId]) => {
              return !slotId.startsWith('P1:BACK');
            }),
          ) as ReturnType<typeof createPhase6State>['board']['slots'],
        },
      }),
      'back-support',
      'unit_back_support',
    );

    expect(
      legalActions(frontOnlyViolation, 'P1').some(
        (candidate) => candidate.action.type === 'SUMMON_UNIT',
      ),
    ).toBe(false);

    const movedState = addBoardUnit(
      createPhase6State({
        turnState: {
          ...createPhase6State().turnState,
          movedUnitIds: ['moved-unit'],
        },
      }),
      'moved-unit',
      'unit_basic_vanguard',
    );

    expect(
      legalActions(movedState, 'P1').some((candidate) => candidate.action.type === 'MOVE_UNIT'),
    ).toBe(false);
  });

  it('generates legal COMBAT attack actions and excludes protected back row/direct attacks', () => {
    const attackerState = addBoardUnit(
      createPhase6State({ phase: 'COMBAT' }),
      'attacker',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 0),
    );
    const withFrontDefender = addBoardUnit(
      attackerState,
      'front-defender',
      'unit_basic_vanguard',
      createSlotId('P2', 'FRONT', 0),
      'P2',
    );
    const state = addBoardUnit(
      withFrontDefender,
      'back-defender',
      'unit_back_support',
      createSlotId('P2', 'BACK', 0),
      'P2',
    );
    const actions = legalActions(state, 'P1');

    expect(
      actions.some(
        (candidate) =>
          candidate.action.type === 'ATTACK' &&
          JSON.stringify(candidate.action.payload).includes('front-defender'),
      ),
    ).toBe(true);
    expect(
      actions.some(
        (candidate) =>
          candidate.action.type === 'ATTACK' &&
          JSON.stringify(candidate.action.payload).includes('back-defender'),
      ),
    ).toBe(false);
    expect(
      actions.some(
        (candidate) =>
          candidate.action.type === 'ATTACK' &&
          JSON.stringify(candidate.action.payload).includes('"type":"PLAYER"'),
      ),
    ).toBe(false);
    expect(actions.at(-1)?.action.type).toBe('END_PHASE');
  });

  it('generates END_TURN only in END phase', () => {
    const state = createPhase6State({ phase: 'END' });
    const actions = legalActions(state, 'P1');

    expect(actions.map((candidate) => candidate.action.type)).toEqual(['END_TURN']);
  });
});
