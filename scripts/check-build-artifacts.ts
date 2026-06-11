import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { validateCardAssetManifest, type CardAssetManifest } from '../src/assets/cards';

export interface BuildArtifactBudget {
  mainJsBytes: number;
  totalJsBytes: number;
  totalCssBytes: number;
  manifestBytes: number;
}

export interface BuildArtifactCheckOptions {
  rootDir?: string;
  distDir?: string;
  manifestPath?: string;
  budgets?: BuildArtifactBudget;
}

export interface BuildArtifactCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  files: string[];
  sizes: {
    mainJsBytes: number;
    totalJsBytes: number;
    totalCssBytes: number;
    manifestBytes: number;
  };
}

export const DEFAULT_BUILD_ARTIFACT_BUDGET: BuildArtifactBudget = {
  mainJsBytes: 1_500_000,
  totalJsBytes: 2_500_000,
  totalCssBytes: 250_000,
  manifestBytes: 2_000_000,
};

export function checkBuildArtifacts(
  options: BuildArtifactCheckOptions = {},
): BuildArtifactCheckResult {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const distDir = resolve(rootDir, options.distDir ?? 'dist');
  const manifestPath = resolve(rootDir, options.manifestPath ?? 'generated/cards/manifest.json');
  const budgets = options.budgets ?? DEFAULT_BUILD_ARTIFACT_BUDGET;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(distDir)) {
    errors.push(`missing dist directory: ${distDir}`);
  }

  const indexPath = join(distDir, 'index.html');

  if (!existsSync(indexPath)) {
    errors.push(`missing dist/index.html: ${indexPath}`);
  }

  const files = existsSync(distDir)
    ? listFiles(distDir).map((file) => file.slice(distDir.length + 1))
    : [];
  const jsFiles = files.filter((file) => file.endsWith('.js'));
  const cssFiles = files.filter((file) => file.endsWith('.css'));
  const mainJsBytes = Math.max(0, ...jsFiles.map((file) => statSync(join(distDir, file)).size));
  const totalJsBytes = sumSizes(distDir, jsFiles);
  const totalCssBytes = sumSizes(distDir, cssFiles);

  if (jsFiles.length === 0) {
    errors.push('missing JavaScript build asset');
  }

  if (cssFiles.length === 0) {
    warnings.push('missing CSS build asset');
  }

  if (!existsSync(manifestPath)) {
    errors.push(`missing card asset manifest: ${manifestPath}`);
  }

  const manifestBytes = existsSync(manifestPath) ? statSync(manifestPath).size : 0;

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CardAssetManifest;

    if (!validateCardAssetManifest(manifest)) {
      errors.push('invalid card asset manifest shape');
    }

    for (const entry of manifest.cards) {
      if (!existsSync(resolve(rootDir, entry.webpPath))) {
        errors.push(`missing card webp asset: ${entry.webpPath}`);
      }

      if (!existsSync(resolve(rootDir, entry.svgPath))) {
        errors.push(`missing card svg asset: ${entry.svgPath}`);
      }
    }
  }

  if (mainJsBytes > budgets.mainJsBytes) {
    errors.push(`main JS chunk ${mainJsBytes} bytes exceeds budget ${budgets.mainJsBytes}`);
  }

  if (totalJsBytes > budgets.totalJsBytes) {
    errors.push(`total JS ${totalJsBytes} bytes exceeds budget ${budgets.totalJsBytes}`);
  }

  if (totalCssBytes > budgets.totalCssBytes) {
    errors.push(`total CSS ${totalCssBytes} bytes exceeds budget ${budgets.totalCssBytes}`);
  }

  if (manifestBytes > budgets.manifestBytes) {
    errors.push(`manifest ${manifestBytes} bytes exceeds budget ${budgets.manifestBytes}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    files,
    sizes: {
      mainJsBytes,
      totalJsBytes,
      totalCssBytes,
      manifestBytes,
    },
  };
}

export function formatBuildArtifactCheckResult(result: BuildArtifactCheckResult): string {
  return [
    `build artifacts: ${result.ok ? 'ok' : 'failed'}`,
    `mainJsBytes: ${result.sizes.mainJsBytes}`,
    `totalJsBytes: ${result.sizes.totalJsBytes}`,
    `totalCssBytes: ${result.sizes.totalCssBytes}`,
    `manifestBytes: ${result.sizes.manifestBytes}`,
    ...result.warnings.map((warning) => `warning: ${warning}`),
    ...result.errors.map((error) => `error: ${error}`),
  ].join('\n');
}

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    return stats.isDirectory() ? listFiles(path) : [path];
  });
}

function sumSizes(baseDir: string, files: readonly string[]): number {
  return files.reduce((sum, file) => sum + statSync(join(baseDir, file)).size, 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkBuildArtifacts();

  console.log(formatBuildArtifactCheckResult(result));

  if (!result.ok) {
    process.exitCode = 1;
  }
}
