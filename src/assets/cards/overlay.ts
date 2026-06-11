import type { CardDefinition } from '../../cards';
import type { CardRuntimeNumberSlot } from './types';

const DEFAULT_FONT_KEY = 'card-runtime-number';

const BASE_RUNTIME_NUMBER_SLOTS: Record<CardRuntimeNumberSlot['field'], CardRuntimeNumberSlot> = {
  COST: {
    field: 'COST',
    x: 146,
    y: 142,
    anchor: 'CENTER',
    align: 'CENTER',
    fontKey: DEFAULT_FONT_KEY,
    maxDigits: 2,
  },
  DOMINANCE_COST: {
    field: 'DOMINANCE_COST',
    x: 58,
    y: 560,
    anchor: 'CENTER',
    align: 'CENTER',
    fontKey: DEFAULT_FONT_KEY,
    maxDigits: 2,
  },
  DOMINANCE_VALUE: {
    field: 'DOMINANCE_VALUE',
    x: 966,
    y: 560,
    anchor: 'CENTER',
    align: 'CENTER',
    fontKey: DEFAULT_FONT_KEY,
    maxDigits: 2,
  },
  DOMINANCE_REQUIREMENT: {
    field: 'DOMINANCE_REQUIREMENT',
    x: 512,
    y: 138,
    anchor: 'CENTER',
    align: 'CENTER',
    fontKey: DEFAULT_FONT_KEY,
    maxDigits: 2,
  },
  ATTACK: {
    field: 'ATTACK',
    x: 158,
    y: 1320,
    anchor: 'CENTER',
    align: 'CENTER',
    fontKey: DEFAULT_FONT_KEY,
    maxDigits: 3,
  },
  HEALTH: {
    field: 'HEALTH',
    x: 866,
    y: 1320,
    anchor: 'CENTER',
    align: 'CENTER',
    fontKey: DEFAULT_FONT_KEY,
    maxDigits: 3,
  },
};

export function createRuntimeNumberSlots(definition: CardDefinition): CardRuntimeNumberSlot[] {
  const slots: CardRuntimeNumberSlot[] = [BASE_RUNTIME_NUMBER_SLOTS.COST];

  if ((definition.dominanceCost ?? 0) > 0) {
    slots.push(BASE_RUNTIME_NUMBER_SLOTS.DOMINANCE_COST);
  }

  if ((definition.dominanceValue ?? 0) > 0) {
    slots.push(BASE_RUNTIME_NUMBER_SLOTS.DOMINANCE_VALUE);
  }

  if (definition.dominanceRequirement !== undefined) {
    slots.push(BASE_RUNTIME_NUMBER_SLOTS.DOMINANCE_REQUIREMENT);
  }

  if (definition.type === 'UNIT') {
    slots.push(BASE_RUNTIME_NUMBER_SLOTS.ATTACK, BASE_RUNTIME_NUMBER_SLOTS.HEALTH);
  }

  return slots.map((slot) => ({ ...slot }));
}

export function getRuntimeNumberSlot(
  slots: readonly CardRuntimeNumberSlot[],
  field: CardRuntimeNumberSlot['field'],
): CardRuntimeNumberSlot | undefined {
  return slots.find((slot) => slot.field === field);
}
