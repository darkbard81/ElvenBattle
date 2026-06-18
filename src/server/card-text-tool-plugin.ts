import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appConfig } from '../config';
import sharp from 'sharp';
import type { Plugin, ViteDevServer } from 'vite';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const assetsRoot = path.join(projectRoot, 'assets');
const assetsManifestPath = path.join(assetsRoot, 'assets.json');
const metaPath = path.join(projectRoot, 'cards/card_frame_meta.json');
const deckPath = path.join(projectRoot, 'cards/deck_test.json');
const schemaPath = path.join(projectRoot, 'cards/card.schema.json');
const artAssetsDir = path.join(assetsRoot, 'cards/arts');
const referenceAssetsDir = path.join(projectRoot, 'cards/reference');
const pendingCaptures = new Map<
  string,
  {
    cardId: string;
    area: TextAreaRegion;
    nameArea: TextAreaRegion;
    artImage: string;
    referenceImage: string;
    artOffsetY: number;
  }
>();

type JsonRecord = Record<string, unknown>;

type AssetsManifest = {
  assetBaseUrl: string;
  textures: Array<{
    key: string;
    path: string;
    revision: string;
  }>;
  manifestRevision: string;
  schemaVersion: number;
  revisionAlgorithm: string;
};

type CanvasMeta = {
  width: number;
  height: number;
};

type TextAreaRegion = {
  type: 'text_area';
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  fill: string;
  opacity: number;
  stroke: string;
  fontFamily: string;
  fontFile: string;
  fontSize: number;
  titleFontSize: number;
  nameColor: string;
  titleColor: string;
  textColor: string;
  textStrokeColor: string;
  textStrokeWidth: number;
  paddingX: number;
  paddingY: number;
  description: string;
};

type FrameMeta = JsonRecord & {
  canvas: CanvasMeta;
  regions: JsonRecord;
  safeAreas?: JsonRecord;
};

type Ability = {
  id: string;
  category: string;
  name: string;
  text: string;
};

type Card = {
  id: string;
  name: string;
  abilities: Ability[];
};

type DeckData = {
  cards: Card[];
};

type CardAssetPaths = {
  png: string;
  webp: string;
};

type SharpMetadata = {
  width?: number;
  height?: number;
};

type SharpPipeline = {
  metadata(): Promise<SharpMetadata>;
  png(): SharpPipeline;
  resize(width: number, height: number): SharpPipeline;
  webp(options: { quality: number }): SharpPipeline;
  toFile(targetPath: string): Promise<unknown>;
};

type SharpFactory = (input: string) => SharpPipeline;

type AssetImage = {
  name: string;
  path: string;
};

type SaveAreaPayload = {
  cardId: string;
  area: TextAreaRegion;
  nameArea: TextAreaRegion;
  artImage?: string;
  referenceImage?: string;
  artOffsetY?: number;
};

const defaultTextArea: TextAreaRegion = {
  type: 'text_area',
  x: 128,
  y: 1010,
  width: 768,
  height: 270,
  cornerRadius: 22,
  fill: '#FFFFFF',
  opacity: 0.62,
  stroke: '#FFFFFF',
  fontFamily: 'D2Coding',
  fontFile: 'fonts/D2CodingBold.ttf',
  fontSize: 31,
  titleFontSize: 31,
  nameColor: '#12351A',
  titleColor: '#7A2D18',
  textColor: '#17251A',
  textStrokeColor: '#DFDFDF',
  textStrokeWidth: 0,
  paddingX: 28,
  paddingY: 24,
  description:
    '카드 능력 텍스트를 배치하는 반투명 흰색 텍스트 영역. 브라우저 편집 도구에서 위치와 크기를 조정한다.',
};

