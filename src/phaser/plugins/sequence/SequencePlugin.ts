import type Phaser from 'phaser';
import { AnimationSequence } from './AnimationSequence';
import type {
  SequencePlayOptions,
  SequenceRuntimeContext,
  SequenceStep,
  SequenceTarget,
} from './sequence-types';

const DEFAULT_SHAKE = {
  durationMs: 180,
  intensity: 8,
  repeat: 3,
  ease: 'Sine.easeInOut',
} as const;

type TimedSequenceStepGroup = {
  timer: number;
  steps: SequenceStep[];
};

/**
 * Phaser Scene의 Tween/Timer를 감싸는 범용 시퀀스 연출 헬퍼다.
 *
 * 전투 규칙이나 저장 상태를 알지 않고, Scene이 전달한 GameObject와 좌표 기반 step만 재생한다.
 */
export class SequencePlugin {
  private readonly timers = new Set<Phaser.Time.TimerEvent>();
  private readonly timerResolvers = new Set<() => void>();
  private readonly tweens = new Set<Phaser.Tweens.Tween>();
  private destroyed = false;

  constructor(private readonly context: SequenceRuntimeContext) {}

  /**
   * step을 누적한 뒤 재생할 수 있는 AnimationSequence를 만든다.
   */
  createSequence(): AnimationSequence {
    return new AnimationSequence(this);
  }

  /**
   * 전달된 step들을 timer 기준으로 정렬해 재생한다.
   *
   * 같은 timer의 step은 동시에 시작하고, blocking step은 다음 timer 그룹 진행을 막는다.
   * detached step은 다음 그룹 진행을 막지 않지만 시퀀스 종료 전 allSettled로 정리한다.
   */
  async play(steps: readonly SequenceStep[], options: SequencePlayOptions = {}): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const groups = groupStepsByTimer(steps);
    const detached: Array<Promise<void>> = [];
    const startedAt = readNow();

    if (options.lockInput) {
      options.onLockChange?.(true);
    }

    try {
      for (const group of groups) {
        if (!this.canRun()) {
          break;
        }

        const elapsed = readNow() - startedAt;
        await this.delay(Math.max(0, group.timer - elapsed));

        if (!this.canRun()) {
          break;
        }

        const blocking: Array<Promise<void>> = [];
        for (const step of group.steps) {
          const runningStep = this.runStep(step);
          if ((step.mode ?? 'blocking') === 'detached') {
            detached.push(runningStep);
          } else {
            blocking.push(runningStep);
          }
        }

        await Promise.all(blocking);
      }

      await Promise.allSettled(detached);
    } finally {
      if (options.lockInput) {
        options.onLockChange?.(false);
      }
    }
  }

  /**
   * 이 plugin이 만든 timer와 tween을 정리하고 대기 중인 play를 해제한다.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    for (const timer of [...this.timers]) {
      this.context.scene.time.removeEvent(timer);
    }
    this.timers.clear();

    for (const resolve of [...this.timerResolvers]) {
      resolve();
    }
    this.timerResolvers.clear();

    for (const tween of [...this.tweens]) {
      tween.stop();
      tween.destroy();
    }
    this.tweens.clear();
  }

  private runStep(step: SequenceStep): Promise<void> {
    if (!this.canRun()) {
      return Promise.resolve();
    }

    if (step.action === 'wait') {
      return this.delay(step.duration ?? 0);
    }

    if (step.action === 'custom') {
      return Promise.resolve(step.run?.(this.context));
    }

    return this.playShake(step);
  }

  private delay(durationMs: number): Promise<void> {
    if (durationMs <= 0 || !this.canRun()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      let timer: Phaser.Time.TimerEvent | null = null;
      const settle = () => {
        if (settled) {
          return;
        }

        settled = true;
        if (timer) {
          this.timers.delete(timer);
        }
        this.timerResolvers.delete(settle);
        resolve();
      };

      this.timerResolvers.add(settle);
      timer = this.context.scene.time.delayedCall(durationMs, settle);
      this.timers.add(timer);
    });
  }

  private playShake(step: SequenceStep): Promise<void> {
    const target = step.target;
    if (!target || !this.canUseTarget(target)) {
      return Promise.resolve();
    }

    const duration = Math.max(0, step.duration ?? DEFAULT_SHAKE.durationMs);
    const intensity = Math.max(0, step.intensity ?? DEFAULT_SHAKE.intensity);
    const repeat = Math.max(0, step.repeat ?? DEFAULT_SHAKE.repeat);
    if (duration === 0 || intensity === 0 || repeat === 0) {
      return Promise.resolve();
    }

    const originalX = target.x;
    const originalY = target.y;
    const proxy = { progress: 0 };

    return new Promise((resolve) => {
      let tween: Phaser.Tweens.Tween | null = null;
      let settled = false;
      const resetTarget = () => {
        if (this.canResetTarget(target)) {
          target.x = originalX;
          target.y = originalY;
        }
      };
      const settle = () => {
        if (settled) {
          return;
        }

        settled = true;
        if (tween) {
          this.tweens.delete(tween);
        }
        resetTarget();
        resolve();
      };

      tween = this.context.scene.tweens.add({
        targets: proxy,
        progress: 1,
        duration,
        ease: step.ease ?? DEFAULT_SHAKE.ease,
        onUpdate: () => {
          if (!this.canUseTarget(target)) {
            tween?.stop();
            return;
          }

          const horizontal = Math.sin(proxy.progress * Math.PI * repeat * 2);
          const vertical = Math.cos(proxy.progress * Math.PI * repeat * 4) * 0.35;
          target.x = originalX + horizontal * intensity;
          target.y = originalY + vertical * intensity;
        },
        onComplete: settle,
        onStop: settle,
      });
      this.tweens.add(tween);
    });
  }

  private canRun(): boolean {
    return !this.destroyed && this.context.scene.scene.isActive();
  }

  private canUseTarget(target: SequenceTarget): boolean {
    return this.canRun() && target.active && target.scene === this.context.scene;
  }

  private canResetTarget(target: SequenceTarget): boolean {
    return target.active && target.scene === this.context.scene;
  }
}

/**
 * 시퀀스 step을 절대 timer 값 기준으로 묶고 오름차순 정렬한다.
 */
function groupStepsByTimer(steps: readonly SequenceStep[]): TimedSequenceStepGroup[] {
  const groups = new Map<number, SequenceStep[]>();
  for (const step of steps) {
    const timer = Math.max(0, step.timer);
    const group = groups.get(timer);
    if (group) {
      group.push(step);
      continue;
    }

    groups.set(timer, [step]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([timer, group]) => ({
      timer,
      steps: group,
    }));
}

/**
 * 브라우저와 테스트 환경에서 사용할 현재 시간을 밀리초로 읽는다.
 */
function readNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}
