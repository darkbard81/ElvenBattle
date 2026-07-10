import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SCENES_DIRECTORY = fileURLToPath(new URL('../scenes', import.meta.url));
const DIRECT_WORLD_GAME_OBJECT_SCENES = new Set(['BattlefieldScene.ts']);

type DirectUiCall = {
  factory: 'add' | 'rexUI';
  method: string;
};

/** 지정한 디렉터리 아래의 모든 Scene 구현 파일을 재귀적으로 수집한다. */
function listSceneFiles(directory = SCENES_DIRECTORY): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listSceneFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('Scene.ts') ? [entryPath] : [];
    })
    .sort();
}

/** Scene 파일을 검사 기준 디렉터리에서 시작하는 POSIX 상대 경로로 변환한다. */
function toSceneRelativePath(filePath: string, directory = SCENES_DIRECTORY): string {
  return path.relative(directory, filePath).split(path.sep).join('/');
}

/** TypeScript 소스에서 Scene의 직접 GameObject 및 rexUI 생성 호출을 찾는다. */
function listDirectUiCallsFromSource(sourceText: string, filePath: string): DirectUiCall[] {
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

/** Scene 파일을 읽어 직접 UI 생성 호출을 반환한다. */
function listDirectUiCalls(filePath: string): DirectUiCall[] {
  return listDirectUiCallsFromSource(fs.readFileSync(filePath, 'utf8'), filePath);
}

describe('Canvas UI architecture boundary', () => {
  it('keeps direct world GameObject exceptions mapped to existing scenes', () => {
    const scenePaths = new Set(listSceneFiles().map((filePath) => toSceneRelativePath(filePath)));
    expect(
      [...DIRECT_WORLD_GAME_OBJECT_SCENES].filter((filePath) => !scenePaths.has(filePath)),
    ).toEqual([]);
  });

  it('keeps factory-only scenes behind CanvasUiFactory', () => {
    for (const filePath of listSceneFiles()) {
      const relativePath = toSceneRelativePath(filePath);
      if (DIRECT_WORLD_GAME_OBJECT_SCENES.has(relativePath)) continue;
      expect(listDirectUiCalls(filePath), relativePath).toEqual([]);
    }
  });

  it('forbids direct rexUI and Text factories in every scene', () => {
    for (const filePath of listSceneFiles()) {
      const directCalls = listDirectUiCalls(filePath);
      expect(
        directCalls.filter((call) => call.factory === 'rexUI' || call.method === 'text'),
        toSceneRelativePath(filePath),
      ).toEqual([]);
    }
  });

  it('detects direct rexUI calls in presentation scene source', () => {
    const directCalls = listDirectUiCallsFromSource(
      'class ProbeScene { create() { this.rexUI.add.sizer(); } }',
      'ProbeScene.ts',
    );

    expect(directCalls).toContainEqual({ factory: 'rexUI', method: 'sizer' });
  });

  it('collects and inspects nested Scene files recursively', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elven-battle-ui-boundary-'));
    try {
      const nestedDirectory = path.join(temporaryRoot, 'menus');
      const nestedScenePath = path.join(nestedDirectory, 'NestedScene.ts');
      fs.mkdirSync(nestedDirectory);
      fs.writeFileSync(path.join(temporaryRoot, 'RootScene.ts'), 'export class RootScene {}');
      fs.writeFileSync(
        nestedScenePath,
        'export class NestedScene { create() { this.rexUI.add.sizer(); } }',
      );
      fs.writeFileSync(path.join(nestedDirectory, 'helper.ts'), 'export const helper = true;');

      expect(
        listSceneFiles(temporaryRoot).map((filePath) =>
          toSceneRelativePath(filePath, temporaryRoot),
        ),
      ).toEqual(['RootScene.ts', 'menus/NestedScene.ts']);
      expect(listDirectUiCalls(nestedScenePath)).toContainEqual({
        factory: 'rexUI',
        method: 'sizer',
      });
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
