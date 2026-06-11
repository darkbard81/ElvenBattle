import type { Row } from '../board';
import type { AbilityDefinition, EffectScript } from '../effects';
import type { CardDefinition, CardRarity, CardType } from './types';

const CARD_TYPES = ['UNIT', 'TACTIC', 'ONGOING', 'TOKEN'] as const satisfies readonly CardType[];
const CARD_RARITIES = [
  'COMMON',
  'RARE',
  'EPIC',
  'BOSS',
  'TOKEN',
] as const satisfies readonly CardRarity[];
const ROWS = ['FRONT', 'BACK'] as const satisfies readonly Row[];

export class CardDefinitionError extends Error {
  readonly code = 'ERR_CARD_DEFINITION_INVALID';
  readonly detail: Record<string, unknown>;

  constructor(message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CardDefinitionError';
    this.detail = detail;
  }
}

export function parseCardDefinition(input: unknown): CardDefinition {
  const value = assertRecord(input, 'card');
  const cardId = readRequiredString(value, 'cardId');
  const nameKey = readRequiredString(value, 'nameKey');
  const type = readEnum(value, 'type', CARD_TYPES);
  const cost = readNonNegativeInteger(value, 'cost');
  const tags = readStringArray(value, 'tags');
  const abilities = readArray(value, 'abilities').map(parseAbilityDefinition);

  const definition: CardDefinition = {
    cardId,
    nameKey,
    type,
    cost,
    tags,
    abilities,
  };

  const dominanceCost = readOptionalNonNegativeInteger(value, 'dominanceCost');
  const dominanceValue = readOptionalNonNegativeInteger(value, 'dominanceValue');
  const dominanceRequirement = readOptionalNonNegativeInteger(value, 'dominanceRequirement');
  const faction = readOptionalString(value, 'faction');
  const attribute = readOptionalString(value, 'attribute');

  if (dominanceCost !== undefined) {
    definition.dominanceCost = dominanceCost;
  }

  if (dominanceValue !== undefined) {
    definition.dominanceValue = dominanceValue;
  }

  if (dominanceRequirement !== undefined) {
    definition.dominanceRequirement = dominanceRequirement;
  }

  if (faction !== undefined) {
    definition.faction = faction;
  }

  if (attribute !== undefined) {
    definition.attribute = attribute;
  }

  if (hasOwn(value, 'baseAttack')) {
    definition.baseAttack = readNonNegativeInteger(value, 'baseAttack');
  }

  if (hasOwn(value, 'baseHealth')) {
    definition.baseHealth = readNonNegativeInteger(value, 'baseHealth');
  }

  if (
    type === 'UNIT' &&
    (definition.baseAttack === undefined || definition.baseHealth === undefined)
  ) {
    throw new CardDefinitionError('UNIT card requires baseAttack and baseHealth.', { cardId });
  }

  if (hasOwn(value, 'rowRestriction')) {
    definition.rowRestriction = readRowRestriction(value.rowRestriction);
  }

  if (hasOwn(value, 'effectScript')) {
    definition.effectScript = parseEffectScript(value.effectScript);
  }

  if (hasOwn(value, 'rarity')) {
    definition.rarity = readEnum(value, 'rarity', CARD_RARITIES);
  }

  if (hasOwn(value, 'aiHints')) {
    definition.aiHints = assertRecord(value.aiHints, 'aiHints');
  }

  return definition;
}

export function parseCardDefinitions(input: unknown): CardDefinition[] {
  if (!Array.isArray(input)) {
    throw new CardDefinitionError('Card definition list must be an array.');
  }

  return input.map((definition) => parseCardDefinition(definition));
}

function assertRecord(input: unknown, field: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new CardDefinitionError(`${field} must be an object.`, { field });
  }

  return input as Record<string, unknown>;
}

function readRequiredString(value: Record<string, unknown>, key: string): string {
  const fieldValue = value[key];

  if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
    throw new CardDefinitionError(`${key} must be a non-empty string.`, { key });
  }

  return fieldValue;
}

function readOptionalString(value: Record<string, unknown>, key: string): string | undefined {
  if (!hasOwn(value, key)) {
    return undefined;
  }

  const fieldValue = value[key];

  if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
    throw new CardDefinitionError(`${key} must be a non-empty string.`, { key });
  }

  return fieldValue;
}

function readNonNegativeInteger(value: Record<string, unknown>, key: string): number {
  const fieldValue = value[key];

  if (!Number.isInteger(fieldValue) || (fieldValue as number) < 0) {
    throw new CardDefinitionError(`${key} must be a non-negative integer.`, { key });
  }

  return fieldValue as number;
}

function readOptionalNonNegativeInteger(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  if (hasOwn(value, key)) {
    return readNonNegativeInteger(value, key);
  }

  return undefined;
}

function readEnum<TValue extends string>(
  value: Record<string, unknown>,
  key: string,
  allowedValues: readonly TValue[],
): TValue {
  const fieldValue = value[key];

  if (typeof fieldValue !== 'string' || !allowedValues.includes(fieldValue as TValue)) {
    throw new CardDefinitionError(`${key} has an unsupported value.`, {
      key,
      allowedValues,
      actualValue: fieldValue,
    });
  }

  return fieldValue as TValue;
}

function readArray(value: Record<string, unknown>, key: string): unknown[] {
  const fieldValue = value[key];

  if (!Array.isArray(fieldValue)) {
    throw new CardDefinitionError(`${key} must be an array.`, { key });
  }

  return fieldValue;
}

function readStringArray(value: Record<string, unknown>, key: string): string[] {
  const fieldValue = readArray(value, key);

  if (!fieldValue.every((item) => typeof item === 'string')) {
    throw new CardDefinitionError(`${key} must contain only strings.`, { key });
  }

  return fieldValue;
}

function readRowRestriction(input: unknown): Row[] | 'ANY' {
  if (input === 'ANY') {
    return input;
  }

  if (!Array.isArray(input) || !input.every((row) => ROWS.includes(row as Row))) {
    throw new CardDefinitionError('rowRestriction must be ANY or row array.', {
      allowedValues: ['ANY', ...ROWS],
    });
  }

  return input as Row[];
}

function parseAbilityDefinition(input: unknown): AbilityDefinition {
  const value = assertRecord(input, 'ability');
  const abilityId = readRequiredString(value, 'abilityId');
  const ability: AbilityDefinition = { abilityId };
  const textKey = readOptionalString(value, 'textKey');
  const trigger = readOptionalString(value, 'trigger');

  if (textKey !== undefined) {
    ability.textKey = textKey;
  }

  if (trigger !== undefined) {
    ability.trigger = trigger;
  }

  if (hasOwn(value, 'effectScript')) {
    ability.effectScript = parseEffectScript(value.effectScript);
  }

  return ability;
}

function parseEffectScript(input: unknown): EffectScript {
  const value = assertRecord(input, 'effectScript');
  const script: EffectScript = {
    id: readRequiredString(value, 'id'),
    effect: assertRecord(value.effect, 'effectScript.effect'),
  };
  const trigger = readOptionalString(value, 'trigger');

  if (trigger !== undefined) {
    script.trigger = trigger;
  }

  if (hasOwn(value, 'condition')) {
    script.condition = assertRecord(value.condition, 'effectScript.condition');
  }

  if (hasOwn(value, 'target')) {
    script.target = assertRecord(value.target, 'effectScript.target');
  }

  if (hasOwn(value, 'timing')) {
    script.timing = assertRecord(value.timing, 'effectScript.timing');
  }

  return script;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
