import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { parseCardDefinition, type CardDefinition } from '../src/cards';
import {
  CARD_OUTPUT_SIZE,
  CARD_RENDERER_VERSION,
  createCardAssetManifest,
  createCardAssetManifestEntry,
  createCardDisplayModel,
  hashText,
  renderCardSvg,
  stableStringify,
} from '../src/assets/cards';

interface GenerateCardAssetsOptions {
  inputDir: string;
  outputDir: string;
  check: boolean;
}

interface RenderedCardAsset {
  cardId: string;
  svgFileName: string;
  webpFileName: string;
  svg: string;
  webp: Buffer;
  sourceHash: string;
  assetHash: string;
  definition: CardDefinition;
}

const options = readOptions(process.argv.slice(2));
await run(options);

async function run(runOptions: GenerateCardAssetsOptions): Promise<void> {
  const definitions = await readCardDefinitions(runOptions.inputDir);
  const renderedCards = await renderCards(definitions);
  const manifest = createCardAssetManifest(
    renderedCards.map((card) =>
      createCardAssetManifestEntry(createCardDisplayModel(card.definition), {
        sourceHash: card.sourceHash,
        assetHash: card.assetHash,
        svgPath: `generated/cards/${card.svgFileName}`,
        webpPath: `generated/cards/${card.webpFileName}`,
      }),
    ),
    {
      cardDataVersion: hashText(stableStringify(definitions)),
      rendererVersion: CARD_RENDERER_VERSION,
    },
  );
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

  if (runOptions.check) {
    await checkExistingOutputs(runOptions.outputDir, renderedCards, manifestJson);
    return;
  }

  await mkdir(runOptions.outputDir, { recursive: true });

  await Promise.all(
    renderedCards.flatMap((card) => [
      writeFile(path.join(runOptions.outputDir, card.svgFileName), card.svg),
      writeFile(path.join(runOptions.outputDir, card.webpFileName), card.webp),
    ]),
  );

  await writeFile(path.join(runOptions.outputDir, 'manifest.json'), manifestJson);
}

async function readCardDefinitions(inputDir: string): Promise<CardDefinition[]> {
  const fileNames = (await readdir(inputDir))
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();
  const definitions: CardDefinition[] = [];

  for (const fileName of fileNames) {
    const fullPath = path.join(inputDir, fileName);
    const json = JSON.parse(await readFile(fullPath, 'utf8')) as unknown;
    definitions.push(parseCardDefinition(json));
  }

  return definitions.sort((a, b) => a.cardId.localeCompare(b.cardId));
}

async function renderCards(definitions: readonly CardDefinition[]): Promise<RenderedCardAsset[]> {
  const renderedCards: RenderedCardAsset[] = [];

  for (const definition of definitions) {
    const model = createCardDisplayModel(definition);
    const svg = renderCardSvg(model, { usePlaceholderArt: false });
    const webp = await sharp(Buffer.from(svg))
      .resize(CARD_OUTPUT_SIZE.width, CARD_OUTPUT_SIZE.height)
      .webp({ quality: 92 })
      .toBuffer();

    renderedCards.push({
      cardId: definition.cardId,
      svgFileName: `${definition.cardId}.svg`,
      webpFileName: `${definition.cardId}.webp`,
      svg,
      webp,
      sourceHash: hashText(
        stableStringify({ definition, model, rendererVersion: CARD_RENDERER_VERSION }),
      ),
      assetHash: hashBuffer(webp),
      definition,
    });
  }

  return renderedCards;
}

async function checkExistingOutputs(
  outputDir: string,
  renderedCards: readonly RenderedCardAsset[],
  manifestJson: string,
): Promise<void> {
  const mismatches: string[] = [];

  for (const card of renderedCards) {
    await compareTextFile(path.join(outputDir, card.svgFileName), card.svg, mismatches);
    await compareBufferFile(path.join(outputDir, card.webpFileName), card.webp, mismatches);
  }

  await compareTextFile(path.join(outputDir, 'manifest.json'), manifestJson, mismatches);

  if (mismatches.length > 0) {
    throw new Error(`Card asset check failed:\n${mismatches.join('\n')}`);
  }
}

async function compareTextFile(
  filePath: string,
  expected: string,
  mismatches: string[],
): Promise<void> {
  try {
    const actual = await readFile(filePath, 'utf8');

    if (actual !== expected) {
      mismatches.push(`${filePath} differs`);
    }
  } catch {
    mismatches.push(`${filePath} is missing`);
  }
}

async function compareBufferFile(
  filePath: string,
  expected: Buffer,
  mismatches: string[],
): Promise<void> {
  try {
    const actual = await readFile(filePath);

    if (!actual.equals(expected)) {
      mismatches.push(`${filePath} differs`);
    }
  } catch {
    mismatches.push(`${filePath} is missing`);
  }
}

function readOptions(args: readonly string[]): GenerateCardAssetsOptions {
  let inputDir = 'card-data/examples';
  let outputDir = 'generated/cards';
  let check = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--check') {
      check = true;
      continue;
    }

    if (arg === '--input') {
      inputDir = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--out') {
      outputDir = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return {
    inputDir,
    outputDir,
    check,
  };
}

function readOptionValue(args: readonly string[], index: number, optionName: string): string {
  const value = args[index + 1];

  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value.`);
  }

  return value;
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
