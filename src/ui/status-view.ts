import type { PlayerPanelViewModel } from './types';

export function formatPlayerStatus(panel: PlayerPanelViewModel): string {
  const dominanceLimit = panel.dominance.limit + panel.dominance.temporaryLimit;

  return [
    `${panel.playerId} ${panel.kind}`,
    `HP ${panel.hp}/${panel.maxHp}`,
    `Energy ${panel.resource.current}/${panel.resource.max}`,
    `Dominance ${panel.dominance.used}/${dominanceLimit} score ${panel.dominance.boardValue}`,
    `Deck ${panel.deckCount} Hand ${panel.handCount} Grave ${panel.graveyardCount}`,
  ].join(' | ');
}
