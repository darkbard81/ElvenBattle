import type { CardAbility } from '../save/card-catalog';
import type { ActiveSkillBattleEffect, BattleCardRuntimeState, BattleRuntimeState } from './types';

export type BattleRuntimeEffectStat = 'attack' | 'hp' | 'dominance';

export type PassiveStatModifier = {
  stat: BattleRuntimeEffectStat;
  value: number;
};

export type PassiveAbilityContext = {
  runtime: BattleRuntimeState;
  source: BattleCardRuntimeState;
  target: BattleCardRuntimeState;
  ability: CardAbility;
  isFrontRowCard: (card: BattleCardRuntimeState) => boolean;
  isBackRowCard: (card: BattleCardRuntimeState) => boolean;
  hasTrait: (card: BattleCardRuntimeState, key: string, text: string) => boolean;
  hasTraitToken: (card: BattleCardRuntimeState, key: string, text: string) => boolean;
};

export type AttackDamageAbilityContext = {
  runtime: BattleRuntimeState;
  attacker: BattleCardRuntimeState;
  target: BattleCardRuntimeState;
  ability: CardAbility;
  isBackRowCard: (card: BattleCardRuntimeState) => boolean;
  getEffectiveHp: (runtime: BattleRuntimeState, card: BattleCardRuntimeState) => number;
};

export type ActiveSkillDefinition = {
  effect: ActiveSkillBattleEffect;
  value: number;
  targetSide: 'ally' | 'enemy';
};

export type PassiveAbilityHandler = (context: PassiveAbilityContext) => PassiveStatModifier | null;

export type AttackDamageAbilityHandler = (context: AttackDamageAbilityContext) => number;

/** 피해 적용 직전에 대상의 SPECIAL 능력이 줄이는 피해량을 계산한다. */
export type DamageReductionAbilityHandler = (context: {
  runtime: BattleRuntimeState;
  target: BattleCardRuntimeState;
  ability: CardAbility;
}) => number;

export const FRONT_PASSIVE_ABILITY_HANDLERS: Partial<Record<string, PassiveAbilityHandler>> = {
  guardian_stance: ({ source, target, isFrontRowCard }) =>
    source === target && isFrontRowCard(source) ? { stat: 'hp', value: 1 } : null,
  stonehide_stance: ({ source, target, isFrontRowCard }) =>
    source === target && isFrontRowCard(source) ? { stat: 'hp', value: 1 } : null,
  dwarf_hold_ground: ({ source, target, isFrontRowCard }) =>
    source === target && isFrontRowCard(source) ? { stat: 'hp', value: 1 } : null,
};

/** 후위에 있는 동안 다른 카드에 적용되는 지속 능력을 ID별로 해석한다. */
export const BACK_PASSIVE_ABILITY_HANDLERS: Partial<Record<string, PassiveAbilityHandler>> = {
  gnome_traveling_song: ({ source, target, isBackRowCard }) =>
    source !== target && source.side === target.side && isBackRowCard(source)
      ? { stat: 'attack', value: 1 }
      : null,
};

export const GLOBAL_PASSIVE_ABILITY_HANDLERS: Partial<Record<string, PassiveAbilityHandler>> = {
  guardian_block: () => null,
  stonewall_guard: () => null,
  silver_chord: ({ source, target, hasTrait }) =>
    source !== target && source.side === target.side && hasTrait(target, 'race', '엘프')
      ? { stat: 'attack', value: 1 }
      : null,
  hollow_chorus: ({ source, target, hasTrait }) =>
    source !== target && source.side === target.side && hasTrait(target, 'race', '몬스터')
      ? { stat: 'attack', value: 1 }
      : null,
  wolf_pack_hunt: ({ source, target, hasTraitToken }) =>
    source !== target &&
    source.side === target.side &&
    hasTraitToken(target, 'creatureType', 'animal')
      ? { stat: 'attack', value: 1 }
      : null,
};

export const SUMMON_ATTACK_BONUS_ABILITY_IDS = new Set(['greenwood_charge', 'iron_spike_charge']);

export const MOVE_ATTACK_BONUS_ABILITY_IDS = new Set(['forest_path', 'mist_stride']);

/** 턴이 지나도 다음 공격까지 유지되는 이동 공격력 보너스 능력 ID다. */
export const MOVE_NEXT_ATTACK_BONUS_ABILITY_IDS = new Set(['eagle_dive']);

/** 등장 위치와 정면으로 맞닿은 적의 공격력을 낮추는 능력 ID다. */
export const SUMMON_OPPOSING_ENEMY_ATTACK_PENALTY_ABILITY_IDS = new Set(['flash_beetle_glare']);

/** 퇴각 시 인접한 아군에게 적용할 회복량을 능력 ID별로 정의한다. */
export const RETREAT_ADJACENT_ALLY_HEAL_VALUES: Partial<Record<string, number>> = {
  homunculus_last_service: 1,
};

export const AFTER_ATTACK_BUFF_ABILITY_IDS = new Set(['leafwind_flurry', 'shadow_blade_flurry']);

export const BLOCK_ABILITY_IDS = new Set(['guardian_block']);

export const ATTACK_DAMAGE_BONUS_ABILITY_HANDLERS: Partial<
  Record<string, AttackDamageAbilityHandler>
> = {
  moonlit_shot: ({ target, isBackRowCard }) => (isBackRowCard(target) ? 1 : 0),
  eclipse_shot: ({ target, isBackRowCard }) => (isBackRowCard(target) ? 1 : 0),
  shadow_leaf_strike: ({ runtime, target, getEffectiveHp }) =>
    getEffectiveHp(runtime, target) <= 3 ? 1 : 0,
  night_prey: ({ runtime, target, getEffectiveHp }) =>
    getEffectiveHp(runtime, target) <= 3 ? 1 : 0,
  rapier_thrust: () => 2,
  hryngar_overwatch: ({ target, isBackRowCard }) => (isBackRowCard(target) ? 1 : 0),
};

/** 대상의 SPECIAL 능력이 제공하는 피해 감소 규칙을 ID별로 해석한다. */
export const DAMAGE_REDUCTION_ABILITY_HANDLERS: Partial<
  Record<string, DamageReductionAbilityHandler>
> = {
  animated_resilience: () => 1,
};

export const ACTIVE_SKILL_DEFINITIONS: Partial<Record<string, ActiveSkillDefinition>> = {
  starlight_mend: { effect: 'HEAL', value: 2, targetSide: 'ally' },
  curse_reversal: { effect: 'HEAL', value: 2, targetSide: 'ally' },
  emerald_bolt: { effect: 'DAMAGE', value: 2, targetSide: 'enemy' },
  blackflame_bolt: { effect: 'DAMAGE', value: 2, targetSide: 'enemy' },
  rune_tempering: { effect: 'BUFF_ATTACK', value: 1, targetSide: 'ally' },
  rune_forge: { effect: 'BUFF_ATTACK', value: 1, targetSide: 'ally' },
  leshy_leaf_mending: { effect: 'HEAL', value: 1, targetSide: 'ally' },
};
