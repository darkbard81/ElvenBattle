import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveSlotSummary } from '../../game/save/types';

const deleteSaveSlot = vi.fn<(slotId: 1 | 2 | 3) => Promise<SaveSlotSummary>>();

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      public readonly scene = { start: vi.fn() };
      public readonly input = { enabled: true };

      constructor() {}
    },
  },
}));

vi.mock('../services/game-services', () => ({
  getGameServices: () => ({
    auth: {
      logout: vi.fn(),
    },
    saveSlots: {
      delete: deleteSaveSlot,
    },
  }),
}));

vi.mock('../ui/CanvasUiFactory', () => ({
  CanvasUiFactory: class {
    constructor() {}
  },
}));

type SaveSlotSceneHarness = {
  statusText: {
    setText: ReturnType<typeof vi.fn>;
    setColor: ReturnType<typeof vi.fn>;
  };
  slotSummaries: SaveSlotSummary[];
  deleteMode: boolean;
  isSlotActionPending: boolean;
  renderDeleteButton: ReturnType<typeof vi.fn>;
  renderSlotCards: ReturnType<typeof vi.fn>;
  toggleDeleteMode: () => void;
  handleSlotSelection: (slot: SaveSlotSummary) => Promise<void>;
};

const occupiedSlot: SaveSlotSummary = {
  slotId: 1,
  saveName: 'Slot 1',
  updatedAt: '2024-01-01T00:00:00.000Z',
  deckCardCount: 29,
  leaderName: '미네르바',
  isEmpty: false,
};

const emptySlot: SaveSlotSummary = {
  slotId: 2,
  saveName: null,
  updatedAt: null,
  deckCardCount: null,
  leaderName: null,
  isEmpty: true,
};

async function createHarness(): Promise<SaveSlotSceneHarness> {
  const { SaveSlotScene } = await import('./SaveSlotScene');
  const scene = new SaveSlotScene() as unknown as SaveSlotSceneHarness;
  scene.statusText = {
    setText: vi.fn(),
    setColor: vi.fn(),
  };
  scene.renderDeleteButton = vi.fn();
  scene.renderSlotCards = vi.fn();
  scene.slotSummaries = [occupiedSlot, emptySlot];
  return scene;
}

describe('SaveSlotScene delete mode', () => {
  beforeEach(() => {
    deleteSaveSlot.mockReset();
  });

  it('requires the delete button before selecting a slot for deletion', async () => {
    const scene = await createHarness();

    scene.toggleDeleteMode();

    expect(scene.deleteMode).toBe(true);
    expect(scene.renderDeleteButton).toHaveBeenCalledOnce();
    expect(scene.renderSlotCards).toHaveBeenCalledWith(scene.slotSummaries);
    expect(scene.statusText.setText).toHaveBeenCalledWith(
      'Delete mode: select a saved slot to delete.',
    );
  });

  it('deletes an occupied slot and leaves delete mode afterward', async () => {
    const deletedSummary = { ...emptySlot, slotId: 1 as const };
    deleteSaveSlot.mockResolvedValue(deletedSummary);
    const scene = await createHarness();
    scene.deleteMode = true;

    await scene.handleSlotSelection(occupiedSlot);

    expect(deleteSaveSlot).toHaveBeenCalledWith(1);
    expect(scene.slotSummaries[0]).toEqual(deletedSummary);
    expect(scene.deleteMode).toBe(false);
    expect(scene.isSlotActionPending).toBe(false);
    expect(scene.statusText.setText).toHaveBeenLastCalledWith(
      'Slot 1 deleted. Select a slot to continue.',
    );
  });

  it('does not call the delete API for an empty slot', async () => {
    const scene = await createHarness();
    scene.deleteMode = true;

    await scene.handleSlotSelection(emptySlot);

    expect(deleteSaveSlot).not.toHaveBeenCalled();
    expect(scene.deleteMode).toBe(true);
    expect(scene.statusText.setText).toHaveBeenCalledWith('Slot 2 is already empty.');
  });
});
