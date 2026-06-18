/* global console, process */

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appConfig } from '../config';

const assetsRoot = path.resolve('assets');
const outputFile = path.join(assetsRoot, 'assets.json');
const manifestBase = {
  schemaVersion: 1,
  revisionAlgorithm: 'sha256-12hex',
  assetBaseUrl: appConfig.assets.assetBaseUrl,
};
const textureExtensions = new Set(['.png', '.webp']);

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildKey(filePath: string): string {
  const relativePath = path.relative(assetsRoot, filePath);
  const parts = relativePath.split(path.sep);
  const baseName = path.parse(parts.at(-1) ?? '').name;
  const namespace = parts[0];
  const folderName = parts.slice(1, -1).join('.');

  return folderName ? `${namespace}.${folderName}.${baseName}` : `${namespace}.${baseName}`;
}

async function main(): Promise<void> {
  const textures: Array<{ key: string; path: string; revision: string }> = [];
  const files = await walk(assetsRoot);

  for (const filePath of files) {
    if (filePath === outputFile) {
      continue;
    }

    if (!textureExtensions.has(path.extname(filePath).toLowerCase())) {
      continue;
    }

    const buffer = await readFile(filePath);
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
    const relativePath = path.relative(assetsRoot, filePath).split(path.sep).join('/');

    textures.push({
      key: buildKey(filePath),
      path: relativePath,
      revision: hash,
    });
  }

  textures.sort((left, right) => left.key.localeCompare(right.key));

  const manifestBody = {
    ...manifestBase,
    textures,
  };
  const manifestRevision = createHash('sha256')
    .update(`${JSON.stringify(manifestBody, null, 2)}\n`)
    .digest('hex')
    .slice(0, 12);

  await writeFile(
    outputFile,
    `${JSON.stringify(
      {
        ...manifestBody,
        manifestRevision,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
