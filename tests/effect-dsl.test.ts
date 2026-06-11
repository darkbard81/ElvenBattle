import { describe, expect, it } from 'vitest';
import { executeEffectScript, getModifiedAttack } from '../src/effects';
import { createEffectState } from './phase8-helpers';

describe('effect dsl', () => {
  it('damages units and players, heals units and players, applies status, and modifies attack', () => {
    const state = createEffectState();
    const damagedUnit = executeEffectScript(
      state,
      {
        id: 'damage-unit',
        effect: { type: 'DAMAGE', amount: 1, target: 'SAME_COLUMN_ENEMY_FRONT' },
      },
      { sourceId: 'effect-source', controllerId: 'P1' },
    );
    expect(damagedUnit.state.zones.cardInstances['effect-target']?.damage).toBe(1);

    const damagedPlayer = executeEffectScript(
      damagedUnit.state,
      {
        id: 'damage-player',
        effect: { type: 'DAMAGE', amount: 1, target: 'ENEMY_PLAYER' },
      },
      { sourceId: 'effect-source', controllerId: 'P1' },
    );
    expect(damagedPlayer.state.players.P2?.hp).toBe(29);

    const healedUnit = executeEffectScript(
      damagedPlayer.state,
      {
        id: 'heal-unit',
        effect: { type: 'HEAL', amount: 1, target: 'SAME_COLUMN_ENEMY_FRONT' },
      },
      { sourceId: 'effect-source', controllerId: 'P1' },
    );
    expect(healedUnit.state.zones.cardInstances['effect-target']?.damage).toBe(0);

    const healedPlayer = executeEffectScript(
      {
        ...healedUnit.state,
        players: {
          ...healedUnit.state.players,
          P1: { ...healedUnit.state.players.P1!, hp: 20 },
        },
      },
      {
        id: 'heal-player',
        effect: { type: 'HEAL', amount: 20, target: 'CONTROLLER' },
      },
      { sourceId: 'effect-source', controllerId: 'P1' },
    );
    expect(healedPlayer.state.players.P1?.hp).toBe(30);

    const statusApplied = executeEffectScript(
      healedPlayer.state,
      {
        id: 'status',
        effect: {
          type: 'APPLY_STATUS',
          status: 'STUNNED',
          target: 'SAME_COLUMN_ENEMY_FRONT',
          expiresAt: { type: 'END_OF_TURN' },
        },
      },
      { sourceId: 'effect-source', controllerId: 'P1' },
    );
    expect(statusApplied.state.zones.cardInstances['effect-target']?.statusEffects[0]?.type).toBe(
      'STUNNED',
    );

    const modified = executeEffectScript(
      statusApplied.state,
      {
        id: 'attack-up',
        effect: {
          type: 'MODIFY_STAT',
          stat: 'ATTACK',
          amount: 2,
          target: 'SELF',
          expiresAt: { type: 'END_OF_TURN' },
        },
      },
      { sourceId: 'effect-source', controllerId: 'P1' },
    );
    expect(getModifiedAttack(modified.state, 'effect-source')).toBe(4);
  });
});