const defaultNameTextArea: TextAreaRegion = {
  ...defaultTextArea,
  x: 253,
  y: 1294,
  width: 518,
  height: 222,
  cornerRadius: 14,
  fill: '#000000',
  opacity: 0.48,
  stroke: '#000000',
  fontSize: 42,
  titleFontSize: 42,
  textColor: '#FFFFFF',
  textStrokeColor: '#222222',
  textStrokeWidth: 2,
  paddingX: 18,
  paddingY: 18,
  description:
    '카드 이름을 하단 중앙 영역에 배치하는 텍스트 영역. 브라우저 편집 도구에서 위치와 크기를 조정한다.',
};

export function cardTextToolPlugin(): Plugin {
  return {
    name: 'card-text-tool',
    configureServer(server: ViteDevServer) {
      registerMiddlewares(server.middlewares);
    },
    configurePreviewServer(server) {
      registerMiddlewares(server.middlewares);
    },
  };
}

function registerMiddlewares(middlewares: ViteDevServer['middlewares']): void {
  middlewares.use((request, response, next) => {
    void (async () => {
      const handled = await handleAssetRequest(request, response, next);
      if (handled) {
        return;
      }

      await handleCardTextToolRequest(request, response, next);
    })().catch((error) => {
      next(error as Error);
    });
  });
}

async function handleAssetRequest(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
): Promise<boolean> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const assetBaseUrl = normalizeAssetBaseUrl(appConfig.assets.assetBaseUrl);

  if (!isAssetRoute(url.pathname, assetBaseUrl)) {
    return false;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.statusCode = 405;
    response.end('Method Not Allowed');
    return true;
  }

  const requestedPath = url.pathname.slice(assetBaseUrl.length).replace(/^\/+/, '');
  if (!requestedPath || requestedPath === 'assets.json') {
    try {
      const manifest = await readAssetsManifest();
      sendJson(response, manifest);
    } catch {
      response.statusCode = 404;
      response.end('Not found');
    }
    return true;
  }

  const filePath = path.resolve(assetsRoot, requestedPath);
  if (!isWithinDirectory(filePath, assetsRoot)) {
    response.statusCode = 403;
    response.end('Forbidden');
    return true;
  }

  try {
    const file = await fs.readFile(filePath);
    response.statusCode = 200;
    response.setHeader('Content-Type', getMimeType(filePath));
    response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    response.end(request.method === 'HEAD' ? undefined : file);
    return true;
  } catch {
    next();
    return true;
  }
}

