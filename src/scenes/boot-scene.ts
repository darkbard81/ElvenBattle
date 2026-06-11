import Phaser from 'phaser';

import cardManifest from '../../generated/cards/manifest.json';
import cardBackUrl from '../assets/cards/frames/base-card-back-fullart-01.png';

export const CARD_BACK_TEXTURE_KEY = 'card-back-fullart';

const CARD_ASSET_URLS: Record<string, string> = {
  ongoing_basic_banner: new URL('../../generated/cards/ongoing_basic_banner.webp', import.meta.url)
    .href,
  tactic_basic_focus: new URL('../../generated/cards/tactic_basic_focus.webp', import.meta.url)
    .href,
  unit_back_support: new URL('../../generated/cards/unit_back_support.webp', import.meta.url).href,
  unit_basic_vanguard: new URL('../../generated/cards/unit_basic_vanguard.webp', import.meta.url)
    .href,
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image(CARD_BACK_TEXTURE_KEY, cardBackUrl);
    for (const entry of cardManifest.cards) {
      const assetUrl = CARD_ASSET_URLS[entry.cardId];

      if (assetUrl) {
        this.load.image(getCardTextureKey(entry.cardId), assetUrl);
      }
    }
  }

  create(): void {
    this.scene.start('GameScene');
  }
}

export function getCardTextureKey(cardId: string): string {
  return `card:${cardId}`;
}
