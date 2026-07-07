import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { SequencePlugin } from './SequencePlugin';

type FakeTweenConfig = {
  targets?: unknown;
  progress?: number;
  duration?: number;
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

  constructor(public readonly config: FakeTweenConfig) {}

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

class FakeVideo {
  public active = true;
  public destroyed = false;
  public stopped = false;
  public played = false;
  public loop: boolean | null = null;
  public playbackRate: number | null = null;
  public displayWidth: number | null = null;
  public displayHeight: number | null = null;
  private readonly listeners = new Map<string, Set<() => void>>();

  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly key: string,
  ) {}

  setOrigin(): this {
    return this;
  }

  setDisplaySize(width: number, height: number): this {
    this.displayWidth = width;
    this.displayHeight = height;
    return this;
  }

  setPlaybackRate(rate = 1): this {
    this.playbackRate = rate;
    return this;
  }

  once(event: string, listener: () => void): this {
    const listeners = this.listeners.get(event) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  off(event: string, listener: () => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  play(loop = false): this {
    this.played = true;
    this.loop = loop;
    return this;
  }

  stop(): this {
    this.stopped = true;
    return this;
  }

  destroy(): void {
    this.active = false;
    this.destroyed = true;
  }

  emit(event: string): void {
    const listeners = [...(this.listeners.get(event) ?? [])];
    this.listeners.delete(event);
    for (const listener of listeners) {
      listener();
    }
  }
}

class FakeVideoCache {
  constructor(private readonly keys: readonly string[] = []) {}

  exists(key: string): boolean {
    return this.keys.includes(key);
  }
}

class FakeLayer {
  public readonly added: unknown[] = [];

  add(gameObject: unknown): this {
    this.added.push(gameObject);
    return this;
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
  public readonly videos: FakeVideo[] = [];
  public readonly cache: { video: FakeVideoCache };
  public readonly add = {
    video: (x: number, y: number, key: string) => {
      const video = new FakeVideo(x, y, key);
      this.videos.push(video);
      return video as unknown as Phaser.GameObjects.Video;
    },
  };
  public readonly scene = {
    isActive: () => this.active,
  };

  constructor(videoKeys: readonly string[] = []) {
    this.cache = {
      video: new FakeVideoCache(videoKeys),
    };
  }

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
        timer: 1000,
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

  it('plays cached video steps through the configured layer', async () => {
    const scene = new FakeScene(['motion.attack.fallback']);
    const layer = new FakeLayer();
    const plugin = new SequencePlugin({
      scene: scene.asPhaserScene(),
      layer: layer as unknown as Phaser.GameObjects.Container,
    });

    const promise = plugin.play([
      {
        timer: 0,
        action: 'video',
        assetId: 'motion.attack.fallback',
        x: 12,
        y: 34,
        width: 320,
        height: 240,
        duration: 1600,
      },
    ]);
    await flushPromises();

    const video = scene.videos[0];
    expect(video).toBeDefined();
    expect(video?.x).toBe(12);
    expect(video?.y).toBe(34);
    expect(video?.key).toBe('motion.attack.fallback');
    expect(video?.displayWidth).toBe(320);
    expect(video?.displayHeight).toBe(240);
    expect(video?.playbackRate).toBe(1);
    expect(video?.played).toBe(true);
    expect(video?.loop).toBe(false);
    expect(layer.added).toEqual([video]);

    video?.emit('complete');
    await promise;

    expect(video?.stopped).toBe(true);
    expect(video?.destroyed).toBe(true);
  });

  it('applies the configured global sequence playback rate to videos', async () => {
    const scene = new FakeScene(['motion.attack.fallback']);
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });

    expect(plugin.getSequencePlaybackRate()).toBe(1);

    plugin.setSequencePlaybackRate(2);
    expect(plugin.getSequencePlaybackRate()).toBe(2);
    expect(plugin.getVideoPlaybackRate()).toBe(2);

    const promise = plugin.play([
      {
        timer: 0,
        action: 'video',
        assetId: 'motion.attack.fallback',
        duration: 1600,
      },
    ]);
    await flushPromises();

    expect(scene.videos[0]?.playbackRate).toBe(2);
    expect(scene.time.timers[0]?.delay).toBe(800);

    scene.videos[0]?.emit('complete');
    await promise;
  });

  it('applies the configured global sequence playback rate to timers and waits', async () => {
    const scene = new FakeScene();
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });
    const order: string[] = [];

    plugin.setSequencePlaybackRate(2);

    const promise = plugin.play([
      {
        timer: 1000,
        action: 'wait',
        duration: 400,
      },
      {
        timer: 1000,
        action: 'custom',
        playback: 'sequential',
        run: () => {
          order.push('done');
        },
      },
    ]);
    await flushPromises();

    expect(scene.time.timers[0]?.delay).toBeCloseTo(500, 1);
    scene.time.runNext();
    await flushPromises();

    expect(scene.time.timers[1]?.delay).toBe(200);
    expect(order).toEqual([]);

    scene.time.runNext();
    await promise;

    expect(order).toEqual(['done']);
  });

  it('applies the configured global sequence playback rate to shake duration', async () => {
    const scene = new FakeScene();
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });
    const target = scene.createTarget(40, 80);

    plugin.setSequencePlaybackRate(2);

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

    expect(scene.tweens.tweens[0]?.config.duration).toBe(90);
  });

  it('rejects invalid global sequence playback rates', () => {
    const scene = new FakeScene();
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });

    expect(() => plugin.setSequencePlaybackRate(0)).toThrow(RangeError);
    expect(() => plugin.setSequencePlaybackRate(-1)).toThrow(RangeError);
    expect(() => plugin.setSequencePlaybackRate(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(plugin.getSequencePlaybackRate()).toBe(1);
  });

  it('runs same-timer sequential playback steps before later parallel effects', async () => {
    const scene = new FakeScene(['motion.attack.unit_elf_guardian_001']);
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });
    const order: string[] = [];

    const promise = plugin.play([
      {
        timer: 0,
        action: 'video',
        assetId: 'motion.attack.unit_elf_guardian_001',
        duration: 1600,
        playback: 'sequential',
      },
      {
        timer: 0,
        action: 'custom',
        run: () => {
          order.push('same-timer-custom');
        },
      },
    ]);
    await flushPromises();

    expect(order).toEqual([]);

    scene.videos[0]?.emit('complete');
    await promise;

    expect(order).toEqual(['same-timer-custom']);
  });

  it('keeps same-timer steps parallel by default', async () => {
    const scene = new FakeScene(['motion.attack.unit_elf_guardian_001']);
    const plugin = new SequencePlugin({ scene: scene.asPhaserScene() });
    const order: string[] = [];

    const promise = plugin.play([
      {
        timer: 0,
        action: 'video',
        assetId: 'motion.attack.unit_elf_guardian_001',
        duration: 1600,
      },
      {
        timer: 0,
        action: 'custom',
        run: () => {
          order.push('same-timer-custom');
        },
      },
    ]);
    await flushPromises();

    expect(order).toEqual(['same-timer-custom']);

    scene.videos[0]?.emit('complete');
    await promise;

    expect(order).toEqual(['same-timer-custom']);
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
  await Promise.resolve();
  await Promise.resolve();
}