async function handleCardTextToolRequest(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (!url.pathname.startsWith('/api/card-text-tool/')) {
    next();
    return;
  }

  try {
    if (request.method === 'GET' && url.pathname === '/api/card-text-tool/data') {
      const meta = await readFrameMeta();
      const manifest = await readAssetsManifest();
      const assetBaseUrl = normalizeAssetBaseUrl(manifest.assetBaseUrl);
      const deck = await readJsonFile<DeckData>(deckPath);
      const schema = await readJsonFile<JsonRecord>(schemaPath);
      const artImages = await listAssetImages(artAssetsDir, 'cards/arts');
      const referenceImages = await listAssetImages(referenceAssetsDir, 'cards/reference');
      const requestedCardId = url.searchParams.get('cardId');
      const selectedArtImage =
        selectAssetPath(url.searchParams.get('artImage'), artImages, 'art image', assetBaseUrl) ??
        selectArtImageForCard(requestedCardId, artImages);
      const resolvedCardId = requestedCardId ?? cardIdFromAssetPath(selectedArtImage);
      const card = findCard(deck, resolvedCardId);
      const abilityTitles = getAbilityCategoryTitles(schema);
      const pendingCapture = readPendingCapture(url.searchParams.get('captureId'), card.id);
      const textArea = pendingCapture?.area ?? readTextArea(meta);
      const nameTextArea = pendingCapture?.nameArea ?? readNameTextArea(meta, textArea);
      const selectedReferenceImage =
        pendingCapture?.referenceImage ??
        selectAssetPath(
          url.searchParams.get('referenceImage'),
          referenceImages,
          'reference image',
          assetBaseUrl,
        ) ??
        selectFirstAssetPath(referenceImages, 'reference image');
      const artOffsetY =
        pendingCapture?.artOffsetY ??
        readOptionalInteger(url.searchParams.get('artOffsetY'), readDefaultArtOffsetY(meta));

      sendJson(response, {
        canvas: meta.canvas,
        assetBaseUrl,
        card,
        abilityText: formatAbilityText(card, abilityTitles, textArea),
        nameText: formatNameText(card, nameTextArea),
        textArea,
        nameTextArea,
        artImages,
        referenceImages,
        selectedArtImage,
        selectedReferenceImage,
        artOffsetY,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/card-text-tool/save-area') {
      const payload = validateAreaPayload(await readRequestJson(request));
      const meta = await readFrameMeta();
      meta.regions.ability_text_area = normalizeTextArea(payload.area);
      meta.regions.name_text_area = normalizeTextArea(payload.nameArea, defaultNameTextArea);
      await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

      sendJson(response, {
        savedPath: 'cards/card_frame_meta.json',
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/card-text-tool/generate') {
      const payload = validateAreaPayload(await readRequestJson(request));
      const meta = await readFrameMeta();
      const manifest = await readAssetsManifest();
      const assetBaseUrl = normalizeAssetBaseUrl(manifest.assetBaseUrl);
      const deck = await readJsonFile<DeckData>(deckPath);
      const card = findCard(deck, payload.cardId);
      const area = normalizeTextArea(payload.area);
      const nameArea = normalizeTextArea(payload.nameArea, defaultNameTextArea);
      const artImages = await listAssetImages(artAssetsDir, 'cards/arts');
      const referenceImages = await listAssetImages(referenceAssetsDir, 'cards/reference');
      const artImage =
        selectAssetPath(payload.artImage, artImages, 'art image', assetBaseUrl) ??
        selectArtImageForCard(card.id, artImages);
      const referenceImage =
        selectAssetPath(payload.referenceImage, referenceImages, 'reference image', assetBaseUrl) ??
        selectFirstAssetPath(referenceImages, 'reference image');
      const artOffsetY = toInteger(payload.artOffsetY, readDefaultArtOffsetY(meta));

      const outputCardPath = path.join(projectRoot, `cards/temp/${card.id}_final.png`);

      await renderCardByScreenshot({
        request,
        area,
        nameArea,
        cardId: card.id,
        canvas: meta.canvas,
        outputCardPath,
        artImage,
        referenceImage,
        artOffsetY,
      });

      const outputAssets = await finalizeCardAssets(card.id, outputCardPath);
      await clearTempFiles();

      const outputPath = outputAssets.png;
      sendJson(response, {
        outputPath,
        outputUrl: toAssetUrl(assetBaseUrl, outputPath),
      });
      return;
    }

    response.statusCode = 404;
    response.end('Not found');
  } catch (error) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end(error instanceof Error ? error.message : String(error));
  }
}

async function readJsonFile<T>(targetPath: string): Promise<T> {
  return JSON.parse(await fs.readFile(targetPath, 'utf8')) as T;
}

async function readFrameMeta(): Promise<FrameMeta> {
  return readJsonFile<FrameMeta>(metaPath);
}

async function readAssetsManifest(): Promise<AssetsManifest> {
  return readJsonFile<AssetsManifest>(assetsManifestPath);
}

function readTextArea(meta: FrameMeta): TextAreaRegion {
  const maybeRegion = meta.regions.ability_text_area;
  return normalizeTextArea(isRecord(maybeRegion) ? maybeRegion : defaultTextArea);
}

function readNameTextArea(meta: FrameMeta, abilityArea: TextAreaRegion): TextAreaRegion {
  const maybeRegion = meta.regions.name_text_area;
  if (isRecord(maybeRegion)) {
    return normalizeTextArea(maybeRegion, defaultNameTextArea);
  }

  return {
    ...createNameTextAreaFromSafeArea(meta),
    fontFamily: abilityArea.fontFamily,
    fontFile: abilityArea.fontFile,
  };
}

function readPendingCapture(captureId: string | null, cardId: string) {
  if (!captureId) {
    return null;
  }

  const pendingCapture = pendingCaptures.get(captureId);
  if (!pendingCapture || pendingCapture.cardId !== cardId) {
    return null;
  }

  return pendingCapture;
}

async function renderCardByScreenshot(input: {
  request: IncomingMessage;
  area: TextAreaRegion;
  nameArea: TextAreaRegion;
  cardId: string;
  canvas: CanvasMeta;
  outputCardPath: string;
  artImage: string;
  referenceImage: string;
  artOffsetY: number;
}): Promise<void> {
  const captureId = crypto.randomUUID();
  pendingCaptures.set(captureId, {
    cardId: input.cardId,
    area: input.area,
    nameArea: input.nameArea,
    artImage: input.artImage,
    referenceImage: input.referenceImage,
    artOffsetY: input.artOffsetY,
  });

  const host = input.request.headers.host ?? `${appConfig.capture.host}:${appConfig.server.port}`;
  // const captureUrl = new URL(`http://${host}/`);
  const captureUrl = new URL('/tools/card-text/', `http://${host}`);
  captureUrl.searchParams.set('capture', '1');
  captureUrl.searchParams.set('captureId', captureId);
  captureUrl.searchParams.set('cardId', input.cardId);
  captureUrl.searchParams.set('artImage', input.artImage);
  captureUrl.searchParams.set('referenceImage', input.referenceImage);
  captureUrl.searchParams.set('artOffsetY', String(input.artOffsetY));

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: {
        width: input.canvas.width,
        height: input.canvas.height,
      },
      deviceScaleFactor: 1,
    });

    await page.goto(captureUrl.href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.locator('[data-stage] canvas').first().waitFor({ timeout: 10000 });
    await page.waitForFunction(() =>
      Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    );
    await page.waitForTimeout(500);
    await page.locator('[data-stage]').screenshot({
      path: input.outputCardPath,
      animations: 'disabled',
    });
  } finally {
    pendingCaptures.delete(captureId);
    await browser.close();
  }
}

function toProjectPath(targetPath: string): string {
  return path.relative(projectRoot, targetPath).split(path.sep).join('/');
}

async function finalizeCardAssets(cardId: string, sourcePath: string): Promise<CardAssetPaths> {
  const sharpFactory = sharp as unknown as SharpFactory;
  const pngDir = path.join(projectRoot, 'assets/cards/png');
  const webpDir = path.join(projectRoot, 'assets/cards/webp');
  await fs.mkdir(pngDir, { recursive: true });
  await fs.mkdir(webpDir, { recursive: true });

  const metadata = await sharpFactory(sourcePath).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    throw new Error(`Could not read generated image dimensions: ${toProjectPath(sourcePath)}`);
  }

  if (width * 3 !== height * 2) {
    throw new Error(`Generated image must be 2:3, got ${width}x${height}`);
  }

  const pngPath = path.join(pngDir, `${cardId}.png`);
  const webpPath = path.join(webpDir, `${cardId}.webp`);

  await sharpFactory(sourcePath).png().toFile(pngPath);
  await sharpFactory(sourcePath)
    .resize(Math.round(width * 0.5), Math.round(height * 0.5))
    .webp({ quality: 90 })
    .toFile(webpPath);

  const cardAssets = {
    png: toAssetsPath(pngPath),
    webp: toAssetsPath(webpPath),
  };

  return cardAssets;
}

