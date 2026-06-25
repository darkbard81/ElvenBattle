import { describe, expect, it } from 'vitest';
import { createDefaultStageProgressState } from './progress';
import {
  findStageDefinition,
  isStageUnlocked,
  listStageDefinitions,
  requireStageDefinition,
  resolveStageEnemyDeck,
} from './stage-definitions';

describe('stage definitions', () => {
  it('lists the test stage as data-driven stage content', () => {
    const stages = listStageDefinitions();

    expect(stages).toHaveLength(1);
    expect(stages[0]).toMatchObject({
      id: 'test-stage-dark',
      order: 1,
      name: 'Test Stage',
      enemyDeckId: 'deck-enemy-dark-test',
      enemyDeckPath: 'cards/deck_dark.json',
      victoryCondition: { type: 'DEFEAT_ENEMY_LEADER' },
      defeatConditions: [{ type: 'PLAYER_LEADER_DEFEATED' }],
      unlock: { type: 'ALWAYS' },
    });
  });

  it('keeps the test stage unlocked by default', () => {
    const stage = requireStageDefinition('test-stage-dark');

    expect(isStageUnlocked(stage, createDefaultStageProgressState())).toBe(true);
  });

  it('resolves the stage enemy deck from the registered static deck map', () => {
    const stage = requireStageDefinition('test-stage-dark');
    const enemyDeck = resolveStageEnemyDeck(stage);

    expect(enemyDeck.deckId).toBe('deck-enemy-dark-test');
    expect(enemyDeck.deckPath).toBe('cards/deck_dark.json');
    expect(
      enemyDeck.cardDefinitionFile.cards.some((card) => card.id === 'leader_dark_empress'),
    ).toBe(true);
  });

  it('returns null for unknown stage ids', () => {
    expect(findStageDefinition('missing-stage')).toBeNull();
  });
});
