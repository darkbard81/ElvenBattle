import Phaser from 'phaser';

export interface ResultSceneData {
  title: string;
  detail: string;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(data: Partial<ResultSceneData>): void {
    const title = data.title ?? 'Game Over';
    const detail = data.detail ?? 'Result unavailable';

    this.add.rectangle(640, 360, 1280, 720, 0x10151f, 0.96);
    this.add
      .text(640, 300, title, {
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(640, 362, detail, {
        color: '#cbd5e1',
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
      })
      .setOrigin(0.5);
    const restart = this.add
      .text(640, 430, 'Restart', {
        backgroundColor: '#1f6f5f',
        color: '#ffffff',
        fixedWidth: 160,
        fixedHeight: 42,
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    restart.on('pointerup', () => this.scene.start('GameScene'));
  }
}