function normalizeAssetBaseUrl(assetBaseUrl: string): string {
  if (!assetBaseUrl.startsWith('/')) {
    return `/${assetBaseUrl.replace(/^\/+/, '')}`;
  }

  return assetBaseUrl.replace(/\/+$/, '') || '/';
}

function isAssetRoute(pathname: string, assetBaseUrl: string): boolean {
  return pathname === assetBaseUrl || pathname.startsWith(`${assetBaseUrl}/`);
}

function normalizeAssetPath(requestedPath: string, assetBaseUrl: string): string {
  const stripped = requestedPath.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
  const normalizedBaseUrl = normalizeAssetBaseUrl(assetBaseUrl).replace(/^\/+/, '');

  if (normalizedBaseUrl && stripped.startsWith(`${normalizedBaseUrl}/`)) {
    return stripped.slice(normalizedBaseUrl.length + 1);
  }

  if (stripped.startsWith('assets/')) {
    return stripped.slice('assets/'.length);
  }

  return stripped;
}

function toAssetsPath(targetPath: string): string {
  return path.relative(assetsRoot, targetPath).split(path.sep).join('/');
}

function toAssetUrl(assetBaseUrl: string, assetPath: string): string {
  const normalizedBaseUrl = normalizeAssetBaseUrl(assetBaseUrl);
  const normalizedPath = assetPath.replace(/^\/+/, '');
  return `${normalizedBaseUrl}/${normalizedPath}`;
}

