import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CardAssetManifest } from '../src/assets/cards';

describe('Phase 9 card asset pipeline', () => {
  it('generates WebP base assets and a deterministic manifest for example cards', () => {
    const outputDir = path.join('generated', 'cards-test');

    execFileSync('npm', ['run', 'generate:cards', '--', '--out', outputDir], {
      stdio: 'pipe',
    });
    execFileSync('npm', ['run', 'generate:cards:check', '--', '--out', outputDir], {
      stdio: 'pipe',
    });

    const manifestPath = path.join(outputDir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CardAssetManifest;

    expect(manifest.generatedAtPolicy).toBe('OMITTED_FOR_DETERMINISM');
    expect(manifest.cards.map((card) => card.cardId)).toEqual(
      [...manifest.cards.map((card) => card.cardId)].sort(),
    );
    expect(manifest.cards.length).toBeGreaterThan(0);

    for (const card of manifest.cards) {
      expect(existsSync(path.join(outputDir, `${card.cardId}.webp`))).toBe(true);
      expect(existsSync(path.join(outputDir, `${card.cardId}.svg`))).toBe(true);
      expect(card.runtimeNumberSlots.some((slot) => slot.field === 'COST')).toBe(true);
      expect(card.skillTextOverlay.backgroundAlpha).toBeGreaterThan(0);
    }
  });
});
