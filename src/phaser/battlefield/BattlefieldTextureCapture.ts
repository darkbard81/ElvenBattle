import Phaser from 'phaser';
import {
  SOURCE_FIELD_HEIGHT,
  SOURCE_FIELD_WIDTH,
  type SourceBattleFieldContainer,
} from './SourceBattleFieldContainer';

const BATTLEFIELD_CAPTURE_TEXTURE_KEY = 'battlefield-source-capture';

/**
 * source battle field 컨테이너를 DynamicTexture에 캡처한다.
 * dirty flag를 통해 선택 변경처럼 필요한 순간에만 GPU texture를 다시 그린다.
 */
export class BattlefieldTextureCapture {
  private readonly scene: Phaser.Scene;
  private readonly sourceField: SourceBattleFieldContainer;
  private readonly texture: Phaser.Textures.DynamicTexture;
  private dirty = true;

  constructor(scene: Phaser.Scene, sourceField: SourceBattleFieldContainer) {
    this.scene = scene;
    this.sourceField = sourceField;

    if (scene.textures.exists(BATTLEFIELD_CAPTURE_TEXTURE_KEY)) {
      scene.textures.remove(BATTLEFIELD_CAPTURE_TEXTURE_KEY);
    }

    const texture = scene.textures.addDynamicTexture(
      BATTLEFIELD_CAPTURE_TEXTURE_KEY,
      SOURCE_FIELD_WIDTH,
      SOURCE_FIELD_HEIGHT,
    );

    if (!texture) {
      throw new Error('Failed to create battlefield DynamicTexture');
    }

    this.texture = texture;
  }

  /**
   * 다음 `redrawIfDirty` 호출에서 source field를 다시 캡처하도록 표시한다.
   */
  markDirty(): void {
    this.dirty = true;
  }

  /**
   * dirty 상태일 때만 source field를 DynamicTexture에 다시 그린다.
   */
  redrawIfDirty(): void {
    if (!this.dirty) {
      return;
    }

    this.texture.clear();
    this.texture.draw(this.sourceField.getContainer(), 0, 0);
    this.texture.render();
    this.dirty = false;
  }

  /**
   * warp view가 참조할 Phaser TextureManager key를 반환한다.
   */
  getTextureKey(): string {
    return BATTLEFIELD_CAPTURE_TEXTURE_KEY;
  }

  /**
   * 캡처 texture를 TextureManager에서 제거한다.
   */
  destroy(): void {
    if (this.scene.textures.exists(BATTLEFIELD_CAPTURE_TEXTURE_KEY)) {
      this.texture.destroy();
    }
  }
}
