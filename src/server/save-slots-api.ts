import fs from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialSaveState } from '../game/save/create-initial-save';
import {
  SAVE_SLOT_IDS,
  SAVE_SLOT_SCHEMA_VERSION,
  type CardInstance,
  type DeckInstance,
  type SaveSlotId,
  type SaveSlotState,
  type SaveSlotsResponse,
} from '../game/save/types';

type SaveSlotsApiOptions = {
  projectRoot?: string;
  saveSlotsRoot?: string;
};

type JsonRecord = Record<string, unknown>;

const defaultProjectRoot = fileURLToPath(new URL('../..', import.meta.url));
const defaultSaveSlotsRoot = path.join(defaultProjectRoot, '.data/save-slots');

/**
 * `/api/save-slots/...` 요청을 처리하는 공용 API 핸들러를 만든다.
 * 1~3번 슬롯의 조회, 저장, 초기화만 허용한다.
 */
export function createSaveSlotsApiHandler(
  options: SaveSlotsApiOptions = {},
): (request: IncomingMessage, response: ServerResponse, next: () => void) => Promise<boolean> {
  const projectRoot = options.projectRoot ?? defaultProjectRoot;
  const saveSlotsRoot = options.saveSlotsRoot ?? defaultSaveSlotsRoot;

  return async (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/save-slots')) {
      next();
      return false;
    }

    try {
      if (request.method === 'GET' && url.pathname === '/api/save-slots') {
        sendJson(response, await listSaveSlotSummaries(saveSlotsRoot));
        return true;
      }

      const slotId = parseSlotId(url.pathname);
        if (!slotId) {
          response.statusCode = 404;
          response.end('Not found');
        return true;
      }

      if (request.method === 'GET') {
        const state = await readSaveSlotState(saveSlotsRoot, slotId);
        if (!state) {
          response.statusCode = 404;
          sendJson(response, { empty: true, slotId });
          return true;
        }

        sendJson(response, state);
        return true;
      }

      if (request.method === 'PUT') {
        const body = validateSaveSlotState(await readRequestJson(request), slotId);
        await writeSaveSlotState(saveSlotsRoot, body);
        sendJson(response, body);
        return true;
      }

      if (request.method === 'POST' && url.pathname.endsWith('/initialize')) {
        const existing = await readSaveSlotState(saveSlotsRoot, slotId);
        if (existing) {
          response.statusCode = 409;
          sendJson(response, {
            error: `Save slot ${slotId} already exists`,
            slotId,
          });
          return true;
        }

        const initialState = await createInitialSaveState({ slotId, projectRoot });
        await writeSaveSlotState(saveSlotsRoot, initialState);
        sendJson(response, {
          state: initialState,
          summary: toSaveSlotSummary(initialState),
        });
        return true;
      }

      response.statusCode = 405;
      response.end('Method Not Allowed');
      return true;
    } catch (error) {
      response.statusCode = getErrorStatusCode(error);
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.end(error instanceof Error ? error.message : String(error));
      return true;
    }
  };
}

export async function listSaveSlotSummaries(
  saveSlotsRoot: string = defaultSaveSlotsRoot,
): Promise<SaveSlotsResponse> {
  const slots = await Promise.all(
    SAVE_SLOT_IDS.map(async (slotId) => {
      const state = await readSaveSlotState(saveSlotsRoot, slotId);
      return state ? toSaveSlotSummary(state) : createEmptySummary(slotId);
    }),
  );

  return { slots };
}

async function readSaveSlotState(
  saveSlotsRoot: string,
  slotId: SaveSlotId,
): Promise<SaveSlotState | null> {
  const slotPath = getSaveSlotPath(saveSlotsRoot, slotId);
  try {
    return validateSaveSlotState(JSON.parse(await fs.readFile(slotPath, 'utf8')), slotId);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null;
    }

    throw error instanceof Error ? error : new Error(String(error));
  }
}

