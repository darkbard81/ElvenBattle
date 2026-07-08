import type { SequencePlugin } from './SequencePlugin';
import type { SequencePlayOptions, SequenceStep } from './sequence-types';

/**
 * 순차/동시 연출 step을 모아 SequencePlugin으로 재생하는 빌더다.
 */
export class AnimationSequence {
  private readonly steps: SequenceStep[] = [];

  constructor(private readonly plugin: SequencePlugin) {}

  /**
   * 재생할 step을 추가하고 같은 sequence 인스턴스를 반환한다.
   */
  add(step: SequenceStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * 지금까지 추가한 step을 현재 plugin context에서 재생한다.
   */
  play(options: SequencePlayOptions = {}): Promise<void> {
    return this.plugin.play(this.steps, options);
  }
}
