import Phaser from 'phaser';
import type { BattleSlotId } from '../../game/battle/types';
import { BattlefieldTextureCapture } from './BattlefieldTextureCapture';
import {
  SOURCE_FIELD_HEIGHT,
  SOURCE_FIELD_RECT,
  SOURCE_FIELD_WIDTH,
  SourceBattleFieldContainer,
} from './SourceBattleFieldContainer';
import {
  createFieldHomography,
  fieldLocalToSlotId,
  fieldQuadBounds,
  PERSPECTIVE_FIELD_QUAD,
  screenToFieldLocal,
  type FieldHomography,
  type FieldPoint,
  type FieldQuad,
  type FieldRect,
} from './fieldHomography';
import type { FieldPointerIntent } from './perspective-field';

export type BattlefieldRendererMode = 'fallback-2d' | 'texture-warp';

type BattlefieldWarpViewOptions = {
  sourceField: SourceBattleFieldContainer;
  capture: BattlefieldTextureCapture;
  fieldLayer: Phaser.GameObjects.Container;
  interactionLayer: Phaser.GameObjects.Container;
  fieldQuad?: FieldQuad;
  onIntent: (intent: FieldPointerIntent) => void;
};

const FIELD_WARP_FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uBoundsOrigin;
uniform vec2 uBoundsSize;
uniform vec2 uSourceSize;
uniform vec3 uScreenToSourceRow0;
uniform vec3 uScreenToSourceRow1;
uniform vec3 uScreenToSourceRow2;

varying vec2 outTexCoord;

void main(void) {
  vec2 screen = vec2(
    uBoundsOrigin.x + outTexCoord.x * uBoundsSize.x,
    uBoundsOrigin.y + (1.0 - outTexCoord.y) * uBoundsSize.y
  );

  vec3 sourceH = vec3(
    dot(uScreenToSourceRow0, vec3(screen, 1.0)),
    dot(uScreenToSourceRow1, vec3(screen, 1.0)),
    dot(uScreenToSourceRow2, vec3(screen, 1.0))
  );

  vec2 source = sourceH.xy / sourceH.z;

  if (
    source.x < 0.0 ||
    source.y < 0.0 ||
    source.x > uSourceSize.x ||
    source.y > uSourceSize.y
  ) {
    discard;
  }

  vec2 uv = vec2(source.x / uSourceSize.x, 1.0 - (source.y / uSourceSize.y));
  gl_FragColor = texture2D(uMainSampler, uv);
}
`;

/**
 * DynamicTexture로 캡처된 배틀필드를 화면 사다리꼴 quad로 warp 출력한다.
 * 전장 위 입력은 inverse homography로 source field local 좌표로 되돌린 뒤 intent만 발생시킨다.
 */
export class BattlefieldWarpView {
  private readonly scene: Phaser.Scene;
  private readonly sourceField: SourceBattleFieldContainer;
  private readonly capture: BattlefieldTextureCapture;
  private readonly fieldLayer: Phaser.GameObjects.Container;
  private readonly interactionLayer: Phaser.GameObjects.Container;
  private readonly fieldQuad: FieldQuad;
  private readonly fieldBounds: FieldRect;
  private readonly homography: FieldHomography;
  private readonly onIntent: (intent: FieldPointerIntent) => void;
  private shader: Phaser.GameObjects.Shader | null = null;
  private inputZone: Phaser.GameObjects.Zone | null = null;

  constructor(scene: Phaser.Scene, options: BattlefieldWarpViewOptions) {
    this.scene = scene;
    this.sourceField = options.sourceField;
    this.capture = options.capture;
    this.fieldLayer = options.fieldLayer;
    this.interactionLayer = options.interactionLayer;
    this.fieldQuad = options.fieldQuad ?? PERSPECTIVE_FIELD_QUAD;
    this.fieldBounds = fieldQuadBounds(this.fieldQuad);
    this.homography = createFieldHomography(SOURCE_FIELD_RECT, this.fieldQuad);
    this.onIntent = options.onIntent;
  }

  /**
   * 초기 field texture를 캡처하고 warp shader와 입력 zone을 생성한다.
   */
  render(): void {
    this.capture.redrawIfDirty();
    this.addShader();
    this.addInputZone();
  }

  /**
   * source field의 dirty 내용을 texture에 반영한다.
   */
  refresh(): void {
    this.capture.redrawIfDirty();
  }

  /**
   * warp view가 생성한 shader와 입력 zone을 해제한다.
   */
  destroy(): void {
    this.shader?.destroy();
    this.inputZone?.destroy();
    this.shader = null;
    this.inputZone = null;
  }

  private addShader(): void {
    const shader = this.scene.add.shader(
      {
        name: 'ElvenBattleFieldWarp',
        fragmentSource: FIELD_WARP_FRAGMENT_SHADER,
        setupUniforms: (setUniform: (name: string, value: unknown) => void) => {
          this.setupShaderUniforms(setUniform);
        },
      },
      this.fieldBounds.x + this.fieldBounds.width / 2,
      this.fieldBounds.y + this.fieldBounds.height / 2,
      this.fieldBounds.width,
      this.fieldBounds.height,
      [this.capture.getTextureKey()],
    );
    shader.setOrigin(0.5);
    this.fieldLayer.add(shader);
    this.shader = shader;
  }

  private setupShaderUniforms(setUniform: (name: string, value: unknown) => void): void {
    const matrix = this.homography.screenToSource;

    setUniform('uMainSampler', 0);
    setUniform('uBoundsOrigin', [this.fieldBounds.x, this.fieldBounds.y]);
    setUniform('uBoundsSize', [this.fieldBounds.width, this.fieldBounds.height]);
    setUniform('uSourceSize', [SOURCE_FIELD_WIDTH, SOURCE_FIELD_HEIGHT]);
    setUniform('uScreenToSourceRow0', [matrix[0], matrix[1], matrix[2]]);
    setUniform('uScreenToSourceRow1', [matrix[3], matrix[4], matrix[5]]);
    setUniform('uScreenToSourceRow2', [matrix[6], matrix[7], matrix[8]]);
  }

  private addInputZone(): void {
    const bounds = this.fieldBounds;
    const zone = this.scene.add.zone(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      bounds.width,
      bounds.height,
    );
    zone.setInteractive();
    zone.on(
      Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,
      (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
        const point = {
          x: bounds.x + localX,
          y: bounds.y + localY,
        };
        this.handlePointerDown(point);
      },
    );
    this.interactionLayer.add(zone);
    this.inputZone = zone;
  }

  private handlePointerDown(point: FieldPoint): void {
    const local = screenToFieldLocal(point, this.homography);
    const slotId = local ? fieldLocalToSlotId(local, SOURCE_FIELD_RECT) : null;

    if (!slotId) {
      return;
    }

    this.selectSlot(slotId);
    this.onIntent({
      type: 'select-slot',
      slotId,
    });
  }

  private selectSlot(slotId: BattleSlotId): void {
    this.sourceField.selectSlot(slotId);
    this.capture.markDirty();
    this.refresh();
  }
}