async function writeSaveSlotState(saveSlotsRoot: string, state: SaveSlotState): Promise<void> {
  await fs.mkdir(saveSlotsRoot, { recursive: true });
  await fs.writeFile(getSaveSlotPath(saveSlotsRoot, state.slotId), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function createEmptySummary(slotId: SaveSlotId) {
  return {
    slotId,
    saveName: null,
    updatedAt: null,
    deckCardCount: null,
    leaderName: null,
    isEmpty: true,
  };
}

function toSaveSlotSummary(state: SaveSlotState) {
  return {
    slotId: state.slotId,
    saveName: state.saveName,
    updatedAt: state.updatedAt,
    deckCardCount: state.deck.cards.length,
    leaderName: state.deck.leader.definitionName,
    isEmpty: false,
  };
}

function getSaveSlotPath(saveSlotsRoot: string, slotId: SaveSlotId): string {
  return path.join(saveSlotsRoot, `slot-${slotId}.json`);
}

function parseSlotId(pathname: string): SaveSlotId | null {
  const match = pathname.match(/^\/api\/save-slots\/([123])(?:\/initialize)?$/);
  if (!match) {
    return null;
  }

  return Number(match[1]) as SaveSlotId;
}

async function readRequestJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw.length > 0 ? JSON.parse(raw) : null;
}

function validateSaveSlotState(value: unknown, slotId: SaveSlotId): SaveSlotState {
  if (!isRecord(value)) {
    throw new Error('Save slot body must be an object');
  }

  if (value.schemaVersion !== SAVE_SLOT_SCHEMA_VERSION) {
    throw new Error(`Invalid schemaVersion: ${String(value.schemaVersion)}`);
  }

  if (value.slotId !== slotId) {
    throw new Error(`slotId mismatch: expected ${slotId}, got ${String(value.slotId)}`);
  }

  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new Error('createdAt and updatedAt must be strings');
  }

  if (typeof value.saveName !== 'string' || value.saveName.trim().length === 0) {
    throw new Error('saveName must be a non-empty string');
  }

  if (!isDeckInstance(value.deck)) {
    throw new Error('deck must be a deck instance');
  }

  return {
    schemaVersion: SAVE_SLOT_SCHEMA_VERSION,
    slotId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    saveName: value.saveName,
    deck: value.deck,
  };
}

function isDeckInstance(value: unknown): value is DeckInstance {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    isCardInstance(value.leader) &&
    Array.isArray(value.cards) &&
    value.cards.every((entry) => isCardInstance(entry))
  );
}

function isCardInstance(value: unknown): value is CardInstance {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.instanceId === 'string' &&
    typeof value.definitionId === 'string' &&
    typeof value.definitionName === 'string' &&
    value.owner === 'PLAYER' &&
    (value.zone === 'LEADER' || value.zone === 'DECK') &&
    Number.isInteger(value.level) &&
    Number.isInteger(value.exp) &&
    Number.isInteger(value.baseHp) &&
    Number.isInteger(value.currentHp) &&
    Number.isInteger(value.baseAttack) &&
    Number.isInteger(value.currentAttack)
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function getErrorStatusCode(error: unknown): number {
  if (error instanceof SyntaxError) {
    return 400;
  }

  if (error instanceof Error) {
    if (
      error.message.startsWith('Save slot body must be an object') ||
      error.message.startsWith('Invalid schemaVersion:') ||
      error.message.startsWith('slotId mismatch:') ||
      error.message.startsWith('createdAt and updatedAt must be strings') ||
      error.message.startsWith('saveName must be a non-empty string') ||
      error.message.startsWith('deck must be a deck instance') ||
      error.message.startsWith('Expected exactly one LEADER card in deck_test.json') ||
      error.message.startsWith('Expected at least one UNIT card in deck_test.json') ||
      error.message.startsWith('Invalid ')
    ) {
      return 400;
    }
  }

  return 500;
}

function sendJson(response: ServerResponse, body: unknown): void {
  response.statusCode = response.statusCode || 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}
