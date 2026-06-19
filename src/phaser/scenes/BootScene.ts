import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { DEFAULT_FONT_URL, TITLE_BACKGROUND_URL } from '../config/constants';

/**
 * 게임 시작 시 공용 리소스를 먼저 준비하는 부트 씬이다.
 * 이후 씬에서 재사용할 배경과 폰트를 이 단계에서 올린다.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene', active: true });
  }

  /**
   * 타이틀 화면과 공용 UI에 필요한 리소스를 선로딩한다.
   */
  preload(): void {
    this.load.image('title-background', TITLE_BACKGROUND_URL);
    this.load.font(DEFAULT_FONT_FAMILY, DEFAULT_FONT_URL, 'truetype');
  }

  /**
   * 선로딩이 끝나면 타이틀 씬으로 전환한다.
   */
  create(): void {
    this.scene.start('TitleScene');
  }
}
