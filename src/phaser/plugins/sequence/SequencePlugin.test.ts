import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { SequencePlugin } from './SequencePlugin';

type FakeTweenConfig = {
  targets?: unknown;
  progress?: number;
  onUpdate?: () => void;
  onComplete?: () => void;
  onStop?: () => void;
};

class FakeTimerEvent {
  public fired = false;
  public removed = false;

  constructor(
    public readonly delay: number,
    private readonly callback: () => void,
  ) {}

  fire(): void {
    if (this.fired || this.removed) {
      return;
    }

    this.fired = true;
    this.callback();
  }
}

class FakeClock {
  public readonly timers: FakeTimerEvent[] = [];
  public readonly removedTimers: FakeTimerEvent[] = [];

  delayedCall(
    delay: number,
    callback: (...args: unknown[]) => void,
    args: unknown[] = [],
    callbackScope?: unknown,
  ): Phaser.Time.TimerEvent {
    const timer = new FakeTimerEvent(delay, () => {
      callback.apply(callbackScope, args);
    });
    this.timers.push(timer);
    return timer as unknown as Phaser.Time.TimerEvent;
  }

  removeEvent(event: Phaser.Time.TimerEvent): this {
    const timer = event as unknown as FakeTimerEvent;
    timer.removed = true;
    this.removedTimers.push(timer);
    return this;
  }

  runNext(): void {
    const timer = this.timers.find((candidate) => !candidate.fired && !candidate.removed);
    if (!timer) {
      throw new Error('No pending timer');
    }

    timer.fire();
  }
}

class FakeTween {
  public stopped = false;
  public destroyed = false;

  constructor(private readonly config: FakeTweenConfig) {}

  complete(): void {
    this.writeProgress(0.5);
    this.config.onUpdate?.();
    this.writeProgress(this.config.progress ?? 1);
    this.config.onUpdate?.();
    this.config.onComplete?.();
  }

  stop(): this {
    this.stopped = true;
    this.config.onStop?.();
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }

  private writeProgress(value: number): void {
    const target = this.config.targets;
    if (isProgressTarget(target)) {
      target.progress = value;
    }
  }
}

class FakeTweenManager {
  public autoComplete = true;
  public readonly tweens: FakeTween[] = [];

  add(config: FakeTweenConfig): Phaser.Tweens.Tween {
    const tween = new FakeTween(config);
    this.tweens.push(tween);
    if (this.autoComplete) {
      tween.complete();
    }

    return tween as unknown as Phaser.Tweens.Tween;
  }
}

class FakeTarget {
  public active = true;

  constructor(
    public readonly scene: Phaser.Scene,
    public x: number,
    public y: number,
  ) {}
}

class FakeScene {
  public active = true;
  public readonly time = new FakeClock();
  public readonly tweens = new FakeTweenManager();
  public readonly scene = {
    isActive: () => this.active,
  };

  asPhaserScene(): Phaser.Scene {
    return this as unknown as Phaser.Scene;
  }

  createTarget(x: number, y: number): FakeTarget {
    return new FakeTarget(this.asPhaserScene(), x, y);
  }
}

describe('SequencePlugin', () => {
  it('runs same-timer steps together and later timer steps in order', async () => {
    const scene = new FakeScene();
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });
    const order: string[] = [];

    const sequence = plugin.createSequence();
    sequence
      .add({
        timer: 20,
        action: 'custom',
        run: () => {
          order.push('later');
        },
      })
      .add({
        timer: 0,
        action: 'custom',
        run: () => {
          order.push('first-a');
        },
      })
      .add({
        timer: 0,
        action: 'custom',
        run: () => {
          order.push('first-b');
        },
      });

    const promise = sequence.play();
    await flushPromises();

    expect(order).toEqual(['first-a', 'first-b']);
    expect(scene.time.timers[0]?.delay).toBeGreaterThan(0);

    scene.time.runNext();
    await promise;

    expect(order).toEqual(['first-a', 'first-b', 'later']);
  });

  it('waits for detached steps only before final completion', async () => {
    const scene = new FakeScene();
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });
    const order: string[] = [];
    const releaseDetachedRef: { current?: () => void } = {};
    let completed = false;

    const promise = plugin.play([
      {
        timer: 0,
        action: 'custom',
        mode: 'detached',
        run: () =>
          new Promise<void>((resolve) => {
            order.push('detached-start');
            releaseDetachedRef.current = resolve;
          }),
      },
      {
        timer: 10,
        action: 'custom',
        run: () => {
          order.push('later');
        },
      },
    ]);
    promise.then(() => {
      completed = true;
    });

    await flushPromises();
    scene.time.runNext();
    await flushPromises();

    expect(order).toEqual(['detached-start', 'later']);
    expect(completed).toBe(false);

    if (!releaseDetachedRef.current) {
      throw new Error('Detached step was not started');
    }
    releaseDetachedRef.current();
    await promise;

    expect(completed).toBe(true);
  });

  it('locks input while a sequence is playing', async () => {
    const scene = new FakeScene();
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });
    const lockStates: boolean[] = [];

    await plugin.play(
      [
        {
          timer: 0,
          action: 'custom',
          run: () => undefined,
        },
      ],
      {
        lockInput: true,
        onLockChange: (locked) => {
          lockStates.push(locked);
        },
      },
    );

    expect(lockStates).toEqual([true, false]);
  });

  it('restores target coordinates after shake completes', async () => {
    const scene = new FakeScene();
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });
    const target = scene.createTarget(40, 80);

    await plugin.play([
      {
        timer: 0,
        action: 'shake',
        target: target as Phaser.GameObjects.GameObject & { x: number; y: number },
        duration: 180,
        intensity: 8,
        repeat: 3,
      },
    ]);

    expect(target.x).toBe(40);
    expect(target.y).toBe(80);
    expect(scene.tweens.tweens).toHaveLength(1);
  });

  it('removes pending timers and stops tweens on destroy', async () => {
    const scene = new FakeScene();
    scene.tweens.autoComplete = false;
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });
    const target = scene.createTarget(10, 20);

    const promise = plugin.play([
      {
        timer: 0,
        action: 'wait',
        duration: 1000,
      },
      {
        timer: 0,
        action: 'shake',
        target: target as Phaser.GameObjects.GameObject & { x: number; y: number },
        duration: 1000,
      },
    ]);
    await flushPromises();

    expect(scene.time.timers).toHaveLength(1);
    expect(scene.tweens.tweens).toHaveLength(1);

    plugin.destroy();
    await promise;

    expect(scene.time.removedTimers).toHaveLength(1);
    expect(scene.tweens.tweens[0]?.stopped).toBe(true);
    expect(scene.tweens.tweens[0]?.destroyed).toBe(true);
    expect(target.x).toBe(10);
    expect(target.y).toBe(20);
  });
});

function isProgressTarget(value: unknown): value is { progress: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'progress' in value &&
    typeof value.progress === 'number'
  );
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
