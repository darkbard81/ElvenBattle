import type { CardRuntimeNumberValue } from '../assets/cards';
import type { CardViewModel } from './types';

export interface CardRenderCommand {
  instanceId: string;
  label: string;
  face: 'FRONT' | 'BACK';
  numbers: CardRuntimeNumberValue[];
  exhausted: boolean;
  selected: boolean;
}

export function createCardRenderCommand(card: CardViewModel, selected = false): CardRenderCommand {
  return {
    instanceId: card.instanceId,
    label: card.face === 'BACK' ? 'Card Back' : card.name,
    face: card.face,
    numbers: card.runtimeNumbers.filter((number) => number.value !== null),
    exhausted: card.exhausted,
    selected,
  };
}
