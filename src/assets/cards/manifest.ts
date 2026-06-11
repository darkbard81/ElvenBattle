import { CARD_OUTPUT_SIZE, CARD_RENDERER_VERSION } from './layout';
import type { CardAssetManifest, CardAssetManifestEntry, CardDisplayModel } from './types';

export interface CreateCardAssetManifestOptions {
  cardDataVersion: string;
  rendererVersion?: string;
}

export interface CreateCardAssetManifestEntryOptions {
  sourceHash: string;
  assetHash: string;
  webpPath: string;
  svgPath: string;
}

export function createCardAssetManifest(
  entries: readonly CardAssetManifestEntry[],
  options: CreateCardAssetManifestOptions,
): CardAssetManifest {
  return {
    manifestVersion: 1,
    cardDataVersion: options.cardDataVersion,
    rendererVersion: options.rendererVersion ?? CARD_RENDERER_VERSION,
    generatedAtPolicy: 'OMITTED_FOR_DETERMINISM',
    cards: [...entries].sort((a, b) => a.cardId.localeCompare(b.cardId)),
  };
}

export function createCardAssetManifestEntry(
  model: CardDisplayModel,
  options: CreateCardAssetManifestEntryOptions,
): CardAssetManifestEntry {
  return {
    cardId: model.cardId,
    sourceHash: options.sourceHash,
    assetHash: options.assetHash,
    width: CARD_OUTPUT_SIZE.width,
    height: CARD_OUTPUT_SIZE.height,
    webpPath: options.webpPath,
    svgPath: options.svgPath,
    runtimeNumberSlots: model.runtimeNumberSlots.map((slot) => ({ ...slot })),
    skillTextOverlay: { ...model.skillTextOverlay },
  };
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(',')}}`;
}

export function hashText(value: string): string {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function validateCardAssetManifest(manifest: CardAssetManifest): boolean {
  return (
    manifest.manifestVersion === 1 &&
    manifest.generatedAtPolicy === 'OMITTED_FOR_DETERMINISM' &&
    manifest.cards.every(
      (entry) =>
        entry.cardId.length > 0 &&
        entry.sourceHash.length > 0 &&
        entry.assetHash.length > 0 &&
        entry.webpPath.endsWith('.webp') &&
        entry.svgPath.endsWith('.svg') &&
        entry.runtimeNumberSlots.length > 0,
    )
  );
}