function isWithinDirectory(targetPath: string, directoryPath: string): boolean {
  const relativePath = path.relative(directoryPath, targetPath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function getMimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.ttf':
      return 'font/ttf';
    case '.otf':
      return 'font/otf';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

async function clearTempFiles(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(path.join(projectRoot, 'cards/temp'));
  } catch {
    return;
  }

  await Promise.all(
    entries.map((entry) => fs.rm(path.join(projectRoot, 'cards/temp', entry), { force: true })),
  );
}

function createNameTextAreaFromSafeArea(meta: FrameMeta): TextAreaRegion {
  const safeArea = isRecord(meta.safeAreas?.bottom_center_between_orbs)
    ? meta.safeAreas.bottom_center_between_orbs
    : {};

  return normalizeTextArea(
    {
      ...defaultNameTextArea,
      x: toInteger(safeArea.x, defaultNameTextArea.x),
      y: toInteger(safeArea.y, defaultNameTextArea.y),
      width: toInteger(safeArea.width, defaultNameTextArea.width),
      height: toInteger(safeArea.height, defaultNameTextArea.height),
    },
    defaultNameTextArea,
  );
}

function readDefaultArtOffsetY(meta: FrameMeta): number {
  const chromaArea = isRecord(meta.regions?.inner_chroma_area)
    ? meta.regions.inner_chroma_area
    : {};
  return Math.round(toInteger(chromaArea.y, 0) / 2);
}

async function listAssetImages(directoryPath: string, assetDir: string): Promise<AssetImage[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(directoryPath);
  } catch {
    throw new Error(`Missing image directory: ${toProjectPath(directoryPath)}`);
  }

  const images = entries
    .filter((entry) => /\.(?:png|webp|jpe?g)$/i.test(entry))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => ({
      name: entry,
      path: `${assetDir}/${entry}`,
    }));

  if (images.length === 0) {
    throw new Error(`No images found in ${assetDir}`);
  }

  return images;
}

function selectAssetPath(
  requestedPath: string | null | undefined,
  images: AssetImage[],
  label: string,
  assetBaseUrl: string,
): string | null {
  if (!requestedPath) {
    return null;
  }

  const normalizedPath = normalizeAssetPath(requestedPath, assetBaseUrl);
  if (images.some((image) => image.path === normalizedPath)) {
    return normalizedPath;
  }

  throw new Error(`Invalid ${label}: ${requestedPath}`);
}

function selectFirstAssetPath(images: AssetImage[], label: string): string {
  const firstImage = images[0];
  if (!firstImage) {
    throw new Error(`No ${label} candidates found`);
  }

  return firstImage.path;
}

function selectArtImageForCard(cardId: string | null | undefined, images: AssetImage[]): string {
  if (cardId) {
    const matchingImage = images.find((image) => cardIdFromAssetPath(image.path) === cardId);
    if (matchingImage) {
      return matchingImage.path;
    }
  }

  return selectFirstAssetPath(images, 'art image');
}

