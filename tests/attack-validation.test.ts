import { describe, expect, it } from 'vitest';
import { createSlotId } from '../src/board';
import { validateAttack } from '../src/battle';
import type { AttackPayload, GameAction } from '../src/rules';
import { addBoardUnit } from './phase6-helpers';
import { addFrontCombatants, createPhase7State } from './phase7-helpers';

function attackAction(
  attackerId = 'attacker-1',
  target: AttackPayload['target'] = { type: 'UNIT', unitId: 'defender-1' },
) {
  return {
    actionId: `attack-${attackerId}`,
    playerId: 'P1',
    type: 'ATTACK',
    payload: {
      attackerId,
      target,
    },
  } satisfies GameAction<AttackPayload>;
}

describe('attack validation', () => {
  it('allows same-column front unit attack in COMBAT', () => {
    const state = addFrontCombatants();

    expect(validateAttack(state, attackAction()).ok).toBe(true);
  });

  it('rejects missing, enemy-controlled, already-attacked, exhausted, sick, and status-blocked attackers', () => {
    expect(validateAttack(createPhase7State(), attackAction('missing')).errors[0]?.code).toBe(
      'ERR_ATTACKER_NOT_FOUND',
    );

    const enemyControlled = addFrontCombatants();
    expect(validateAttack(enemyControlled, attackAction('defender-1')).errors[0]?.code).toBe(
      'ERR_ATTACKER_NOT_CONTROLLED',
    );

    const alreadyAttacked = addFrontCombatants(
      createPhase7State({
        turnState: {
          ...createPhase7State().turnState,
          attackedUnitIds: ['attacker-1'],
        },
      }),
    );
    expect(validateAttack(alreadyAttacked, attackAction()).errors[0]?.code).toBe(
      'ERR_ATTACKER_ALREADY_ATTACKED',
    );

    const exhausted = addBoardUnit(
      addBoardUnit(
        createPhase7State(),
        'attacker-1',
        'unit_basic_vanguard',
        createSlotId('P1', 'FRONT', 0),
        'P1',
        {
          exhausted: true,
        },
      ),
      'defender-1',
      'unit_basic_vanguard',
      createSlotId('P2', 'FRONT', 0),
      'P2',
    );
    expect(validateAttack(exhausted, attackAction()).errors[0]?.code).toBe(
      'ERR_ATTACKER_EXHAUSTED',
    );

    const sick = addBoardUnit(
      addBoardUnit(
        createPhase7State(),
        'attacker-1',
        'unit_basic_vanguard',
        createSlotId('P1', 'FRONT', 0),
        'P1',
        {
          summonedThisTurn: true,
        },
      ),
      'defender-1',
      'unit_basic_vanguard',
      createSlotId('P2', 'FRONT', 0),
      'P2',
    );
    expect(validateAttack(sick, attackAction()).errors[0]?.code).toBe('ERR_SUMMONING_SICKNESS');

    const cannotAttack = addBoardUnit(
      addBoardUnit(
        createPhase7State(),
        'attacker-1',
        'unit_basic_vanguard',
        createSlotId('P1', 'FRONT', 0),
        'P1',
        {
          statusEffects: [
            {
              statusId: 'cannot-attack',
              type: 'CANNOT_ATTACK',
              stacks: 1,
              expiresAt: { type: 'END_OF_TURN' },
              visible: true,
            },
          ],
        },
      ),
      'defender-1',
      'unit_basic_vanguard',
      createSlotId('P2', 'FRONT', 0),
      'P2',
    );
    expect(validateAttack(cannotAttack, attackAction()).errors[0]?.code).toBe(
      'ERR_ATTACKER_CANNOT_ATTACK',
    );
  });

  it('enforces back-row protection, same-column targeting, and direct attack blocking', () => {
    const protectedBack = addBoardUnit(
      addBoardUnit(
        addBoardUnit(
          createPhase7State(),
          'attacker-1',
          'unit_basic_vanguard',
          createSlotId('P1', 'FRONT', 0),
          'P1',
        ),
        'front-guard',
        'unit_basic_vanguard',
        createSlotId('P2', 'FRONT', 0),
        'P2',
      ),
      'back-target',
      'unit_back_support',
      createSlotId('P2', 'BACK', 0),
      'P2',
    );

    expect(
      validateAttack(
        protectedBack,
        attackAction('attacker-1', { type: 'UNIT', unitId: 'back-target' }),
      ).errors[0]?.code,
    ).toBe('ERR_TARGET_PROTECTED');

    const differentColumn = addBoardUnit(
      addBoardUnit(
        createPhase7State(),
        'attacker-1',
        'unit_basic_vanguard',
        createSlotId('P1', 'FRONT', 0),
        'P1',
      ),
      'defender-2',
      'unit_basic_vanguard',
      createSlotId('P2', 'FRONT', 1),
      'P2',
    );
    expect(
      validateAttack(
        differentColumn,
        attackAction('attacker-1', { type: 'UNIT', unitId: 'defender-2' }),
      ).errors[0]?.code,
    ).toBe('ERR_TARGET_NOT_ATTACKABLE');

    expect(
      validateAttack(protectedBack, attackAction('attacker-1', { type: 'PLAYER', playerId: 'P2' }))
        .errors[0]?.code,
    ).toBe('ERR_DIRECT_ATTACK_BLOCKED');
  });
});
