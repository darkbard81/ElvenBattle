export type LayoutType = 'hbox' | 'vbox' | 'grid';
export type Align = 'start' | 'center' | 'end' | 'stretch';
export type Fit = 'none' | 'stretch' | 'contain';
export type Anchor = 'top-left' | 'center' | 'bottom-right';
export type Justify = 'start' | 'center' | 'end' | 'space-between';
export type LayoutLayer = 'flow' | 'overlay';
export type LayoutLength = number | `${number}%`;

export type LayoutGameObject = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  setPosition: (x: number, y: number) => unknown;
  setDisplaySize?: (width: number, height: number) => unknown;
  setScale?: (x: number, y?: number) => unknown;
};

export type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ChildOptions = {
  width?: LayoutLength;
  height?: LayoutLength;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  grow?: number;
  alignSelf?: Align;
  fit?: Fit;
  margin?: Partial<Padding>;
  layer?: LayoutLayer;
  x?: LayoutLength;
  y?: LayoutLength;
  anchor?: Anchor;
};

export type DebugDrawOptions =
  | boolean
  | {
      color?: number;
      alpha?: number;
      lineWidth?: number;
      includeChildren?: boolean;
    };

export type LayoutBoxOptions = {
  x?: number;
  y?: number;
  gap?: number;
  padding?: number | Partial<Padding>;
  align?: Align;
  justify?: Justify;
  anchor?: Anchor;
  columns?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  debug?: DebugDrawOptions;
};

type LayoutChild = {
  target: LayoutBox | LayoutGameObject;
  options: NormalizedChildOptions;
};

type NormalizedChildOptions = {
  width: LayoutLength | null;
  height: LayoutLength | null;
  minWidth: number | null;
  maxWidth: number | null;
  minHeight: number | null;
  maxHeight: number | null;
  grow: number;
  alignSelf: Align | null;
  fit: Fit;
  margin: Padding;
  layer: LayoutLayer;
  x: LayoutLength | null;
  y: LayoutLength | null;
  anchor: Anchor;
};

type DebugDrawConfig = {
  color: number;
  alpha: number;
  lineWidth: number;
  includeChildren: boolean;
};

type ChildFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RexSlotFrame = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  originX?: number;
  originY?: number;
  setOrigin?: (x: number, y?: number) => unknown;
  setVisible?: (visible: boolean) => unknown;
  setDisplaySize?: (width: number, height: number) => unknown;
  destroy?: (fromScene?: boolean) => void;
};

type RexSizerObject = RexSlotFrame & {
  add: (gameObject: Phaser.GameObjects.GameObject, config?: Record<string, unknown>) => unknown;
  addSpace?: (proportion?: number) => unknown;
  layout: () => unknown;
  setDirty?: (dirty?: boolean) => unknown;
};

type RexGridSizerObject = RexSlotFrame & {
  add: (gameObject: Phaser.GameObjects.GameObject, config?: Record<string, unknown>) => unknown;
  layout: () => unknown;
  setDirty?: (dirty?: boolean) => unknown;
};

type RexOverlapSizerObject = RexSlotFrame & {
  add: (gameObject: Phaser.GameObjects.GameObject, config?: Record<string, unknown>) => unknown;
  layout: () => unknown;
  setDirty?: (dirty?: boolean) => unknown;
};

type RexUIAdapter = {
  add: {
    sizer: (...args: unknown[]) => RexSizerObject;
    gridSizer: (...args: unknown[]) => RexGridSizerObject;
    overlapSizer: (...args: unknown[]) => RexOverlapSizerObject;
  };
};

type RexLayoutFrame = {
  child: LayoutChild;
  frame: RexSlotFrame;
};

const ZERO_PADDING: Padding = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const DEFAULT_DEBUG_DRAW: DebugDrawConfig = {
  color: 0x00ffcc,
  alpha: 0.8,
  lineWidth: 2,
  includeChildren: true,
};

function normalizePadding(value?: number | Partial<Padding>): Padding {
  if (typeof value === 'number') {
    return {
      top: value,
      right: value,
      bottom: value,
      left: value,
    };
  }

  return {
    ...ZERO_PADDING,
    ...value,
  };
}

