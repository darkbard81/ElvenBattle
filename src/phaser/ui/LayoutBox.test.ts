import { describe, expect, it } from 'vitest';
import { LayoutBox, type LayoutGameObject } from './LayoutBox';

class FakeGameObject {
  public x = 0;
  public y = 0;
  public displayWidth: number;
  public displayHeight: number;
  public scaleX = 1;
  public scaleY = 1;
  public positionCalls = 0;

  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {
    this.displayWidth = width;
    this.displayHeight = height;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.positionCalls += 1;
    return this;
  }

  setDisplaySize(width: number, height: number): this {
    this.displayWidth = width;
    this.displayHeight = height;
    return this;
  }

  setScale(x: number, y = x): this {
    this.scaleX = x;
    this.scaleY = y;
    this.displayWidth = this.width * x;
    this.displayHeight = this.height * y;
    return this;
  }
}

class FakeContainer extends FakeGameObject {
  public readonly children: unknown[] = [];

  constructor(x = 0, y = 0) {
    super(0, 0);
    this.setPosition(x, y);
  }

  add(child: unknown): this {
    this.children.push(child);
    return this;
  }
}

class FakeGraphics extends FakeGameObject {
  public readonly strokes: Array<{ x: number; y: number; width: number; height: number }> = [];

  constructor() {
    super(0, 0);
  }

  clear(): this {
    this.strokes.length = 0;
    return this;
  }

  lineStyle(): this {
    return this;
  }

  strokeRect(x: number, y: number, width: number, height: number): this {
    this.strokes.push({ x, y, width, height });
    return this;
  }
}

class FakeScene {
  public readonly containers: FakeContainer[] = [];
  public readonly graphics: FakeGraphics[] = [];

  public readonly add = {
    container: (x = 0, y = 0) => {
      const container = new FakeContainer(x, y);
      this.containers.push(container);
      return container as unknown as Phaser.GameObjects.Container;
    },
    graphics: () => {
      const graphics = new FakeGraphics();
      this.graphics.push(graphics);
      return graphics as unknown as Phaser.GameObjects.Graphics;
    },
  };
}

function createScene(): Phaser.Scene {
  return new FakeScene() as unknown as Phaser.Scene;
}

function createObject(width: number, height: number): FakeGameObject {
  return new FakeGameObject(width, height);
}

function asLayoutObject(object: FakeGameObject): LayoutGameObject {
  return object as unknown as LayoutGameObject;
}

describe('LayoutBox', () => {
  it('keeps nested boxes positioned while applying parent alignment', () => {
    const scene = createScene();
    const parent = new LayoutBox(scene, 'hbox', { align: 'center' });
    const first = createObject(50, 20);
    const nested = new LayoutBox(scene, 'vbox');
    const nestedChild = createObject(10, 10);

    nested.add(asLayoutObject(nestedChild), { width: 10, height: 10 });
    parent.add(asLayoutObject(first), { width: 50, height: 20 });
    parent.add(nested, { width: 100, height: 40 });
    parent.layout(0, 0, 200, 100);

    expect(first.y).toBe(40);
    expect(nested.container.x).toBe(50);
    expect(nested.container.y).toBe(30);
    expect(nested.layoutWidth).toBe(100);
    expect(nested.layoutHeight).toBe(40);
  });

  it('distributes remaining hbox space with justify', () => {
    const scene = createScene();
    const centered = new LayoutBox(scene, 'hbox', { gap: 10, justify: 'center' });
    const centerA = createObject(50, 10);
    const centerB = createObject(50, 10);

    centered.add(asLayoutObject(centerA), { width: 50, height: 10 });
    centered.add(asLayoutObject(centerB), { width: 50, height: 10 });
    centered.layout(0, 0, 300, 50);

    expect(centerA.x).toBe(95);
    expect(centerB.x).toBe(155);

    const spaced = new LayoutBox(scene, 'hbox', { gap: 10, justify: 'space-between' });
    const spaceA = createObject(50, 10);
    const spaceB = createObject(50, 10);

    spaced.add(asLayoutObject(spaceA), { width: 50, height: 10 });
    spaced.add(asLayoutObject(spaceB), { width: 50, height: 10 });
    spaced.layout(0, 0, 300, 50);

    expect(spaceA.x).toBe(0);
    expect(spaceB.x).toBe(250);
  });

  it('applies root anchor and root min/max constraints', () => {
    const box = new LayoutBox(createScene(), 'vbox', {
      anchor: 'center',
      minWidth: 100,
      maxHeight: 80,
    });

    box.layout(200, 100, 50, 200);

    expect(box.container.x).toBe(150);
    expect(box.container.y).toBe(60);
    expect(box.layoutWidth).toBe(100);
    expect(box.layoutHeight).toBe(80);
  });

  it('places overlay children with percentages, constraints, and anchors', () => {
    const box = new LayoutBox(createScene(), 'hbox');
    const flow = createObject(30, 20);
    const overlay = createObject(10, 10);

    box.add(asLayoutObject(flow), { width: 30, height: 20 });
    box.addOverlay(asLayoutObject(overlay), {
      x: '50%',
      y: '50%',
      width: '50%',
      maxWidth: 80,
      height: '50%',
      minHeight: 60,
      anchor: 'center',
      fit: 'stretch',
    });
    box.layout(0, 0, 200, 100);

    expect(flow.x).toBe(0);
    expect(overlay.x).toBe(60);
    expect(overlay.y).toBe(20);
    expect(overlay.displayWidth).toBe(80);
    expect(overlay.displayHeight).toBe(60);
  });

  it('keeps contain fitting stable across repeated dirty layouts', () => {
    const box = new LayoutBox(createScene(), 'hbox');
    const image = createObject(100, 50);

    box.add(asLayoutObject(image), { width: 50, height: 50, fit: 'contain' });
    box.layout(0, 0, 100, 100);

    expect(image.scaleX).toBe(0.5);
    expect(image.displayWidth).toBe(50);
    expect(image.displayHeight).toBe(25);

    box.markDirty();
    box.layout(0, 0, 100, 100);

    expect(image.scaleX).toBe(0.5);
    expect(image.displayWidth).toBe(50);
    expect(image.displayHeight).toBe(25);
  });

  it('skips unchanged clean layouts and propagates child dirtiness', () => {
    const scene = createScene();
    const box = new LayoutBox(scene, 'hbox');
    const child = createObject(10, 10);

    box.add(asLayoutObject(child), { width: 10, height: 10 });
    box.layout(0, 0, 100, 100);

    const callsAfterFirstLayout = child.positionCalls;
    box.layout(0, 0, 100, 100);

    expect(child.positionCalls).toBe(callsAfterFirstLayout);

    const nested = new LayoutBox(scene, 'vbox');
    box.add(nested, { width: 20, height: 20 });
    box.layout(0, 0, 100, 100);

    nested.add(asLayoutObject(createObject(5, 5)), { width: 5, height: 5 });

    expect(box.isDirty).toBe(true);

    box.layout(0, 0, 100, 100);

    expect(nested.isDirty).toBe(false);
  });
});
