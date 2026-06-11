import { createCardRenderCommand } from './card-sprite';
import type { CardRenderCommand } from './card-sprite';
import type { CardViewModel, UiSelection } from './types';

export function createHandRenderCommands(
  hand: readonly CardViewModel[],
  selected: UiSelection | null,
): CardRenderCommand[] {
  return hand.map((card) =>
    createCardRenderCommand(
      card,
      selected?.type === 'HAND_CARD' && selected.instanceId === card.instanceId,
    ),
  );
}
