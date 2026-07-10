import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SCENES_DIRECTORY = fileURLToPath(new URL('../scenes', import.meta.url));
const PRESENTATION_ONLY_SCENES = new Set([
  'DeckBuildScene.ts',
  'EquipmentScene.ts',
  'GrowthScene.ts',
  'LoaderScene.ts',
  'MainMenuScene.ts',
  'SaveSlotScene.ts',
  'StageScene.ts',
  'TitleScene.ts',
]);

type DirectUiCall = {
  factory: 'add' | 'rexUI';
  method: string;
};

function listSceneFiles(): string[] {
  return fs
    .readdirSync(SCENES_DIRECTORY)
    .filter((fileName) => fileName.endsWith('Scene.ts'))
    .map((fileName) => path.join(SCENES_DIRECTORY, fileName));
}

function listDirectUiCalls(filePath: string): DirectUiCall[] {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const calls: DirectUiCall[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const owner = node.expression.expression;
      if (
        ts.isPropertyAccessExpression(owner) &&
        owner.expression.kind === ts.SyntaxKind.ThisKeyword &&
        owner.name.text === 'add'
      ) {
        calls.push({ factory: 'add', method });
      }
      if (
        ts.isPropertyAccessExpression(owner) &&
        owner.name.text === 'add' &&
        ts.isPropertyAccessExpression(owner.expression) &&
        owner.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
        owner.expression.name.text === 'rexUI'
      ) {
        calls.push({ factory: 'rexUI', method });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}

describe('Canvas UI architecture boundary', () => {
  it('keeps presentation-only scenes behind CanvasUiFactory', () => {
    for (const filePath of listSceneFiles()) {
      const fileName = path.basename(filePath);
      if (!PRESENTATION_ONLY_SCENES.has(fileName)) continue;
      expect(listDirectUiCalls(filePath), fileName).toEqual([]);
    }
  });

  it('forbids direct rexUI and Text factories in every scene', () => {
    for (const filePath of listSceneFiles()) {
      const directCalls = listDirectUiCalls(filePath);
      expect(
        directCalls.filter((call) => call.factory === 'rexUI' || call.method === 'text'),
        path.basename(filePath),
      ).toEqual([]);
    }
  });
});
