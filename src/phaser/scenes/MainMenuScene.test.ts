import { beforeEach, describe, expect, it, vi } from 'vitest';

const logout = vi.fn<() => Promise<void>>();
const start = vi.fn();
const button = vi.fn((config: { label: string }) => ({ label: config.label }));
const stack = vi.fn((config: unknown) => ({ config }));
let currentSessionId = 'player';

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
  getGameServices: () => ({
    auth: {
      current: { id: currentSessionId, expiresAt: '2099-01-01T00:00:00.000Z' },
      logout,
    },
  }),
}));

vi.mock('../ui/CanvasUiFactory', () => ({
  CanvasUiFactory: class {
    button = button;
    stack = stack;
  },
}));

type MainMenuSceneHarness = {
  isLoggingOut: boolean;
  statusText: {
    setText: ReturnType<typeof vi.fn>;
  };
  init: () => void;
  createButtonLayout: () => unknown;
  logout: () => Promise<void>;
};

describe('MainMenuScene', () => {
  beforeEach(() => {
    logout.mockReset();
    logout.mockResolvedValue();
    start.mockReset();
    button.mockClear();
    stack.mockClear();
    currentSessionId = 'player';
  });

  it('shows Card Text Tool only for darkbard81', async () => {
    const { MainMenuScene } = await import('./MainMenuScene');
    const scene = new MainMenuScene() as unknown as MainMenuSceneHarness;

    currentSessionId = 'darkbard81';
    scene.createButtonLayout();

    expect(button.mock.calls.map(([config]) => config.label)).toEqual([
      'Start Game',
      'Card Text Tool',
      'License',
      'Logout',
    ]);
  });

  it('hides Card Text Tool for other accounts', async () => {
    const { MainMenuScene } = await import('./MainMenuScene');
    const scene = new MainMenuScene() as unknown as MainMenuSceneHarness;

    scene.createButtonLayout();

    expect(button.mock.calls.map(([config]) => config.label)).toEqual([
      'Start Game',
      'License',
      'Logout',
    ]);
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
