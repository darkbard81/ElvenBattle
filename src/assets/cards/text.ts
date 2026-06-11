import type { AbilityDefinition, EffectScript } from '../../effects';

export interface CardTextDictionary {
  [key: string]: string;
}

export function resolveDisplayText(
  key: string,
  dictionary: CardTextDictionary = {},
  fallback = key,
): string {
  const value = dictionary[key];

  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  return value;
}

export function resolveAbilityText(
  ability: AbilityDefinition,
  dictionary: CardTextDictionary = {},
): string {
  if (ability.textKey !== undefined) {
    return resolveDisplayText(ability.textKey, dictionary, ability.textKey);
  }

  if (ability.effectScript !== undefined) {
    return createEffectFallbackText(ability.effectScript);
  }

  return ability.abilityId;
}

export function createEffectFallbackText(effectScript: EffectScript): string {
  return effectScript.id;
}

export function wrapDisplayText(text: string, maxLineLength: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;

    if (candidate.length <= maxLineLength) {
      currentLine = candidate;
      continue;
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(word.slice(0, maxLineLength));
      currentLine = word.slice(maxLineLength);
    }

    if (lines.length === maxLines) {
      return lines;
    }
  }

  if (currentLine.length > 0 && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}
