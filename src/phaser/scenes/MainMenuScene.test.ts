import { beforeEach, describe, expect, it, vi } from 'vitest';

const logout = vi.fn<() => Promise<void>>();
const start = vi.fn();

vi.mock('phaser', () => {
  class FakeScene {
    public readonly scene = { start };

    constructor() {}
  }

  return {
    default: {
      Scene: FakeScene,
      Scenes: {
        Events: {
          SHUTDOWN: 'shutdown',
        },
      },
    },
  };
});

vi.mock('../services/game-services', () => ({
  getGameServices: () => ({ auth: { logout } }),
}));

type MainMenuSceneHarness = {
  isLoggingOut: boolean;
  statusText: {
    setText: ReturnType<typeof vi.fn>;
  };
  init: () => void;
  logout: () => Promise<void>;
};

describe('MainMenuScene', () => {
  beforeEach(() => {
    logout.mockReset();
    logout.mockResolvedValue();
    start.mockReset();
  });

  it('allows logout again after the scene is entered following a previous logout', async () => {
    const { MainMenuScene } = await import('./MainMenuScene');
    const scene = new MainMenuScene() as unknown as MainMenuSceneHarness;
    scene.statusText = { setText: vi.fn() };
    scene.isLoggingOut = true;

    scene.init();
    await scene.logout();

    expect(logout).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith('TitleScene', {
      statusMessage: 'You have been logged out.',
    });
  });
});
