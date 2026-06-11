import { describe, expect, it } from 'vitest';
import { createEmptyBoard, createSlotId, type BoardState } from '../src/board';
import type { CardInstance } from '../src/cards';
import type { ZoneRef, ZoneRegistry } from '../src/zones';

describe('zone and board model', () => {
  it('creates a 2x3 board for each player', () => {
    const board: BoardState = createEmptyBoard(['P1', 'P2']);

    expect(board.columns).toBe(3);
    expect(board.rows).toEqual(['FRONT', 'BACK']);
    expect(Object.keys(board.slots)).toHaveLength(12);
    expect(board.slots[createSlotId('P1', 'FRONT', 0)]).toEqual({
      slotId: 'P1:FRONT:0',
      ownerSide: 'P1',
      row: 'FRONT',
      column: 0,
      unit: null,
    });
  });

  it('models zone references and registry independently from player zone arrays', () => {
    const handRef: ZoneRef = {
      type: 'HAND',
      ownerId: 'P1',
    };

    const instance: CardInstance = {
      instanceId: 'instance-zone-001',
      definitionId: 'unit_model_vanguard',
      ownerId: 'P1',
      controllerId: 'P1',
      currentZone: handRef,
      damage: 0,
      statusEffects: [],
      exhausted: false,
      summonedThisTurn: false,
      temporaryModifiers: [],
      attachedEffects: [],
    };

    const registry: ZoneRegistry = {
      cardInstances: {
        [instance.instanceId]: instance,
      },
      stack: [],
      revealed: {
        P1: [],
      },
      temporary: [],
    };

    expect(registry.cardInstances[instance.instanceId]?.currentZone).toEqual(handRef);
  });
});
