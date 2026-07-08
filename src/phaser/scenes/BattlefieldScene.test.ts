import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class FakeScene {
    public readonly scene = {
      isActive: () => true,
    };

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
      Loader: {
        Events: {
          COMPLETE: 'complete',
          FILE_LOAD_ERROR: 'fileloaderror',
          PROGRESS: 'progress',
        },
      },
      Math: {
        Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
      },
    },
  };
});

type FakeRuntime = {
  currentSide: 'player' | 'enemy';
  outcome: null;
};

type FakeBattleFlowResult = {
  messages: string[];
  popupEvents: unknown[];
  pendingBlockSelection: null;
};

type FakeSequence = {
  add: () => FakeSequence;
  play: () => Promise<void>;
};

type BattlefieldSceneHarness = {
  runtime: FakeRuntime;
  statusMessage: string;
  isAnimatingBattleEvents: boolean;
  sequencePlugin: {
    createSequence: () => FakeSequence;
  };
  scene: {
    isActive: () => boolean;
  };
  finishBattleAction: (message: string, popupEvents: unknown[]) => void;
  settleTurnFlow: () => FakeBattleFlowResult;
  renderBattleState: () => void;
  retainRemovedDamageTargetViews: () => void;
};

describe('BattlefieldScene battle animation flow', () => {
  it('defers stalled turn flow until the action popup sequence completes', async () => {
    const { BattlefieldScene } = await import('./BattlefieldScene');
    const scene = new BattlefieldScene() as unknown as BattlefieldSceneHarness;
    const runtime: FakeRuntime = {
      currentSide: 'player',
      outcome: null,
    };
    const releaseSequenceRef: { current: (() => void) | null } = { current: null };
    let settleTurnFlowCalls = 0;
    let renderCalls = 0;

    scene.runtime = runtime;
    scene.scene = {
      isActive: () => true,
    };
    scene.sequencePlugin = {
      createSequence: () => {
        const sequence: FakeSequence = {
          add: () => sequence,
          play: () =>
            new Promise<void>((resolve) => {
              releaseSequenceRef.current = resolve;
            }),
        };
        return sequence;
      },
    };
    scene.renderBattleState = () => {
      renderCalls += 1;
    };
    scene.retainRemovedDamageTargetViews = () => undefined;
    scene.settleTurnFlow = () => {
      settleTurnFlowCalls += 1;
      runtime.currentSide = 'enemy';
      return {
        messages: ['Player had no actions and ended automatically.'],
        popupEvents: [],
        pendingBlockSelection: null,
      };
    };

    scene.finishBattleAction('Player attacked Enemy.', [
      {
        kind: 'PLACE',
        slotId: 'enemy:FC',
        text: 'PLACE',
      },
    ]);
    await flushPromises();

    expect(settleTurnFlowCalls).toBe(0);
    expect(runtime.currentSide).toBe('player');
    expect(scene.isAnimatingBattleEvents).toBe(true);
    expect(scene.statusMessage).toBe('Player attacked Enemy.');

    if (!releaseSequenceRef.current) {
      throw new Error('Expected battle popup sequence to start');
    }
    releaseSequenceRef.current();
    await flushPromises();

    expect(settleTurnFlowCalls).toBe(1);
    expect(runtime.currentSide).toBe('enemy');
    expect(scene.isAnimatingBattleEvents).toBe(false);
    expect(scene.statusMessage).toBe(
      'Player attacked Enemy. Player had no actions and ended automatically.',
    );
    expect(renderCalls).toBeGreaterThanOrEqual(2);
  });
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
