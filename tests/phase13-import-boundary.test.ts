import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RULE_ENGINE_DIRS = [
  'src/core',
  'src/game',
  'src/rules',
  'src/cards',
  'src/zones',
  'src/board',
  'src/dominance',
  'src/battle',
  'src/events',
  'src/effects',
  'src/replay',
  'src/ai',
];

const FORBIDDEN_IMPORT_PATTERN =
  /from ['"].*\/(scenes|ui)['"]|from ['"]phaser['"]|document\.|window\./;

describe('Phase13 import boundary', () => {
  it('keeps rule engine modules independent from UI, scenes, Phaser, and DOM globals', () => {
    const violations = RULE_ENGINE_DIRS.flatMap((dir) => collectTypeScriptFiles(dir))
      .map((file) => ({
        file,
        text: readFileSync(file, 'utf8'),
      }))
      .filter((entry) => FORBIDDEN_IMPORT_PATTERN.test(entry.text))
      .map((entry) => entry.file);

    expect(violations).toEqual([]);
  });
});

function collectTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return collectTypeScriptFiles(path);
    }

    return path.endsWith('.ts') ? [path] : [];
  });
}
