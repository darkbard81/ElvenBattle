import Phaser from 'phaser';
import type BBCodeText from 'phaser4-rex-plugins/templates/ui/bbcodetext/BBCodeText';
import type GridSizer from 'phaser4-rex-plugins/templates/ui/gridsizer/GridSizer';
import type OverlapSizer from 'phaser4-rex-plugins/templates/ui/overlapsizer/OverlapSizer';
import type ScrollablePanel from 'phaser4-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel';
import type Sizer from 'phaser4-rex-plugins/templates/ui/sizer/Sizer';
import {
  UI_THEME,
  type UiColorToken,
  type UiSurfaceVariant,
  type UiTextVariant,
} from '../../theme';

export type UiAlign =
  | 'left-top'
  | 'center-top'
  | 'right-top'
  | 'left-center'
  | 'center'
  | 'right-center'
  | 'left-bottom'
  | 'center-bottom'
  | 'right-bottom'
  | 'left'
  | 'right';

export type UiPadding = number | { left?: number; right?: number; top?: number; bottom?: number };

export type UiLayoutChild = Readonly<{
  gameObject: Phaser.GameObjects.GameObject;
  align?: UiAlign;
  minWidth?: number;
  minHeight?: number;
  expand?: boolean;
  padding?: UiPadding;
  offsetX?: number;
  offsetY?: number;
  offsetOriginX?: number;
  offsetOriginY?: number;
  proportion?: number;
  column?: number;
  row?: number;
  columnSpan?: number;
  rowSpan?: number;
}>;

type CanvasBaseTextConfig = Readonly<{
  x: number;
  y: number;
  text: string;
  variant: UiTextVariant;
  color?: UiColorToken;
  align?: Phaser.Types.GameObjects.Text.TextStyle['align'];
  origin?: number | { x: number; y: number };
  alpha?: number;
  fixedWidth?: number;
  fixedHeight?: number;
  maxLines?: number;
  lineSpacing?: number;
  wordWrapWidth?: number;
}>;

/** Phaser Text 생성 시 지원하는 공통 설정과 고급 줄바꿈 옵션이다. */
export type CanvasTextConfig = CanvasBaseTextConfig &
  Readonly<{
    useAdvancedWrap?: boolean;
  }>;

/** rexUI BBCodeText가 실제로 지원하는 Canvas 텍스트 설정이다. */
export type CanvasRichTextConfig = CanvasBaseTextConfig;

export type CanvasPanelConfig = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  variant: UiSurfaceVariant;
  origin?: number | { x: number; y: number };
}>;

export type PressableSurfaceConfig = CanvasPanelConfig &
  Readonly<{
    hoverVariant: UiSurfaceVariant;
    onClick: () => void;
  }>;

export type CanvasButtonConfig = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  enabled: boolean;
  parent?: Phaser.GameObjects.Container;
  onClick?: () => void;
}>;

type BaseLayoutConfig = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  origin?: number;
  anchor?: Record<string, string>;
  background?: Phaser.GameObjects.GameObject;
  children: readonly UiLayoutChild[];
}>;

export type StackConfig = BaseLayoutConfig &
  Readonly<{
    orientation: 'x' | 'y';
    gap?: number;
  }>;

export type GridConfig = BaseLayoutConfig &
  Readonly<{
    columns: number;
    rows: number;
    columnGap?: number;
    rowGap?: number | number[];
    columnProportions?: number[];
    rowProportions?: number | number[];
    padding?: UiPadding;
  }>;

export type OverlayConfig = BaseLayoutConfig;

export type ScrollPanelConfig = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  child: Phaser.GameObjects.GameObject;
  focusChild?: Phaser.GameObjects.GameObject;
  maskPadding?: number;
  scrollbarWidth?: number;
  scrollbarGap?: number;
}>;

/**
 * Phaser와 rexUI의 Canvas UI 생성 경계를 통합한다.
 *
 * Scene은 의미 기반 variant와 배치 정보만 전달하며, 반환된 GameObject의 생명주기는 Phaser가
 * 관리한다. 생성자는 Scene 참조만 보관하므로 Scene 부팅 전에도 안전하게 만들 수 있다.
 */
export class CanvasUiFactory {
  constructor(private readonly scene: Phaser.Scene) {}

