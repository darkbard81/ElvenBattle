import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';

export type MenuButtonConfig = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  enabled: boolean;
  parent?: Phaser.GameObjects.Container;
  onClick?: () => void;
};

/**
 * 메뉴 버튼의 시각 상태와 클릭 가능 여부를 함께 구성한다.
 * 비활성 버튼은 상호작용을 제거하고, 활성 버튼만 전달된 콜백을 실행한다.
 */
export function createMenuButton(scene: Phaser.Scene, config: MenuButtonConfig): void {
  const fillColor = config.enabled ? 0x1d3f31 : 0x12211c;
  const strokeColor = config.enabled ? 0xdaf6d3 : 0x51605a;
  const fillAlpha = config.enabled ? 0.96 : 0.72;
  const labelColor = config.enabled ? '#f5fff0' : '#7e8b84';

  const background = scene.add.rectangle(
    config.x,
    config.y,
    config.width,
    config.height,
    fillColor,
    fillAlpha,
  );
  background.setStrokeStyle(2, strokeColor, config.enabled ? 0.92 : 0.58);

  const label = scene.add.text(config.x, config.y, config.label, {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: '28px',
    color: labelColor,
    align: 'center',
  });
  label.setOrigin(0.5);
  config.parent?.add([background, label]);

  if (!config.enabled) {
    const disabled = scene.add.text(config.x, config.y + 26, 'disabled', {
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: '14px',
      color: '#8d9b95',
      align: 'center',
    });
    disabled.setOrigin(0.5);
    config.parent?.add(disabled);
    return;
  }

  if (!config.onClick) {
    throw new Error(`Enabled menu button "${config.label}" requires onClick`);
  }

  background.setInteractive();
  background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
    background.setFillStyle(0x2f5b44, 0.98);
    label.setColor('#ffffff');
  });
  background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
    background.setFillStyle(fillColor, fillAlpha);
    label.setColor(labelColor);
  });
  background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
    config.onClick?.();
  });
}
