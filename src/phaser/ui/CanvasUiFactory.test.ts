import Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { UI_THEME } from '../../theme';
import { CanvasUiFactory } from './CanvasUiFactory';

vi.mock('phaser', () => ({
  default: {
    Input: {
      Events: {
        GAMEOBJECT_POINTER_OVER: 'pointerover',
        GAMEOBJECT_POINTER_OUT: 'pointerout',
        GAMEOBJECT_POINTER_DOWN: 'pointerdown',
        GAMEOBJECT_POINTER_UP: 'pointerup',
      },
    },
    GameObjects: {
      Events: {
        DESTROY: 'destroy',
      },
    },
  },
}));

class FakeGameObject {
  public active = true;
  public originX = 0;
  public originY = 0;
  public alpha = 1;

  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}

  setOrigin(x: number, y = x): this {
    this.originX = x;
    this.originY = y;
    return this;
  }

  setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }
}

class FakeText extends FakeGameObject {
  public color: string;

  constructor(
    x: number,
    y: number,
    public readonly text: string,
    public readonly style: Phaser.Types.GameObjects.Text.TextStyle,
  ) {
    super(x, y, 0, 0);
    this.color = typeof style.color === 'string' ? style.color : '#ffffff';
  }

  setColor(color: string): this {
    this.color = color;
    return this;
  }

  setShadow(): this {
    return this;
  }
}

class FakeRichText extends FakeGameObject {
  public shadow:
    | {
        x: number;
        y: number;
        color: string | number | null;
        blur: number;
        shadowStroke: boolean;
        shadowFill: boolean;
      }
    | undefined;

  constructor(
    x: number,
    y: number,
    public readonly text: string,
    public readonly style: Record<string, unknown>,
  ) {
    super(x, y, 0, 0);
  }

  setShadow(
    x = 0,
    y = 0,
    color: string | number | null = null,
    blur = 0,
    shadowStroke = false,
    shadowFill = false,
  ): this {
    this.shadow = { x, y, color, blur, shadowStroke, shadowFill };
    return this;
  }
}

class FakeRectangle extends FakeGameObject {
  public interactive = false;
  public fillColor: number;
  public fillAlpha: number;
  private readonly handlers = new Map<string, Array<(...args: unknown[]) => void>>();

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

  on(event: string, callback: (...args: unknown[]) => void): this {
    const callbacks = this.handlers.get(event) ?? [];
    callbacks.push(callback);
    this.handlers.set(event, callbacks);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    this.handlers.get(event)?.forEach((callback) => callback(...args));
  }
}

class FakeContainer extends FakeGameObject {
  public readonly children: unknown[] = [];

  constructor(x: number, y: number) {
    super(x, y, 0, 0);
  }

  setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    return this;
  }

  add(child: unknown | unknown[]): this {
    this.children.push(...(Array.isArray(child) ? child : [child]));
    return this;
  }
}

class FakeSizer extends FakeContainer {
  public readonly childConfigs: unknown[] = [];
  public layoutCount = 0;

  add(child: unknown, config?: unknown): this {
    super.add(child);
    this.childConfigs.push(config);
    return this;
  }

  addBackground(child: unknown): this {
    super.add(child);
    return this;
  }

  layout(): this {
    this.layoutCount += 1;
    return this;
  }
}

class FakeScrollablePanel extends FakeSizer {
  public childOY = 0;
  private destroyHandler: (() => void) | null = null;

  setChildOY(value: number): this {
    this.childOY = value;
    return this;
  }

  once(event: string, callback: () => void): this {
    if (event === Phaser.GameObjects.Events.DESTROY) {
      this.destroyHandler = callback;
    }
    return this;
  }

  destroy(): void {
    this.destroyHandler?.();
  }
}

class FakeScene {
  public readonly texts: FakeText[] = [];
  public readonly richTexts: FakeRichText[] = [];
  public readonly rectangles: FakeRectangle[] = [];
  public readonly sizers: FakeSizer[] = [];
  public readonly scrollPanels: FakeScrollablePanel[] = [];

  public readonly add = {
    text: (
      x: number,
      y: number,
      content: string,
      style: Phaser.Types.GameObjects.Text.TextStyle,
    ) => {
      const text = new FakeText(x, y, content, style);
      this.texts.push(text);
      return text as unknown as Phaser.GameObjects.Text;
    },
    rectangle: (
      x: number,
      y: number,
      width: number,
      height: number,
      fillColor: number,
      fillAlpha: number,
    ) => {
      const rectangle = new FakeRectangle(x, y, width, height, fillColor, fillAlpha);
      this.rectangles.push(rectangle);
      return rectangle as unknown as Phaser.GameObjects.Rectangle;
    },
    container: (x = 0, y = 0) => new FakeContainer(x, y) as unknown as Phaser.GameObjects.Container,
  };