  /** 의미 기반 텍스트 variant로 Phaser Text를 만든다. */
  text(config: CanvasTextConfig): Phaser.GameObjects.Text {
    const token = UI_THEME.text[config.variant];
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: UI_THEME.fontFamily,
      fontSize: token.fontSize,
      color: config.color?.css ?? token.color.css,
    };
    if ('fontStyle' in token) style.fontStyle = token.fontStyle;
    if ('stroke' in token) style.stroke = token.stroke.css;
    if ('strokeThickness' in token) style.strokeThickness = token.strokeThickness;
    if (config.align !== undefined) style.align = config.align;
    if (config.fixedWidth !== undefined) style.fixedWidth = config.fixedWidth;
    if (config.fixedHeight !== undefined) style.fixedHeight = config.fixedHeight;
    if (config.maxLines !== undefined) style.maxLines = config.maxLines;
    if (config.lineSpacing !== undefined) style.lineSpacing = config.lineSpacing;
    if (config.wordWrapWidth !== undefined) {
      style.wordWrap = {
        width: config.wordWrapWidth,
        useAdvancedWrap: config.useAdvancedWrap ?? false,
      };
    }

    const text = this.scene.add.text(config.x, config.y, config.text, style);
    if ('shadow' in token) {
      text.setShadow(
        token.shadow.x,
        token.shadow.y,
        token.shadow.color.css,
        token.shadow.blur,
        token.shadow.shadowStroke,
        token.shadow.shadowFill,
      );
    }
    if (typeof config.origin === 'number') {
      text.setOrigin(config.origin);
    } else if (config.origin) {
      text.setOrigin(config.origin.x, config.origin.y);
    }
    if (config.alpha !== undefined) text.setAlpha(config.alpha);
    return text;
  }

  /** rexUI BBCodeText를 공통 폰트와 variant로 만든다. */
  richText(config: CanvasRichTextConfig): BBCodeText {
    const token = UI_THEME.text[config.variant];
    const style = {
      fontFamily: UI_THEME.fontFamily,
      fontSize: token.fontSize,
      color: config.color?.css ?? token.color.css,
      ...('fontStyle' in token ? { fontStyle: token.fontStyle } : {}),
      ...('stroke' in token ? { stroke: token.stroke.css } : {}),
      ...('strokeThickness' in token ? { strokeThickness: token.strokeThickness } : {}),
      ...(config.align === undefined ? {} : { align: config.align as 'left' | 'center' | 'right' }),
      ...(config.fixedWidth === undefined ? {} : { fixedWidth: config.fixedWidth }),
      ...(config.fixedHeight === undefined ? {} : { fixedHeight: config.fixedHeight }),
      ...(config.maxLines === undefined ? {} : { maxLines: config.maxLines }),
      ...(config.lineSpacing === undefined ? {} : { lineSpacing: config.lineSpacing }),
      ...(config.wordWrapWidth === undefined ? {} : { wrap: { width: config.wordWrapWidth } }),
    };
    const text = this.scene.rexUI.add.BBCodeText(config.x, config.y, config.text, style);
    if ('shadow' in token) {
      text.setShadow(
        token.shadow.x,
        token.shadow.y,
        token.shadow.color.css,
        token.shadow.blur,
        token.shadow.shadowStroke,
        token.shadow.shadowFill,
      );
    }
    if (typeof config.origin === 'number') {
      text.setOrigin(config.origin);
    } else if (config.origin) {
      text.setOrigin(config.origin.x, config.origin.y);
    }
    if (config.alpha !== undefined) text.setAlpha(config.alpha);
    return text;
  }

  /** 로컬 좌표 자식들을 담는 Phaser Container를 만든다. */
  container(
    config: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      children?: Phaser.GameObjects.GameObject[];
    } = {},
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(config.x ?? 0, config.y ?? 0);
    if (config.width !== undefined && config.height !== undefined) {
      container.setSize(config.width, config.height);
    }
    if (config.children) container.add(config.children);
    return container;
  }

  /** 의미 기반 surface variant로 Rectangle 패널을 만든다. */
  panel(config: CanvasPanelConfig): Phaser.GameObjects.Rectangle {
    const token = UI_THEME.surfaces[config.variant];
    const panel = this.scene.add.rectangle(
      config.x,
      config.y,
      config.width,
      config.height,
      token.fill.canvas,
      token.fillAlpha,
    );
    if ('stroke' in token) {
      panel.setStrokeStyle(token.strokeWidth, token.stroke.canvas, token.strokeAlpha);
    }
    if (typeof config.origin === 'number') {
      panel.setOrigin(config.origin);
    } else if (config.origin) {
      panel.setOrigin(config.origin.x, config.origin.y);
    }
    return panel;
  }

  /** hover와 click 상태를 Theme variant로 처리하는 입력 표면을 만든다. */
  pressableSurface(config: PressableSurfaceConfig): Phaser.GameObjects.Rectangle {
    const panel = this.panel(config);
    const normal = UI_THEME.surfaces[config.variant];
    const hover = UI_THEME.surfaces[config.hoverVariant];
    panel.setInteractive({ useHandCursor: true });
    panel.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      panel.setFillStyle(hover.fill.canvas, hover.fillAlpha);
    });
    panel.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      panel.setFillStyle(normal.fill.canvas, normal.fillAlpha);
    });
    panel.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, config.onClick);
    return panel;
  }

  /** UI에 포함되는 텍스처 Image를 만든다. */
  image(config: {
    x: number;
    y: number;
    key: string;
    origin?: number | { x: number; y: number };
    width?: number;
    height?: number;
    alpha?: number;
  }): Phaser.GameObjects.Image {
    const image = this.scene.add.image(config.x, config.y, config.key);
    if (typeof config.origin === 'number') {
      image.setOrigin(config.origin);
    } else if (config.origin) {
      image.setOrigin(config.origin.x, config.origin.y);
    }
    if (config.width !== undefined && config.height !== undefined) {
      image.setDisplaySize(config.width, config.height);
    }
    if (config.alpha !== undefined) image.setAlpha(config.alpha);
    return image;
  }

  /** 공통 버튼 스타일과 입력 상태를 포함하는 Container를 만든다. */
  button(config: CanvasButtonConfig): Phaser.GameObjects.Container {
    const surfaceVariant = config.enabled ? 'button' : 'buttonDisabled';
    const labelVariant = config.enabled ? 'buttonLabel' : 'buttonLabelDisabled';
    const container = this.container({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
    });
    const background = this.panel({
      x: 0,
      y: 0,
      width: config.width,
      height: config.height,
      variant: surfaceVariant,
    });
    const label = this.text({
      x: 0,
      y: 0,
      text: config.label,
      variant: labelVariant,
      align: 'center',
      origin: 0.5,
    });
    container.add([background, label]);
    config.parent?.add(container);

    if (!config.enabled) {
      container.add(
        this.text({
          x: 0,
          y: 26,
          text: 'disabled',
          variant: 'disabledCaption',
          align: 'center',
          origin: 0.5,
        }),
      );
      return container;
    }
    if (!config.onClick) {
      throw new Error(`Enabled menu button "${config.label}" requires onClick`);
    }

    background.setInteractive();
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      background.setFillStyle(UI_THEME.colors.surfaceHover.canvas, 0.98);
      label.setColor(UI_THEME.colors.white.css);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      const token = UI_THEME.surfaces.button;
      background.setFillStyle(token.fill.canvas, token.fillAlpha);
      label.setColor(UI_THEME.text.buttonLabel.color.css);
    });
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, config.onClick);
    return container;
  }

  /** 카드 크기에 따라 계산된 숫자 크기를 공통 전투 스탯 스타일로 표시한다. */
  cardStat(config: {
    x: number;
    y: number;
    text: string;
    fontSize: string;
    strokeThickness: number;
  }): Phaser.GameObjects.Text {
    return this.scene.add
      .text(config.x, config.y, config.text, {
        fontFamily: UI_THEME.fontFamily,
        fontSize: config.fontSize,
        color: UI_THEME.colors.white.css,
        stroke: UI_THEME.colors.black.css,
        strokeThickness: config.strokeThickness,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  /** 세로 또는 가로 Sizer를 자식과 함께 조립하고 즉시 layout한다. */
  stack(config: StackConfig): Sizer {
    const layout = this.scene.rexUI.add.sizer(
      config.x,
      config.y,
      config.width,
      config.height,
      config.orientation,
      {
        origin: config.origin ?? 0,
        ...(config.anchor ? { anchor: config.anchor } : {}),
        ...(config.gap === undefined ? {} : { space: { item: config.gap } }),
      },
    );
    if (config.background) layout.addBackground(config.background);
    for (const child of config.children) layout.add(child.gameObject, toSizerChildConfig(child));
    layout.layout();
    return layout;
  }

  /** GridSizer를 자식과 함께 조립하고 즉시 layout한다. */
  grid(config: GridConfig): GridSizer {
    const layout = this.scene.rexUI.add.gridSizer(
      config.x,
      config.y,
      config.width,
      config.height,
      config.columns,
      config.rows,
      {
        origin: config.origin ?? 0,
        ...(config.anchor ? { anchor: config.anchor } : {}),
        ...(config.columnProportions ? { columnProportions: config.columnProportions } : {}),
        ...(config.rowProportions === undefined ? {} : { rowProportions: config.rowProportions }),
        space: {
          ...(typeof config.padding === 'number'
            ? {
                left: config.padding,
                right: config.padding,
                top: config.padding,
                bottom: config.padding,
              }
            : (config.padding ?? {})),
          column: config.columnGap ?? 0,
          row: config.rowGap ?? 0,
        },
      },
    );
    if (config.background) layout.addBackground(config.background);
    for (const child of config.children) layout.add(child.gameObject, toGridChildConfig(child));
    layout.layout();
    return layout;
  }

  /** OverlapSizer를 자식과 함께 조립하고 즉시 layout한다. */
  overlay(config: OverlayConfig): OverlapSizer {
    const layout = this.scene.rexUI.add.overlapSizer(
      config.x,
      config.y,
      config.width,
      config.height,
      {
        origin: config.origin ?? 0,
        ...(config.anchor ? { anchor: config.anchor } : {}),
      },
    );
    if (config.background) layout.addBackground(config.background);
    for (const child of config.children) layout.add(child.gameObject, toSizerChildConfig(child));
    layout.layout();
    return layout;
  }

  /** 공통 scrollbar와 스크롤 정책을 적용한 ScrollablePanel을 만든다. */
  scrollPanel(config: ScrollPanelConfig): ScrollablePanel {
    const panel = this.scene.rexUI.add.scrollablePanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      origin: 0,
      scrollMode: 'y',
      clampChildOY: true,
      panel: {
        child: config.child,
        mask: { padding: config.maskPadding ?? 2 },
      },
      space: { sliderY: config.scrollbarGap ?? 12 },
      slider: {
        track: this.panel({
          x: 0,
          y: 0,
          width: config.scrollbarWidth ?? 12,
          height: config.height,
          variant: 'scrollTrack',
        }),
        thumb: this.panel({
          x: 0,
          y: 0,
          width: config.scrollbarWidth ?? 12,
          height: 48,
          variant: 'scrollThumb',
        }),
        position: 'right',
        input: 'drag',
        hideUnscrollableSlider: true,
        disableUnscrollableDrag: true,
        adaptThumbSize: true,
        minThumbSize: 42,
      },
      scroller: {
        threshold: 8,
        slidingDeceleration: 4200,
        backDeceleration: 2200,
        pointerOutRelease: true,
      },
      mouseWheelScroller: { focus: false, speed: 0.22 },
      scrollDetectionMode: 'rectBounds',
    });
    panel.layout();
    if (config.focusChild) {
      const focusChild = config.focusChild;
      setTimeout(() => {
        if (panel.active && focusChild.active) {
          panel.scrollToChild(focusChild, 'centerY');
        }
      }, 50);
    }
    return panel;
  }
}

function toSizerChildConfig(child: UiLayoutChild): Record<string, unknown> {
  return compactChildConfig(child, false);
}

function toGridChildConfig(child: UiLayoutChild): Record<string, unknown> {
  return compactChildConfig(child, true);
}

function compactChildConfig(child: UiLayoutChild, includeGrid: boolean): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const key of [
    'align',
    'minWidth',
    'minHeight',
    'expand',
    'padding',
    'offsetX',
    'offsetY',
    'offsetOriginX',
    'offsetOriginY',
    'proportion',
  ] as const) {
    const value = child[key];
    if (value !== undefined) config[key] = value;
  }
  if (includeGrid) {
    for (const key of ['column', 'row', 'columnSpan', 'rowSpan'] as const) {
      const value = child[key];
      if (value !== undefined) config[key] = value;
    }
  }
  return config;
}
