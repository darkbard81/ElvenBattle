import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { checkBuildArtifacts } from '../scripts/check-build-artifacts';

describe('Phase14 performance and artifact budget gate', () => {
  it('validates dist files, card manifest, card assets, and byte budgets', () => {
    const rootDir = join(tmpdir(), `elven-battle-phase14-${process.pid}`);
    const distDir = join(rootDir, 'dist');
    const assetDir = join(distDir, 'assets');
    const generatedDir = join(rootDir, 'generated/cards');

    mkdirSync(assetDir, { recursive: true });
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(
      join(distDir, 'index.html'),
      '<script type="module" src="/assets/app.js"></script>',
    );
    writeFileSync(join(assetDir, 'app.js'), 'console.log("phase14");');
    writeFileSync(join(assetDir, 'style.css'), 'body{margin:0;}');
    writeFileSync(join(generatedDir, 'unit_basic_vanguard.webp'), 'webp');
    writeFileSync(join(generatedDir, 'unit_basic_vanguard.svg'), '<svg />');
    writeFileSync(
      join(generatedDir, 'manifest.json'),
      JSON.stringify({
        manifestVersion: 1,
        cardDataVersion: 'test',
        rendererVersion: 'test',
        generatedAtPolicy: 'OMITTED_FOR_DETERMINISM',
        cards: [
          {
            cardId: 'unit_basic_vanguard',
            sourceHash: 'source',
            assetHash: 'asset',
            width: 512,
            height: 768,
            webpPath: 'generated/cards/unit_basic_vanguard.webp',
            svgPath: 'generated/cards/unit_basic_vanguard.svg',
            runtimeNumberSlots: [
              {
                field: 'COST',
                x: 1,
                y: 1,
                anchor: 'CENTER',
                align: 'CENTER',
                fontKey: 'card-runtime-number',
                maxDigits: 2,
              },
            ],
            skillTextOverlay: {
              x: 1,
              y: 1,
              width: 1,
              height: 1,
              padding: 1,
              backgroundColor: '#000000',
              backgroundAlpha: 0.5,
              fontKey: 'card-rules',
              maxLines: 1,
            },
          },
        ],
      }),
    );

    const result = checkBuildArtifacts({
      rootDir,
      budgets: {
        mainJsBytes: 1000,
        totalJsBytes: 1000,
        totalCssBytes: 1000,
        manifestBytes: 3000,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.sizes.mainJsBytes).toBeGreaterThan(0);
    expect(result.files).toContain('index.html');
  });
});