  public readonly rexUI = {
    add: {
      BBCodeText: (x: number, y: number, content: string, style: Record<string, unknown>) => {
        const text = new FakeRichText(x, y, content, style);
        this.richTexts.push(text);
        return text;
      },
      sizer: (x: number, y: number, width: number, height: number) => {
        const sizer = new FakeSizer(x, y);
        sizer.setSize(width, height);
        this.sizers.push(sizer);
        return sizer;
      },
      scrollablePanel: (config: { x?: number; y?: number; width?: number; height?: number }) => {
        const panel = new FakeScrollablePanel(config.x ?? 0, config.y ?? 0);
        panel.setSize(config.width ?? 0, config.height ?? 0);
        this.scrollPanels.push(panel);
        return panel;
      },
    },
  };
}

function createFactory(): { factory: CanvasUiFactory; scene: FakeScene } {
  const scene = new FakeScene();
  return {
    factory: new CanvasUiFactory(scene as unknown as Phaser.Scene),
    scene,
  };
}

describe('CanvasUiFactory', () => {
  it('applies a semantic text variant and returns a concrete Text', () => {
    const { factory, scene } = createFactory();

    const text = factory.text({
      x: 10,
      y: 20,
      text: 'Status',
      variant: 'status',
      origin: 0.5,
    }) as unknown as FakeText;

    expect(text.text).toBe('Status');
    expect(text.style.fontFamily).toBe(UI_THEME.fontFamily);
    expect(text.style.fontSize).toBe(UI_THEME.text.status.fontSize);
    expect(text.color).toBe(UI_THEME.text.status.color.css);
    expect(scene.texts).toContain(text);
  });

  it('applies the supported semantic style contract to rich text', () => {
    const { factory, scene } = createFactory();
    const token = UI_THEME.text.heroTitle;

    const text = factory.richText({
      x: 10,
      y: 20,
      text: '[b]Status[/b]',
      variant: 'heroTitle',
      origin: { x: 0, y: 0.5 },
      alpha: 0.42,
      fixedWidth: 320,
      maxLines: 2,
      wordWrapWidth: 300,
    }) as unknown as FakeRichText;

    expect(text.style).toMatchObject({
      fontFamily: UI_THEME.fontFamily,
      fontSize: token.fontSize,
      fontStyle: token.fontStyle,
      maxLines: 2,
      wrap: { width: 300 },
    });
    expect(text.shadow).toEqual({
      x: token.shadow.x,
      y: token.shadow.y,
      color: token.shadow.color.css,
      blur: token.shadow.blur,
      shadowStroke: token.shadow.shadowStroke,
      shadowFill: token.shadow.shadowFill,
    });
    expect(text.originX).toBe(0);
    expect(text.originY).toBe(0.5);
    expect(text.alpha).toBe(0.42);
    expect(scene.richTexts).toContain(text);
  });

  it('owns button hover, disabled, and click behavior', () => {
    const { factory, scene } = createFactory();
    const onClick = vi.fn();

    factory.button({ x: 0, y: 0, width: 180, height: 64, label: 'Save', enabled: true, onClick });
    const enabledBackground = scene.rectangles[0]!;
    enabledBackground.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER);
    expect(enabledBackground.fillColor).toBe(UI_THEME.colors.surfaceHover.canvas);
    enabledBackground.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN);
    expect(onClick).toHaveBeenCalledOnce();

    factory.button({ x: 0, y: 0, width: 180, height: 64, label: 'Save', enabled: false });
    expect(scene.rectangles[1]!.interactive).toBe(false);
  });

  it('activates a pressable surface only after a release below the drag threshold', () => {
    const { factory } = createFactory();
    const onClick = vi.fn();
    const surface = factory.pressableSurface({
      x: 0,
      y: 0,
      width: 200,
      height: 80,
      variant: 'row',
      hoverVariant: 'rowHover',
      onClick,
    }) as unknown as FakeRectangle;
    const clickPointer = { id: 1, getDistance: () => 4 } as Phaser.Input.Pointer;
    const dragPointer = { id: 2, getDistance: () => 8 } as Phaser.Input.Pointer;

    surface.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, clickPointer);
    expect(onClick).not.toHaveBeenCalled();
    surface.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, clickPointer);
    expect(onClick).toHaveBeenCalledOnce();

    surface.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, dragPointer);
    surface.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, dragPointer);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('assembles children declaratively and lays a stack out once', () => {
    const { factory } = createFactory();
    const first = factory.container();
    const second = factory.container();

    const stack = factory.stack({
      x: 20,
      y: 30,
      width: 400,
      height: 120,
      orientation: 'x',
      gap: 12,
      children: [
        { gameObject: first, align: 'left-top', minWidth: 100 },
        { gameObject: second, align: 'right-top', minWidth: 100 },
      ],
    }) as unknown as FakeSizer;

    expect(stack.children).toEqual([first, second]);
    expect(stack.childConfigs).toHaveLength(2);
    expect(stack.layoutCount).toBe(1);
  });

  it('restores and captures explicit scroll state across panel recreation', () => {
    const { factory } = createFactory();
    const child = factory.container();
    const scrollState = { childOY: -120 };

    const panel = factory.scrollPanel({
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      child,
      scrollState,
    }) as unknown as FakeScrollablePanel;

    expect(panel.childOY).toBe(-120);
    panel.childOY = -240;
    panel.destroy();
    expect(scrollState.childOY).toBe(-240);
  });
});
