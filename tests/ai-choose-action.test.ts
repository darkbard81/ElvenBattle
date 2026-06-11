import { describe, expect, it } from 'vitest';

import { createSlotId } from '../src/board';
import { chooseAction } from '../src/ai';
import { addBoardUnit, createPhase6State } from './phase6-helpers';

describe('AI action choice', () => {
  it('chooses deterministically from the same state', () => {
    const state = createPhase6State({ phase: 'END' });
    const first = chooseAction(state, 'P1');
    const second = chooseAction(state, 'P1');

    expect(first.action).toEqual(second.action);
  });

  it('chooses lethal attack over ending the phase', () => {
    const attackerState = addBoardUnit(
      createPhase6State({
        phase: 'COMBAT',
        players: {
          ...createPhase6State().players,
          P2: {
            ...createPhase6State().players.P2!,
            hp: 2,
          },
        },
      }),
      'attacker',
      'unit_basic_vanguard',
      createSlotId('P1', 'FRONT', 0),
    );
    const decision = chooseAction(attackerState, 'P1');

    expect(decision.action?.type).toBe('ATTACK');
    expect(decision.action).not.toBeNull();
    expect(JSON.stringify(decision.action?.payload)).toContain('"type":"PLAYER"');
  });
});
