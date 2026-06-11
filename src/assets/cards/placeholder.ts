import { CARD_ART_WINDOW } from './layout';
import type { CardDisplayModel } from './types';

export function createPlaceholderPattern(model: CardDisplayModel): string {
  const seed = hashSeed(`${model.cardId}:${model.type}:${model.rarity}`);
  const hueA = seed % 360;
  const hueB = (hueA + 38 + model.type.length * 11) % 360;
  const accent = (hueA + 180) % 360;

  return [
    `<defs>`,
    `<linearGradient id="art-${model.cardId}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="hsl(${hueA} 42% 24%)" />`,
    `<stop offset="1" stop-color="hsl(${hueB} 48% 16%)" />`,
    `</linearGradient>`,
    `<pattern id="pattern-${model.cardId}" width="96" height="96" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`,
    `<rect width="96" height="96" fill="transparent" />`,
    `<path d="M0 48H96" stroke="hsl(${accent} 55% 52%)" stroke-opacity="0.18" stroke-width="8" />`,
    `</pattern>`,
    `</defs>`,
    `<rect x="${CARD_ART_WINDOW.x}" y="${CARD_ART_WINDOW.y}" width="${CARD_ART_WINDOW.width}" height="${CARD_ART_WINDOW.height}" rx="${CARD_ART_WINDOW.cornerRadius}" fill="url(#art-${model.cardId})" />`,
    `<rect x="${CARD_ART_WINDOW.x}" y="${CARD_ART_WINDOW.y}" width="${CARD_ART_WINDOW.width}" height="${CARD_ART_WINDOW.height}" rx="${CARD_ART_WINDOW.cornerRadius}" fill="url(#pattern-${model.cardId})" />`,
  ].join('');
}

function hashSeed(input: string): number {
  let hash = 2166136261;

  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
