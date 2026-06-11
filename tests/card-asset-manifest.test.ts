import { describe, expect, it } from 'vitest';
import basicUnit from '../card-data/examples/basic-unit.example.json';
import { parseCardDefinition } from '../src/cards';
import {
  createCardAssetManifest,
  createCardAssetManifestEntry,
  createCardDisplayModel,
  hashText,
  stableStringify,
  validateCardAssetManifest,
} from '../src/assets/cards';

describe('Phase 9 card asset manifest', () => {
  it('creates deterministic sorted manifest entries', () => {
    const model = createCardDisplayModel(parseCardDefinition(basicUnit));
    const entry = createCardAssetManifestEntry(model, {
      sourceHash: 'source-hash',
      assetHash: 'asset-hash',
      webpPath: `generated/cards/${model.cardId}.webp`,
      svgPath: `generated/cards/${model.cardId}.svg`,
    });
    const manifest = createCardAssetManifest([entry], {
      cardDataVersion: 'card-data-test',
      rendererVersion: 'renderer-test',
    });

    expect(manifest.generatedAtPolicy).toBe('OMITTED_FOR_DETERMINISM');
    expect(manifest.cards[0]?.cardId).toBe(model.cardId);
    expect(manifest.cards[0]?.width).toBe(512);
    expect(manifest.cards[0]?.height).toBe(768);
    expect(manifest.cards[0]?.runtimeNumberSlots.length).toBeGreaterThan(0);
    expect(manifest.cards[0]?.skillTextOverlay.backgroundAlpha).toBeGreaterThan(0);
    expect(validateCardAssetManifest(manifest)).toBe(true);
  });

  it('stable stringifies and hashes equivalent records', () => {
    const left = { b: 2, a: { d: 4, c: 3 } };
    const right = { a: { c: 3, d: 4 }, b: 2 };

    expect(stableStringify(left)).toBe(stableStringify(right));
    expect(hashText(stableStringify(left))).toBe(hashText(stableStringify(right)));
  });
});
