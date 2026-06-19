import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSaveSlotSummaries, fetchSaveSlot, initializeSaveSlot } from './client-api';

type FakeResponseInit = {
  ok: boolean;
  status: number;
  statusText: string;
  body: unknown;
};

function createFakeResponse(init: FakeResponseInit): Response {
  return {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText,
    json: async () => init.body,
    text: async () => (typeof init.body === 'string' ? init.body : JSON.stringify(init.body)),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('save slot client api', () => {
  it('loads save slot summaries', async () => {
    const fetchSpy = vi.fn(async () =>
      createFakeResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: {
          slots: [
            {
              slotId: 1,
              saveName: 'Slot 1',
              updatedAt: null,
              deckCardCount: null,
              leaderName: null,
              isEmpty: true,
            },
          ],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await expect(fetchSaveSlotSummaries()).resolves.toEqual([
      {
        slotId: 1,
        saveName: 'Slot 1',
        updatedAt: null,
        deckCardCount: null,
        leaderName: null,
        isEmpty: true,
      },
    ]);
    expect(fetchSpy).toHaveBeenCalledWith('/api/save-slots');
  });

  it('rejects invalid save slot state payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createFakeResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          body: { slotId: 1 },
        }),
      ),
    );

    await expect(fetchSaveSlot(1)).rejects.toThrow('Invalid save slot state response');
  });

  it('loads initialized save slots', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createFakeResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          body: {
            state: {
              schemaVersion: 1,
              slotId: 1,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              saveName: 'Slot 1',
              deck: {
                id: 'deck-1',
                leader: {
                  instanceId: 'leader-1',
                  definitionId: 'leader_minerva',
                  owner: 'PLAYER',
                  zone: 'LEADER',
                  level: 1,
                  exp: 0,
                  currentHp: 100,
                  currentAttack: 10,
                },
                cards: [],
              },
            },
            summary: {
              slotId: 1,
              saveName: 'Slot 1',
              updatedAt: '2024-01-01T00:00:00.000Z',
              deckCardCount: 0,
              leaderName: '미네르바',
              isEmpty: false,
            },
          },
        }),
      ),
    );

    await expect(initializeSaveSlot(1)).resolves.toMatchObject({
      state: {
        slotId: 1,
      },
      summary: {
        leaderName: '미네르바',
      },
    });
  });
});
