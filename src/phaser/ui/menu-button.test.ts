import Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { LayoutBox } from './LayoutBox';
import { createMenuButton } from './menu-button';

vi.mock('phaser', () => ({
  default: {
    Input: {
      Events: {
        GAMEOBJECT_POINTER_OVER: 'pointerover',
        GAMEOBJECT_POINTER_OUT: 'pointerout',
        GAMEOBJECT_POINTER_DOWN: 'pointerdown',
      },
    },
  },
}));

class FakeGameObject {
  public x: number;
  public y: number;
  public displayWidth: number;
  public displayHeight: number;
  public originX = 0;
  public originY = 0;

  constructor(
    x: number,
    y: number,
    public width: number,
    public height: number,
  ) {
    this.x = x;
    this.y = y;
    this.displayWidth = width;
    this.displayHeight = height;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setOrigin(x: number, y = x): this {
    this.originX = x;
    this.originY = y;
    return this;
  }
}

class FakeRectangle extends FakeGameObject {
  public fillColor: number;
  public fillAlpha: number;
  public interactive = false;
  private readonly handlers = new Map<string, Array<() => void>>();

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number,
    fillAlpha: number,
  ) {
    super(x, y, width, height);
    this.fillColor = fillColor;
    this.fillAlpha = fillAlpha;
  }

  setStrokeStyle(): this {
    return this;
  }

  setInteractive(): this {
    this.interactive = true;
    return this;
  }

  setFillStyle(fillColor: number, fillAlpha: number): this {
    this.fillColor = fillColor;
    this.fillAlpha = fillAlpha;
    return this;
  }

  on(event: string, callback: () => void): this {
    const callbacks = this.handlers.get(event) ?? [];
    callbacks.push(callback);
    this.handlers.set(event, callbacks);
    return this;
  }

  emit(event: string): void {
    this.handlers.get(event)?.forEach((callback) => {
      callback();
    });
  }
}

class FakeText extends FakeGameObject {
  public color: string;

  constructor(
    x: number,
    y: number,
    public readonly text: string,
    style: { color?: string },
  ) {
    super(x, y, 0, 0);
    this.color = style.color ?? '#ffffff';
  }

  setColor(color: string): this {
    this.color = color;
    return this;
  }
}

class FakeContainer extends FakeGameObject {
  public readonly children: unknown[] = [];

  constructor(x: number, y: number) {
    super(x, y, 0, 0);
  }

  add(child: unknown | unknown[]): this {
    if (Array.isArray(child)) {
      this.children.push(...child);
    } else {
      this.children.push(child);
    }

    return this;
  }
}

class FakeScene {
  public readonly containers: FakeContainer[] = [];

  public readonly add = {
    container: (x = 0, y = 0) => {
      const container = new FakeContainer(x, y);
      this.containers.push(container);
      return container as unknown as Phaser.GameObjects.Container;
    },
    rectangle: (
      x: number,
      y: number,
      width: number,
      height: number,
      fillColor: number,
      fillAlpha: number,
    ) =>
      new FakeRectangle(
        x,
        y,
        width,
        height,
        fillColor,
        fillAlpha,
      ) as unknown as Phaser.GameObjects.Rectangle,
    text: (x: number, y: number, text: string, style: { color?: string }) =>
      new FakeText(x, y, text, style) as unknown as Phaser.GameObjects.Text,
  };
}

function createScene(): Phaser.Scene {
  return new FakeScene() as unknown as Phaser.Scene;
}

describe('createMenuButton', () => {
  it('returns a local-coordinate container and keeps click behavior', () => {
    const scene = createScene();
    let clicked = 0;

    const button = createMenuButton(scene, {
      x: 120,
      y: 240,
      width: 180,
      height: 64,
      label: 'Start',
      enabled: true,
      onClick: () => {
        clicked += 1;
      },
    }) as unknown as FakeContainer;

    expect(button.x).toBe(120);
    expect(button.y).toBe(240);
    expect(button.children).toHaveLength(2);

    const background = button.children[0] as FakeRectangle;
    const label = button.children[1] as FakeText;

    expect(background.x).toBe(0);
    expect(background.y).toBe(0);
    expect(background.width).toBe(180);
    expect(background.height).toBe(64);
    expect(label.x).toBe(0);
    expect(label.y).toBe(0);
    expect(label.text).toBe('Start');

    background.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN);

    expect(clicked).toBe(1);
  });

  it('adds the returned container to the optional parent', () => {
    const scene = createScene();
    const parent = scene.add.container(0, 0) as unknown as FakeContainer;

    const button = createMenuButton(scene, {
      x: 20,
      y: 30,
      width: 120,
      height: 48,
      label: 'Back',
      enabled: true,
      parent: parent as unknown as Phaser.GameObjects.Container,
      onClick: () => undefined,
    });

    expect(parent.children).toContain(button);
  });

  it('keeps disabled buttons visible without requiring an onClick handler', () => {
    const scene = createScene();

    const button = createMenuButton(scene, {
      x: 0,
      y: 0,
      width: 128,
      height: 64,
      label: '연성',
      enabled: false,
    }) as unknown as FakeContainer;

    expect(button.children).toHaveLength(3);

    const background = button.children[0] as FakeRectangle;
    const disabled = button.children[2] as FakeText;

    expect(background.interactive).toBe(false);
    expect(disabled.text).toBe('disabled');
    expect(disabled.x).toBe(0);
    expect(disabled.y).toBe(26);
  });

  it('rejects enabled buttons without click handlers', () => {
    const scene = createScene();

    expect(() => {
      createMenuButton(scene, {
        x: 0,
        y: 0,
        width: 120,
        height: 48,
        label: 'Broken',
        enabled: true,
      });
    }).toThrow('Enabled menu button "Broken" requires onClick');
  });

  it('can be used as a LayoutBox direct child', () => {
    const scene = createScene();
    const layout = new LayoutBox(scene, 'vbox');
    const button = createMenuButton(scene, {
      x: 0,
      y: 0,
      width: 180,
      height: 64,
      label: 'Start',
      enabled: true,
      onClick: () => undefined,
    }) as unknown as FakeContainer;

    layout.add(button as unknown as Phaser.GameObjects.Container, {
      width: 180,
      height: 64,
    });
    layout.layout(20, 40, 180, 64);

    expect(button.x).toBe(0);
    expect(button.y).toBe(0);
    expect(layout.container.x).toBe(20);
    expect(layout.container.y).toBe(40);
  });
});
