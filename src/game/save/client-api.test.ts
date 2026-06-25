import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSaveSlotSummaries,
  fetchSaveSlot,
  initializeSaveSlot,
  saveSlotState,
} from './client-api';
import type { CardInstance, SaveSlotState } from './types';

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

function createValidSaveSlotState(): SaveSlotState {
  return {
    schemaVersion: 1,
    slotId: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    saveName: 'Slot 1',
    deck: {
      id: 'deck-1',
      leader: createValidCardInstance(),
      cards: [],
    },
    stageProgress: {
      clearedStageIds: [],
      lastSelectedStageId: null,
    },
  };
}

function createValidCardInstance(): CardInstance {
  return {
    id: 'leader_minerva',
    name: '미네르바',
    rarity: 'R',
    type: 'LEADER',
    traits: [{ key: 'race', text: '엘프' }],
    slot: 0,
    cost: 1,
    dominance: 1,
    hp: 100,
    attack: 10,
    level: 1,
    exp: 0,
    abilities: [],
    growth: {
      lv2: [],
      lv3: [],
      lv4: [],
      lv5: [],
      lv6: [],
      lv7: [],
      lv8: [],
      lv9: [],
    },
    description: '테스트 리더',
    note: '테스트 노트',
    instanceId: 'leader-1',
    owner: 'PLAYER',
    zone: 'LEADER',
  };
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

  it('saves a slot state with PUT and JSON body', async () => {
    const state = createValidSaveSlotState();
    const fetchSpy = vi.fn(async () =>
      createFakeResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: state,
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await expect(saveSlotState(state)).resolves.toEqual(state);
    expect(fetchSpy).toHaveBeenCalledWith('/api/save-slots/1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state),
    });
  });

  it('rejects invalid save slot state payloads after save', async () => {
    const state = createValidSaveSlotState();
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

    await expect(saveSlotState(state)).rejects.toThrow('Invalid save slot state response');
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
                leader: createValidCardInstance(),
                cards: [],
              },
              stageProgress: {
                clearedStageIds: [],
                lastSelectedStageId: null,
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