function normalizeChildOptions(
  options: ChildOptions = {},
  layerOverride?: LayoutLayer,
): NormalizedChildOptions {
  return {
    width: options.width ?? null,
    height: options.height ?? null,
    minWidth: options.minWidth ?? null,
    maxWidth: options.maxWidth ?? null,
    minHeight: options.minHeight ?? null,
    maxHeight: options.maxHeight ?? null,
    grow: Math.max(0, options.grow ?? 0),
    alignSelf: options.alignSelf ?? null,
    fit: options.fit ?? 'none',
    margin: normalizePadding(options.margin),
    layer: layerOverride ?? options.layer ?? 'flow',
    x: options.x ?? null,
    y: options.y ?? null,
    anchor: options.anchor ?? 'top-left',
  };
}

function normalizeDebugDrawOptions(value?: DebugDrawOptions): DebugDrawConfig | null {
  if (!value) {
    return null;
  }

  if (value === true) {
    return DEFAULT_DEBUG_DRAW;
  }

  return {
    color: value.color ?? DEFAULT_DEBUG_DRAW.color,
    alpha: value.alpha ?? DEFAULT_DEBUG_DRAW.alpha,
    lineWidth: value.lineWidth ?? DEFAULT_DEBUG_DRAW.lineWidth,
    includeChildren: value.includeChildren ?? DEFAULT_DEBUG_DRAW.includeChildren,
  };
}

