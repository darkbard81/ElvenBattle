import type Phaser from 'phaser';

export type SequencePlayMode = 'blocking' | 'detached';

export type SequenceStepAction = 'wait' | 'shake' | 'custom';

export type SequencePoint = {
  x: number;
  y: number;
};

export type SequenceTarget = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
};

export type SequenceRuntimeContext = {
  scene: Phaser.Scene;
  layer?: Phaser.GameObjects.Container;
};

export type SequenceStep = {
  /** 시퀀스 시작 후 실행 시점(ms)이다. */
  timer: number;

  /** tween 또는 표시 지속 시간(ms)이다. */
  duration?: number;

  /** blocking은 완료 대기, detached는 자율 재생한다. */
  mode?: SequencePlayMode;

  /** 기존 GameObject 대상이다. 1차 구현의 shake는 이 값을 사용한다. */
  target?: SequenceTarget;

  /** 추후 x/y 기반 이펙트 생성에 사용할 좌표다. */
  x?: number;
  y?: number;

  /** 추후 이동형 이펙트의 시작/종료 좌표로 사용할 값이다. */
  from?: SequencePoint;
  to?: SequencePoint;

  /** 추후 texture, atlas frame, prefab성 연출 식별자에 사용한다. */
  assetId?: string;

  /** 흔들림 강도(px)다. shake action에서 사용한다. */
  intensity?: number;

  /** 흔들림 반복 횟수다. shake action에서 사용한다. */
  repeat?: number;

  /** Phaser tween easing 이름이다. shake action에서 사용한다. */
  ease?: string;

  action: SequenceStepAction;

  /** 특수 연출이 필요할 때만 실행하는 사용자 정의 처리다. */
  run?: (context: SequenceRuntimeContext) => Promise<void> | void;
};

export type SequencePlayOptions = {
  /** true이면 play 중 입력 잠금 콜백을 호출한다. */
  lockInput?: boolean;
  onLockChange?: (locked: boolean) => void;
};
