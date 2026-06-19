import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createSaveSlotsApiHandler, listSaveSlotSummaries } from './save-slots-api';

function createRequest(method: string, url: string, body?: string): IncomingMessage {
  const request = Readable.from(body ? [body] : []) as IncomingMessage;
  request.method = method;
  request.url = url;
  request.headers = {};
  return request;
}

function createResponse(): {
  response: ServerResponse;
  json(): unknown;
  text(): string;
  statusCode(): number | undefined;
} {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    end(chunk?: unknown) {
      if (chunk != null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
      }
      return this;
    },
  } as unknown as ServerResponse;

  return {
    response,
    json() {
      return JSON.parse(chunks.join('') || 'null') as unknown;
    },
    text() {
      return chunks.join('');
    },
    statusCode() {
      return response.statusCode;
    },
  };
}

describe('save slots api', () => {
  it('returns three empty summaries when no files exist', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'save-slots-'));
    const handler = createSaveSlotsApiHandler({ saveSlotsRoot: path.join(tempRoot, 'slots') });
    const req = createRequest('GET', '/api/save-slots');
    const res = createResponse();

    await handler(req, res.response, () => undefined);

    expect(res.statusCode()).toBe(200);
    const body = res.json() as { slots: Array<{ slotId: number; isEmpty: boolean }> };
    expect(body.slots).toHaveLength(3);
    expect(body.slots.every((slot) => slot.isEmpty)).toBe(true);
  });

  it('initializes, saves, and reloads a slot', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'save-slots-'));
    const slotsRoot = path.join(tempRoot, 'slots');
    const handler = createSaveSlotsApiHandler({
      projectRoot: process.cwd(),
      saveSlotsRoot: slotsRoot,
    });

    const initReq = createRequest('POST', '/api/save-slots/1/initialize');
    const initRes = createResponse();
    await handler(initReq, initRes.response, () => undefined);

    expect(initRes.statusCode()).toBe(200);
    const initBody = initRes.json() as {
      state: { slotId: number; deck: { leader: Record<string, unknown>; cards: unknown[] } };
      summary: { isEmpty: boolean; leaderName: string | null };
    };
    expect(initBody.state.slotId).toBe(1);
    expect(initBody.state.deck.cards).toHaveLength(29);
    expect(initBody.state.deck.leader).not.toHaveProperty('definitionName');
    expect(initBody.state.deck.leader).not.toHaveProperty('baseHp');
    expect(initBody.state.deck.leader).not.toHaveProperty('baseAttack');
    expect(initBody.summary.isEmpty).toBe(false);
    expect(initBody.summary.leaderName).toBe('미네르바');

    const list = await listSaveSlotSummaries(slotsRoot);
    expect(list.slots[0]?.isEmpty).toBe(false);
    expect(list.slots[0]?.leaderName).toBe('미네르바');

    const getReq = createRequest('GET', '/api/save-slots/1');
    const getRes = createResponse();
    await handler(getReq, getRes.response, () => undefined);

    expect(getRes.statusCode()).toBe(200);
    const getBody = getRes.json() as { slotId: number; saveName: string; deck: { leader: Record<string, unknown> } };
    expect(getBody.slotId).toBe(1);
    expect(getBody.saveName).toBe('Slot 1');
    expect(getBody.deck.leader).not.toHaveProperty('definitionName');
  });

  it('rejects invalid slot numbers', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'save-slots-'));
    const handler = createSaveSlotsApiHandler({ saveSlotsRoot: path.join(tempRoot, 'slots') });
    const req = createRequest('PUT', '/api/save-slots/9', '{}');
    const res = createResponse();

    await handler(req, res.response, () => undefined);

    expect(res.statusCode()).toBe(404);
    expect(res.text()).toBe('Not found');
  });
});