function isLayoutBox(value: LayoutBox | LayoutGameObject): value is LayoutBox {
  return value instanceof LayoutBox;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRexUIAdapter(scene: Phaser.Scene): RexUIAdapter | null {
  const maybeScene = scene as Phaser.Scene & { rexUI?: unknown };
  const rexUI = maybeScene.rexUI;
  if (!isRecord(rexUI) || !isRecord(rexUI.add)) {
    return null;
  }

  return typeof rexUI.add.sizer === 'function' &&
    typeof rexUI.add.gridSizer === 'function' &&
    typeof rexUI.add.overlapSizer === 'function'
    ? (rexUI as unknown as RexUIAdapter)
    : null;
}

function hasZoneFactory(scene: Phaser.Scene): boolean {
  return typeof scene.add.zone === 'function';
}

function getObjectWidth(target: LayoutBox | LayoutGameObject): number {
  if (isLayoutBox(target)) return target.layoutWidth;
  return target.displayWidth ?? target.width ?? 0;
}

function getObjectHeight(target: LayoutBox | LayoutGameObject): number {
  if (isLayoutBox(target)) return target.layoutHeight;
  return target.displayHeight ?? target.height ?? 0;
}

function getObjectNaturalWidth(target: LayoutGameObject): number {
  return target.width ?? target.displayWidth ?? 0;
}

function getObjectNaturalHeight(target: LayoutGameObject): number {
  return target.height ?? target.displayHeight ?? 0;
}

function resolveLength(value: LayoutLength | null, reference: number, fallback: number): number {
  if (value === null) {
    return fallback;
  }

  if (typeof value === 'number') {
    return value;
  }

  const percentage = Number.parseFloat(value);
  if (!Number.isFinite(percentage)) {
    return fallback;
  }

  return (reference * percentage) / 100;
}

function clampLength(value: number, min: number | null, max: number | null): number {
  let result = Math.max(0, value);

  if (max !== null) {
    result = Math.min(result, max);
  }

  if (min !== null) {
    result = Math.max(result, min);
  }

  return Math.max(0, result);
}

function getAnchoredTopLeft(
  x: number,
  y: number,
  width: number,
  height: number,
  anchor: Anchor,
): { x: number; y: number } {
  if (anchor === 'center') {
    return {
      x: x - width / 2,
      y: y - height / 2,
    };
  }

  if (anchor === 'bottom-right') {
    return {
      x: x - width,
      y: y - height,
    };
  }

  return { x, y };
}

function setObjectSize(target: LayoutGameObject, width: number, height: number, fit: Fit): void {
  if (fit === 'stretch' && target.setDisplaySize) {
    target.setDisplaySize(width, height);
    return;
  }

  if (fit === 'contain' && target.setScale) {
    const naturalWidth = getObjectNaturalWidth(target);
    const naturalHeight = getObjectNaturalHeight(target);

    if (naturalWidth <= 0 || naturalHeight <= 0) return;

    const scale = Math.min(width / naturalWidth, height / naturalHeight);
    target.setScale(scale);
  }
}

function applyTargetBounds(
  target: LayoutBox | LayoutGameObject,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: Fit,
): void {
  if (isLayoutBox(target)) {
    target.container.setPosition(x, y);
    target.resize(width, height);
    return;
  }

  target.setPosition(x, y);
  setObjectSize(target, width, height, fit);
}

function toRexLinearAlign(type: 'hbox' | 'vbox', align: Align): string {
  if (align === 'stretch' || align === 'center') {
    return 'center';
  }

  if (type === 'hbox') {
    return align === 'end' ? 'bottom' : 'top';
  }

  return align === 'end' ? 'right' : 'left';
}

function toRexGridAlign(align: Align, justify: Justify): string {
  const horizontal = justify === 'end' ? 'right' : justify === 'center' ? 'center' : 'left';
  const vertical = align === 'end' ? 'bottom' : align === 'center' ? 'center' : 'top';

  return `${horizontal}-${vertical}`;
}

function readFrameBounds(frame: RexSlotFrame): ChildFrame {
  const width = Math.max(0, frame.displayWidth ?? frame.width ?? 0);
  const height = Math.max(0, frame.displayHeight ?? frame.height ?? 0);
  const originX = frame.originX ?? 0;
  const originY = frame.originY ?? 0;

  return {
    x: frame.x - width * originX,
    y: frame.y - height * originY,
    width,
    height,
  };
}

/**
 * Phaser 컨테이너 안에서 간단한 hbox, vbox, grid 배치를 수행하는 렌더링 전용 유틸이다.
 *
 * 게임 규칙이나 저장 상태를 소유하지 않고, Scene이 만든 표시 객체를 정해진 영역 안에
 * 배치하는 역할만 담당한다. `overlay` 레이어는 flow 배치 계산에서 제외되며 항상 위에
 * 그려지는 절대 배치용 레이어로 사용한다.
 *
 * Scene 전환 작업에서는 직접 자식을 가능하면 `Phaser.GameObjects.Container`로 감싼다.
 * 컨테이너 내부 요소는 로컬 좌표를 기준으로 배치하고, 단일 `Text`, `Rectangle`, `Image`를
 * 직접 넣는 경우에는 origin과 display 크기 기준이 원하는 배치 기준과 맞는지 확인한다.
 * 텍스트 변경처럼 자식의 표시 크기가 달라지는 작업 뒤에는 `markDirty()` 후 같은 bounds로
 * `layout()` 또는 `resize()`를 다시 호출하거나, 기존 Scene 패턴처럼 컨테이너를 재렌더링한다.
 */
export class LayoutBox {
  public readonly container: Phaser.GameObjects.Container;

  public readonly flowLayer: Phaser.GameObjects.Container;
  public readonly overlayLayer: Phaser.GameObjects.Container;

  public layoutWidth = 0;
  public layoutHeight = 0;

  private readonly type: LayoutType;
  private readonly gap: number;
  private readonly padding: Padding;
  private readonly align: Align;
  private readonly justify: Justify;
  private readonly anchor: Anchor;
  private readonly columns: number;
  private readonly minWidth: number | null;
  private readonly maxWidth: number | null;
  private readonly minHeight: number | null;
  private readonly maxHeight: number | null;
  private readonly debugDraw: DebugDrawConfig | null;

  private readonly children: LayoutChild[] = [];
  private readonly overlayChildren: LayoutChild[] = [];
  private readonly debugFrames: ChildFrame[] = [];

  private readonly scene: Phaser.Scene;
  private readonly rexUI: RexUIAdapter | null;
  private readonly rexLayoutObjects: RexSlotFrame[] = [];
  private readonly debugGraphics: Phaser.GameObjects.Graphics | null;
  private dirty = true;

  constructor(scene: Phaser.Scene, type: LayoutType, options: LayoutBoxOptions = {}) {
    this.scene = scene;
    this.rexUI = readRexUIAdapter(scene);
    this.type = type;
    this.gap = options.gap ?? 0;
    this.padding = normalizePadding(options.padding);
    this.align = options.align ?? 'start';
    this.justify = options.justify ?? 'start';
    this.anchor = options.anchor ?? 'top-left';
    this.columns = options.columns ?? 1;
    this.minWidth = options.minWidth ?? null;
    this.maxWidth = options.maxWidth ?? null;
    this.minHeight = options.minHeight ?? null;
    this.maxHeight = options.maxHeight ?? null;
    this.debugDraw = normalizeDebugDrawOptions(options.debug);

    this.container = scene.add.container(options.x ?? 0, options.y ?? 0);
    this.flowLayer = scene.add.container(0, 0);
    this.overlayLayer = scene.add.container(0, 0);
    this.container.add(this.flowLayer);
    this.container.add(this.overlayLayer);

    this.debugGraphics = this.debugDraw ? scene.add.graphics() : null;
    if (this.debugGraphics) {
      this.overlayLayer.add(this.debugGraphics);
    }

    const maybeContainer = this.container as Phaser.GameObjects.Container & {
      once?: (event: string, callback: () => void) => unknown;
    };
    if (typeof maybeContainer.once === 'function') {
      maybeContainer.once('destroy', () => {
        this.clearRexLayoutObjects();
      });
    }
  }

  /**
   * 자식 표시 객체를 flow 레이어에 추가하고 다음 layout 호출에서 다시 배치되도록 표시한다.
   */
  add(target: LayoutBox | LayoutGameObject, options: ChildOptions = {}): this {
    const child = {
      target,
      options: normalizeChildOptions(options),
    };

    if (child.options.layer === 'overlay') {
      this.overlayChildren.push(child);
      this.addTargetToLayer(this.overlayLayer, target);
    } else {
      this.children.push(child);
      this.addTargetToLayer(this.flowLayer, target);
    }

    this.markDirty();
    return this;
  }

  /**
   * 자식 표시 객체를 flow 계산에서 제외되는 절대 overlay 레이어에 추가한다.
   */
  addOverlay(target: LayoutBox | LayoutGameObject, options: ChildOptions = {}): this {
    const child = {
      target,
      options: normalizeChildOptions(options, 'overlay'),
    };

    this.overlayChildren.push(child);
    this.addTargetToLayer(this.overlayLayer, target);
    this.markDirty();
    return this;
  }

  /**
   * 전달된 좌표를 이 박스의 anchor 기준점으로 해석해 컨테이너 위치와 내부 배치를 갱신한다.
   */
  layout(x: number, y: number, width: number, height: number): this {
    const nextWidth = clampLength(width, this.minWidth, this.maxWidth);
    const nextHeight = clampLength(height, this.minHeight, this.maxHeight);
    const topLeft = getAnchoredTopLeft(x, y, nextWidth, nextHeight, this.anchor);

    this.container.setPosition(topLeft.x, topLeft.y);
    this.applyLayoutSize(nextWidth, nextHeight);

    return this;
  }

  /**
   * 현재 컨테이너 위치를 유지한 채 내부 배치 영역만 갱신한다.
   */
  resize(width: number, height: number): this {
    this.applyLayoutSize(
      clampLength(width, this.minWidth, this.maxWidth),
      clampLength(height, this.minHeight, this.maxHeight),
    );

    return this;
  }

  /**
   * 다음 layout 또는 resize 호출에서 자식 배치를 다시 계산하도록 표시한다.
   */
  markDirty(): this {
    this.dirty = true;
    return this;
  }

  /**
   * 이 박스나 중첩된 자식 박스 중 다시 배치해야 할 항목이 있는지 알려준다.
   */
  get isDirty(): boolean {
    return this.dirty || this.hasDirtyChild();
  }

  private applyLayoutSize(width: number, height: number): void {
    const shouldLayout = this.isDirty || this.layoutWidth !== width || this.layoutHeight !== height;

    this.layoutWidth = width;
    this.layoutHeight = height;

    if (!shouldLayout) {
      return;
    }

    this.debugFrames.length = 0;

    if (this.canUseRexLayout()) {
      this.layoutWithRex(width, height);
    } else if (this.type === 'hbox') {
      this.layoutHBox(width, height);
    } else if (this.type === 'vbox') {
      this.layoutVBox(width, height);
    } else {
      this.layoutGrid(width, height);
    }

    this.layoutOverlay(width, height);
    this.drawDebug();
    this.dirty = false;
  }

  private canUseRexLayout(): boolean {
    return this.rexUI !== null && hasZoneFactory(this.scene);
  }

  private layoutWithRex(width: number, height: number): void {
    this.clearRexLayoutObjects();

    if (this.type === 'grid') {
      this.layoutGridWithRex(width, height);
    } else {
      this.layoutLinearWithRex(width, height, this.type);
    }

    this.layoutOverlayWithRex(width, height);
  }

  private clearRexLayoutObjects(): void {
    while (this.rexLayoutObjects.length > 0) {
      const object = this.rexLayoutObjects.pop();
      object?.destroy?.();
    }
  }

  private addTargetToLayer(
    layer: Phaser.GameObjects.Container,
    target: LayoutBox | LayoutGameObject,
  ): void {
    layer.add(isLayoutBox(target) ? target.container : target);
  }

  private hasDirtyChild(): boolean {
    return [...this.children, ...this.overlayChildren].some(
      (child) => isLayoutBox(child.target) && child.target.isDirty,
    );
  }

  private layoutLinearWithRex(width: number, height: number, type: 'hbox' | 'vbox'): void {
    const rexUI = this.rexUI;
    if (!rexUI) {
      return;
    }

    const sizer = rexUI.add.sizer(0, 0, width, height, type === 'hbox' ? 'x' : 'y', {
      origin: 0,
      space: {
        left: this.padding.left,
        right: this.padding.right,
        top: this.padding.top,
        bottom: this.padding.bottom,
        item: this.gap,
      },
    });
    this.trackRexObject(sizer);
    const frames: RexLayoutFrame[] = [];

    if (this.justify === 'center') {
      this.addRexSpace(sizer);
    } else if (this.justify === 'end') {
      this.addRexSpace(sizer);
    }

    this.children.forEach((child, index) => {
      const frame = this.createRexSlotFrame(
        this.resolveChildWidth(child, width, getObjectWidth(child.target)),
        this.resolveChildHeight(child, height, getObjectHeight(child.target)),
      );
      const align = child.options.alignSelf ?? this.align;
      const expand =
        align === 'stretch' &&
        ((type === 'hbox' && child.options.height === null) ||
          (type === 'vbox' && child.options.width === null));
      const proportion = type === 'hbox' || type === 'vbox' ? child.options.grow : 0;

      sizer.add(frame, {
        proportion,
        align: toRexLinearAlign(type, align),
        padding: child.options.margin,
        expand,
        minWidth: frame.displayWidth ?? frame.width ?? 0,
        minHeight: frame.displayHeight ?? frame.height ?? 0,
      });
      frames.push({ child, frame });

      if (this.justify === 'space-between' && index < this.children.length - 1) {
        this.addRexSpace(sizer);
      }
    });

    if (this.justify === 'center') {
      this.addRexSpace(sizer);
    }

    sizer.setDirty?.(true);
    sizer.layout();
    this.applyRexFrames(frames);
  }

  private layoutGridWithRex(width: number, height: number): void {
    const rexUI = this.rexUI;
    if (!rexUI || this.children.length === 0) {
      return;
    }

    const columns = Math.max(1, Math.floor(this.columns));
    const rows = Math.max(1, Math.ceil(this.children.length / columns));
    const gridSizer = rexUI.add.gridSizer(0, 0, width, height, columns, rows, 1, 1, {
      origin: 0,
      space: {
        left: this.padding.left,
        right: this.padding.right,
        top: this.padding.top,
        bottom: this.padding.bottom,
        column: this.gap,
        row: this.gap,
      },
    });
    this.trackRexObject(gridSizer);
    const frames: RexLayoutFrame[] = [];

    this.children.forEach((child, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const frame = this.createRexSlotFrame(
        this.resolveChildWidth(child, width, getObjectWidth(child.target)),
        this.resolveChildHeight(child, height, getObjectHeight(child.target)),
      );
      const align = child.options.alignSelf ?? this.align;

      gridSizer.add(frame, {
        column,
        row,
        align: toRexGridAlign(align, this.justify),
        padding: child.options.margin,
        expand: align === 'stretch',
      });
      frames.push({ child, frame });
    });

    gridSizer.setDirty?.(true);
    gridSizer.layout();
    this.applyRexFrames(frames);
  }

  private layoutOverlayWithRex(width: number, height: number): void {
    const rexUI = this.rexUI;
    if (!rexUI || this.overlayChildren.length === 0) {
      return;
    }

    const overlapSizer = rexUI.add.overlapSizer(0, 0, width, height, {
      origin: 0,
    });
    this.trackRexObject(overlapSizer);
    const innerWidth = Math.max(0, width - this.padding.left - this.padding.right);
    const innerHeight = Math.max(0, height - this.padding.top - this.padding.bottom);
    const frames: RexLayoutFrame[] = [];

    this.overlayChildren.forEach((child) => {
      const baseWidth = getObjectWidth(child.target);
      const baseHeight = getObjectHeight(child.target);
      const childWidth = this.resolveChildWidth(child, innerWidth, baseWidth);
      const childHeight = this.resolveChildHeight(child, innerHeight, baseHeight);
      const anchorX = this.padding.left + resolveLength(child.options.x, innerWidth, 0);
      const anchorY = this.padding.top + resolveLength(child.options.y, innerHeight, 0);
      const topLeft = getAnchoredTopLeft(
        anchorX,
        anchorY,
        childWidth,
        childHeight,
        child.options.anchor,
      );
      const frame = this.createRexSlotFrame(childWidth, childHeight);

      overlapSizer.add(frame, {
        align: 'left-top',
        offsetX: topLeft.x,
        offsetY: topLeft.y,
        expand: false,
        minWidth: childWidth,
        minHeight: childHeight,
      });
      frames.push({ child, frame });
    });

    overlapSizer.setDirty?.(true);
    overlapSizer.layout();
    this.applyRexFrames(frames);
  }

  private addRexSpace(sizer: RexSizerObject): void {
    if (sizer.addSpace) {
      sizer.addSpace(1);
      return;
    }

    const frame = this.createRexSlotFrame(0, 0);
    sizer.add(frame, {
      proportion: 1,
      minWidth: 0,
      minHeight: 0,
    });
  }

  private createRexSlotFrame(width: number, height: number): RexSlotFrame {
    const frame = this.scene.add.zone(0, 0, width, height) as RexSlotFrame;
    frame.setOrigin?.(0, 0);
    frame.setVisible?.(false);
    frame.setDisplaySize?.(width, height);
    this.trackRexObject(frame);

    return frame;
  }

  private trackRexObject<T extends RexSlotFrame>(object: T): T {
    object.setVisible?.(false);
    this.rexLayoutObjects.push(object);
    return object;
  }

  private applyRexFrames(frames: RexLayoutFrame[]): void {
    frames.forEach(({ child, frame }) => {
      const bounds = readFrameBounds(frame);
      this.applyChildBounds(child, bounds.x, bounds.y, bounds.width, bounds.height);
    });
  }

  private layoutHBox(width: number, height: number): void {
    const innerX = this.padding.left;
    const innerY = this.padding.top;
    const innerWidth = Math.max(0, width - this.padding.left - this.padding.right);
    const innerHeight = Math.max(0, height - this.padding.top - this.padding.bottom);

    const totalGap = Math.max(0, this.children.length - 1) * this.gap;
    const baseWidths = this.children.map((child) =>
      this.resolveChildWidth(child, innerWidth, getObjectWidth(child.target)),
    );
    const fixedWidth = this.children.reduce(
      (sum, child, index) =>
        sum + (baseWidths[index] ?? 0) + child.options.margin.left + child.options.margin.right,
      0,
    );

    const totalGrow = this.children.reduce((sum, child) => sum + child.options.grow, 0);

    const remainWidth = Math.max(0, innerWidth - fixedWidth - totalGap);
    const childWidths = this.children.map((child, index) => {
      const growWidth = totalGrow > 0 ? (remainWidth * child.options.grow) / totalGrow : 0;
      return this.clampChildWidth(child, (baseWidths[index] ?? 0) + growWidth);
    });
    const usedWidth =
      childWidths.reduce((sum, childWidth, index) => {
        const child = this.children[index];
        if (!child) {
          return sum;
        }

        return sum + childWidth + child.options.margin.left + child.options.margin.right;
      }, 0) + totalGap;
    const justifyRemainWidth = Math.max(0, innerWidth - usedWidth);
    const layoutGap =
      this.justify === 'space-between' && this.children.length > 1
        ? this.gap + justifyRemainWidth / (this.children.length - 1)
        : this.gap;

    let cursorX = innerX + this.getJustifyOffset(justifyRemainWidth);

    this.children.forEach((child, index) => {
      const margin = child.options.margin;
      const childWidth = childWidths[index] ?? 0;
      const align = child.options.alignSelf ?? this.align;

      const childHeight =
        child.options.height !== null
          ? this.resolveChildHeight(child, innerHeight, getObjectHeight(child.target))
          : align === 'stretch'
            ? this.clampChildHeight(child, innerHeight - margin.top - margin.bottom)
            : this.resolveChildHeight(child, innerHeight, getObjectHeight(child.target));

      let childY = innerY + margin.top;

      if (align === 'center') {
        childY = innerY + (innerHeight - childHeight) / 2;
      } else if (align === 'end') {
        childY = innerY + innerHeight - childHeight - margin.bottom;
      }

      const childX = cursorX + margin.left;

      this.applyChildBounds(child, childX, childY, childWidth, childHeight);

      cursorX += childWidth + margin.left + margin.right + layoutGap;
    });
  }

  private layoutVBox(width: number, height: number): void {
    const innerX = this.padding.left;
    const innerY = this.padding.top;
    const innerWidth = Math.max(0, width - this.padding.left - this.padding.right);
    const innerHeight = Math.max(0, height - this.padding.top - this.padding.bottom);

    const totalGap = Math.max(0, this.children.length - 1) * this.gap;
    const baseHeights = this.children.map((child) =>
      this.resolveChildHeight(child, innerHeight, getObjectHeight(child.target)),
    );
    const fixedHeight = this.children.reduce(
      (sum, child, index) =>
        sum + (baseHeights[index] ?? 0) + child.options.margin.top + child.options.margin.bottom,
      0,
    );

    const totalGrow = this.children.reduce((sum, child) => sum + child.options.grow, 0);

    const remainHeight = Math.max(0, innerHeight - fixedHeight - totalGap);
    const childHeights = this.children.map((child, index) => {
      const growHeight = totalGrow > 0 ? (remainHeight * child.options.grow) / totalGrow : 0;
      return this.clampChildHeight(child, (baseHeights[index] ?? 0) + growHeight);
    });
    const usedHeight =
      childHeights.reduce((sum, childHeight, index) => {
        const child = this.children[index];
        if (!child) {
          return sum;
        }

        return sum + childHeight + child.options.margin.top + child.options.margin.bottom;
      }, 0) + totalGap;
    const justifyRemainHeight = Math.max(0, innerHeight - usedHeight);
    const layoutGap =
      this.justify === 'space-between' && this.children.length > 1
        ? this.gap + justifyRemainHeight / (this.children.length - 1)
        : this.gap;

    let cursorY = innerY + this.getJustifyOffset(justifyRemainHeight);

    this.children.forEach((child, index) => {
      const margin = child.options.margin;
      const childHeight = childHeights[index] ?? 0;
      const align = child.options.alignSelf ?? this.align;

      const childWidth =
        child.options.width !== null
          ? this.resolveChildWidth(child, innerWidth, getObjectWidth(child.target))
          : align === 'stretch'
            ? this.clampChildWidth(child, innerWidth - margin.left - margin.right)
            : this.resolveChildWidth(child, innerWidth, getObjectWidth(child.target));

      let childX = innerX + margin.left;

      if (align === 'center') {
        childX = innerX + (innerWidth - childWidth) / 2;
      } else if (align === 'end') {
        childX = innerX + innerWidth - childWidth - margin.right;
      }

      const childY = cursorY + margin.top;

      this.applyChildBounds(child, childX, childY, childWidth, childHeight);

      cursorY += childHeight + margin.top + margin.bottom + layoutGap;
    });
  }

  private layoutGrid(width: number, height: number): void {
    const innerX = this.padding.left;
    const innerY = this.padding.top;
    const innerWidth = Math.max(0, width - this.padding.left - this.padding.right);

    const columns = Math.max(1, Math.floor(this.columns));
    const rows = Math.ceil(this.children.length / columns);

    const cellWidth = Math.max(0, (innerWidth - this.gap * (columns - 1)) / columns);

    const innerHeight = Math.max(0, height - this.padding.top - this.padding.bottom);
    const cellHeight = rows > 0 ? Math.max(0, (innerHeight - this.gap * (rows - 1)) / rows) : 0;

    this.children.forEach((child, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      const margin = child.options.margin;

      const cellX = innerX + col * (cellWidth + this.gap);
      const cellY = innerY + row * (cellHeight + this.gap);
      const availableWidth = Math.max(0, cellWidth - margin.left - margin.right);
      const availableHeight = Math.max(0, cellHeight - margin.top - margin.bottom);
      const align = child.options.alignSelf ?? this.align;

      const childWidth =
        child.options.width !== null
          ? this.resolveChildWidth(child, cellWidth, availableWidth)
          : availableWidth;

      const childHeight =
        child.options.height !== null
          ? this.resolveChildHeight(child, cellHeight, availableHeight)
          : align === 'stretch'
            ? availableHeight
            : availableHeight;

      const x = cellX + margin.left + this.getGridJustifyOffset(availableWidth, childWidth);
      const y = cellY + margin.top + this.getAlignOffset(availableHeight, childHeight, align);

      this.applyChildBounds(child, x, y, childWidth, childHeight);
    });
  }

  private layoutOverlay(width: number, height: number): void {
    const innerX = this.padding.left;
    const innerY = this.padding.top;
    const innerWidth = Math.max(0, width - this.padding.left - this.padding.right);
    const innerHeight = Math.max(0, height - this.padding.top - this.padding.bottom);

    this.overlayChildren.forEach((child) => {
      const baseWidth = getObjectWidth(child.target);
      const baseHeight = getObjectHeight(child.target);
      const childWidth = this.resolveChildWidth(child, innerWidth, baseWidth);
      const childHeight = this.resolveChildHeight(child, innerHeight, baseHeight);
      const anchorX = innerX + resolveLength(child.options.x, innerWidth, 0);
      const anchorY = innerY + resolveLength(child.options.y, innerHeight, 0);
      const topLeft = getAnchoredTopLeft(
        anchorX,
        anchorY,
        childWidth,
        childHeight,
        child.options.anchor,
      );

      this.applyChildBounds(child, topLeft.x, topLeft.y, childWidth, childHeight);
    });
  }

  private applyChildBounds(
    child: LayoutChild,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    applyTargetBounds(child.target, x, y, width, height, child.options.fit);
    this.debugFrames.push({ x, y, width, height });
  }

  private resolveChildWidth(child: LayoutChild, reference: number, fallback: number): number {
    return this.clampChildWidth(child, resolveLength(child.options.width, reference, fallback));
  }

  private resolveChildHeight(child: LayoutChild, reference: number, fallback: number): number {
    return this.clampChildHeight(child, resolveLength(child.options.height, reference, fallback));
  }

  private clampChildWidth(child: LayoutChild, value: number): number {
    return clampLength(value, child.options.minWidth, child.options.maxWidth);
  }

  private clampChildHeight(child: LayoutChild, value: number): number {
    return clampLength(value, child.options.minHeight, child.options.maxHeight);
  }

  private getJustifyOffset(remaining: number): number {
    if (this.justify === 'center') {
      return remaining / 2;
    }

    if (this.justify === 'end') {
      return remaining;
    }

    return 0;
  }

  private getGridJustifyOffset(availableWidth: number, childWidth: number): number {
    if (this.justify === 'center') {
      return Math.max(0, (availableWidth - childWidth) / 2);
    }

    if (this.justify === 'end') {
      return Math.max(0, availableWidth - childWidth);
    }

    return 0;
  }

  private getAlignOffset(availableHeight: number, childHeight: number, align: Align): number {
    if (align === 'center') {
      return Math.max(0, (availableHeight - childHeight) / 2);
    }

    if (align === 'end') {
      return Math.max(0, availableHeight - childHeight);
    }

    return 0;
  }

  private drawDebug(): void {
    if (!this.debugGraphics || !this.debugDraw) {
      return;
    }

    this.debugGraphics.clear();
    this.debugGraphics.lineStyle(
      this.debugDraw.lineWidth,
      this.debugDraw.color,
      this.debugDraw.alpha,
    );
    this.debugGraphics.strokeRect(0, 0, this.layoutWidth, this.layoutHeight);

    if (!this.debugDraw.includeChildren) {
      return;
    }

    this.debugFrames.forEach((frame) => {
      this.debugGraphics?.strokeRect(frame.x, frame.y, frame.width, frame.height);
    });
  }
}