function cardIdFromAssetPath(assetPath: string): string {
  return path.basename(assetPath).replace(/\.(?:png|webp|jpe?g)$/i, '');
}

function readOptionalInteger(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') {
    return fallback;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : fallback;
}

function normalizeTextArea(
  area: JsonRecord | TextAreaRegion,
  fallback: TextAreaRegion = defaultTextArea,
): TextAreaRegion {
  return {
    ...fallback,
    ...area,
    type: 'text_area',
    x: toInteger(area.x, fallback.x),
    y: toInteger(area.y, fallback.y),
    width: toInteger(area.width, fallback.width),
    height: toInteger(area.height, fallback.height),
    cornerRadius: toInteger(area.cornerRadius, fallback.cornerRadius),
    opacity: toNumber(area.opacity, fallback.opacity),
    fontSize: toInteger(area.fontSize, fallback.fontSize),
    titleFontSize: toInteger(area.titleFontSize, fallback.titleFontSize),
    paddingX: toInteger(area.paddingX, fallback.paddingX),
    paddingY: toInteger(area.paddingY, fallback.paddingY),
  };
}

function findCard(deck: DeckData, cardId: string): Card {
  const card = deck.cards.find((candidate) => candidate.id === cardId);
  if (!card) {
    throw new Error(`Card not found: ${cardId}`);
  }

  return card;
}

function getAbilityCategoryTitles(schema: JsonRecord): Map<string, string> {
  const defs = schema.$defs;
  if (!isRecord(defs)) {
    return new Map();
  }

  const abilityCategory = defs.abilityCategory;
  if (!isRecord(abilityCategory) || !Array.isArray(abilityCategory.oneOf)) {
    return new Map();
  }

  return new Map(
    abilityCategory.oneOf.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.const !== 'string' || typeof entry.title !== 'string') {
        return [];
      }

      return [[entry.const, entry.title] as const];
    }),
  );
}

function formatAbilityText(
  card: Card,
  abilityTitles: Map<string, string>,
  area: TextAreaRegion,
): string {
  if (card.abilities.length === 0) {
    return '';
  }

  return card.abilities
    .map((ability) => {
      const title = abilityTitles.get(ability.category) ?? ability.category;
      return [
        `[color=${area.nameColor}]${escapeBBCode(ability.name)}[/color] : [color=${area.titleColor}][${escapeBBCode(title)}][/color]`,
        `[color=${area.textColor}]${escapeBBCode(ability.text)}[/color]`,
      ].join('\n');
    })
    .join('\n\n');
}

function formatNameText(card: Card, area: TextAreaRegion): string {
  return `[color=${area.textColor}]${escapeBBCode(card.name)}[/color]`;
}

function escapeBBCode(value: string): string {
  return value.replace(/\[/g, '[esc][').replace(/\]/g, '][/esc]');
}

function validateAreaPayload(value: unknown): SaveAreaPayload {
  if (
    !isRecord(value) ||
    typeof value.cardId !== 'string' ||
    !isRecord(value.area) ||
    !isRecord(value.nameArea)
  ) {
    throw new Error('Invalid payload');
  }

  return {
    cardId: value.cardId,
    area: normalizeTextArea(value.area),
    nameArea: normalizeTextArea(value.nameArea, defaultNameTextArea),
    ...(typeof value.artImage === 'string' ? { artImage: value.artImage } : {}),
    ...(typeof value.referenceImage === 'string' ? { referenceImage: value.referenceImage } : {}),
    ...(typeof value.artOffsetY === 'number' ? { artOffsetY: value.artOffsetY } : {}),
  };
}

function readRequestJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk) => {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', (error) => {
      reject(error);
    });
  });
}

function sendJson(response: ServerResponse, body: unknown): void {
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function toInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
