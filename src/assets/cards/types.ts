import type { CardRarity, CardType } from '../../cards';

export type CardRuntimeNumberField =
  | 'COST'
  | 'DOMINANCE_COST'
  | 'DOMINANCE_VALUE'
  | 'DOMINANCE_REQUIREMENT'
  | 'ATTACK'
  | 'HEALTH';

export type CardTextAnchor = 'CENTER' | 'LEFT' | 'RIGHT';

export interface CardRuntimeNumberSlot {
  field: CardRuntimeNumberField;
  x: number;
  y: number;
  anchor: CardTextAnchor;
  align: CardTextAnchor;
  fontKey: string;
  maxDigits: number;
}

export interface SkillTextOverlaySlot {
  x: number;
  y: number;
  width: number;
  height: number;
  padding: number;
  backgroundColor: string;
  backgroundAlpha: number;
  fontKey: string;
  maxLines: number;
}

export interface CardDisplayModel {
  cardId: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  dominanceCost: number;
  dominanceValue: number;
  dominanceRequirement: number | null;
  attack: number | null;
  health: number | null;
  faction: string | null;
  attribute: string | null;
  tags: string[];
  rulesText: string[];
  artKey: string;
  runtimeNumberSlots: CardRuntimeNumberSlot[];
  skillTextOverlay: SkillTextOverlaySlot;
}

export interface CardRenderSize {
  width: number;
  height: number;
}

export interface CardAssetManifest {
  manifestVersion: 1;
  cardDataVersion: string;
  rendererVersion: string;
  generatedAtPolicy: 'OMITTED_FOR_DETERMINISM';
  cards: CardAssetManifestEntry[];
}

export interface CardAssetManifestEntry {
  cardId: string;
  sourceHash: string;
  assetHash: string;
  width: number;
  height: number;
  webpPath: string;
  svgPath: string;
  runtimeNumberSlots: CardRuntimeNumberSlot[];
  skillTextOverlay: SkillTextOverlaySlot;
}
