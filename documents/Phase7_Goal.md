# Phase 7 목표 지시문 — 전투 엔진 구현

너는 Node.js + TypeScript 기반 디지털 TCG 게임 엔진의 공격 선언, 공격 대상 검증, 피해 계산, 유닛 파괴, 전투 로그를 구현하는 엔진 개발자다.

아래 문서를 기준으로 Phase 7을 완성하기 위한 구체적인 구현 목표, 산출물, 완료 조건을 정의한다.

## 기준 문서

- `documents/Plan.md`
- `documents/Core_Rule_Spec_v0.1.md`
- `documents/Phase2_Goal.md`
- `documents/Phase3_Goal.md`
- `documents/Phase4_Goal.md`
- `documents/Phase5_Goal.md`
- `documents/Phase6_Goal.md`
- `AGENTS.md`

## Phase 7의 위치

`documents/Plan.md`에서 Phase 7은 다음 단계다.

- Phase 5: 카드 / 덱 / Zone 시스템 구현
- Phase 6: 전장 및 배치 시스템 구현
- Phase 7: 전투 엔진 구현
- Phase 8: 효과 처리 엔진 구현
- Phase 10 이후: 승리 조건, 저장/리플레이, AI 구현

따라서 Phase 7은 Phase6의 전장/소환/이동 시스템 위에 `Battle Engine`을 구현하는 단계다. 카드 효과 DSL, 복잡한 지속 효과 레이어, 승리 조건 확정, 리플레이 재생기는 이후 Phase로 남긴다.

## 중요 전제

- 원작 카드 데이터, 명칭, 일러스트, 스토리, 고유 리소스는 절대 포함하지 않는다.
- 룰 엔진은 Phaser, DOM, 브라우저 전역 객체, 네트워크 API에 의존하지 않는다.
- 전투는 `ATTACK` 액션 하나가 단일 공격을 처리하는 방식으로 구현한다.
- 공격은 `COMBAT` 페이즈에만 허용한다.
- 공격자는 전장에 있는 자기 유닛이어야 한다.
- 기본 정책은 유닛당 턴 1회 공격이다.
- `summonedThisTurn`, `exhausted`, `CANNOT_ATTACK`, `STUNNED` 상태의 유닛은 공격할 수 없다.
- 같은 열 전열/후열 보호 규칙을 적용한다.
- 반격 기본 정책은 Core Rule Spec의 권장값인 “전열 유닛 간 동시 피해”다.
- 후열 유닛은 Phase7 기본 정책에서 공격할 수 있지만, 방어자로서 반격하지 않는다.
- 지배력은 기본 공격 피해를 직접 증가시키지 않는다.
- Phase7에서는 효과 트리거 해결, 피해 감소/보호막의 완전한 레이어, 승리 조건 확정을 앞당겨 구현하지 않는다.
- 모든 상태 변경 함수는 입력 `GameState`를 직접 mutation하지 않는 방식으로 구현한다.

## Phase 7 최종 목표

다음 기능을 구현한다.

- 공격 가능 상태 검증
- 공격 대상 검증
- 같은 열 전열/후열 보호 규칙
- 플레이어 직접 공격 가능 여부 검증
- 기본 공격 피해 계산
- 전열 유닛 간 동시 반격 피해
- 유닛 피해 적용
- 플레이어 HP 피해 적용
- 체력 0 이하 유닛 파괴 처리
- 파괴 유닛의 `BATTLEFIELD -> GRAVEYARD` 이동
- 보드 슬롯 비우기
- 전투 후 지배력 재계산
- 공격자 `exhausted = true` 처리
- `turnState.attackedUnitIds` 기록
- `ATTACK_DECLARED`, `DAMAGE_DEALT`, `UNIT_DESTROYED`, `CARD_MOVED`, `DOMINANCE_CHANGED` 이벤트 기록
- `ATTACK` 액션에 대한 `ActionLogEntry` 기록
- Phase10 승리 조건 구현이 연결될 수 있는 확장 지점 준비

Phase 7 완료 시점에는 다음이 가능해야 한다.

- `COMBAT` 페이즈에서 자기 전장 유닛으로 공격할 수 있다.
- `MAIN`, `END` 등 잘못된 페이즈의 공격은 실패한다.
- 전장에 없는 유닛은 공격할 수 없다.
- 상대 유닛 또는 상대 플레이어만 공격 대상으로 지정할 수 있다.
- 공격자가 이미 공격했거나 exhausted 상태이면 공격할 수 없다.
- 이번 턴 소환된 유닛은 공격할 수 없다.
- 상태 효과상 공격 불가인 유닛은 공격할 수 없다.
- 같은 열 상대 전열이 있으면 같은 열 후열 유닛을 직접 공격할 수 없다.
- 같은 열 상대 전열이 없으면 같은 열 후열 유닛을 공격할 수 있다.
- 같은 열 상대 유닛이 없으면 상대 플레이어를 직접 공격할 수 있다.
- 공격 성공 시 대상 유닛 또는 플레이어에게 피해가 적용된다.
- 전열 유닛을 공격하면 방어자의 공격력만큼 공격자에게 동시 반격 피해가 적용된다.
- 체력이 0 이하가 된 유닛은 묘지로 이동하고 보드에서 제거된다.
- 유닛 파괴 후 해당 플레이어의 지배력이 재계산된다.
- 정상 공격은 이벤트 로그와 액션 로그에 기록된다.
- 실패한 공격은 상태를 변경하지 않고 검증 실패를 반환한다.
- 빌드, 린트, 포맷, 테스트가 모두 통과한다.

## 1. 구현 대상 파일

다음 파일을 생성하거나 갱신하라.

| 파일 | 목적 |
|---|---|
| `src/battle/target.ts` | 공격 대상 파싱, 같은 열 후보, 직접 공격 가능 여부 |
| `src/battle/validation.ts` | 공격자/대상/페이즈/보호 규칙 검증 |
| `src/battle/damage.ts` | 기본 피해 계산과 피해 적용 |
| `src/battle/destroy.ts` | 체력 0 이하 유닛 파괴와 묘지 이동 |
| `src/battle/attack.ts` | `ATTACK` 액션 처리 진입점 |
| `src/battle/index.ts` | Phase7 Battle API re-export |
| `src/game/action.ts` | `ATTACK` dispatch 연결 |
| `src/game/index.ts` | 필요한 경우 battle-facing API re-export |
| `src/rules/validation.ts` | `COMBAT` 페이즈의 `ATTACK` 허용 |
| `src/rules/types.ts` | 공격/피해/대상 검증 오류 코드 보강 |
| `src/events/factory.ts` | `ATTACK_DECLARED`, `DAMAGE_DEALT`, `UNIT_DESTROYED` 이벤트 생성 헬퍼 추가 |
| `src/zones/move.ts` | 파괴 처리에서 `GRAVEYARD` 이동 정합성 확인 |
| `tests/battle-target.test.ts` | 공격 대상 후보와 보호 규칙 테스트 |
| `tests/attack-validation.test.ts` | 공격 실패 조건 테스트 |
| `tests/damage-system.test.ts` | 피해 적용과 반격 테스트 |
| `tests/destroy-system.test.ts` | 유닛 파괴와 묘지 이동 테스트 |
| `tests/phase7-apply-action.test.ts` | `applyAction` 통합 공격 테스트 |

기존 Phase3~6 타입 파일은 필요한 경우에만 좁게 보강한다. 특히 Phase7을 위해 효과 엔진이나 승리 조건 시스템을 앞당겨 만들지 않는다.

## 2. 전투 대상 모델

기존 `ActionTarget`은 다음 구조를 사용한다.

```ts
export type ActionTarget =
  | { type: 'UNIT'; unitId: InstanceId }
  | { type: 'PLAYER'; playerId: PlayerId };
```

`AttackPayload`는 다음 구조를 유지한다.

```ts
export interface AttackPayload {
  attackerId: InstanceId;
  target: ActionTarget;
}
```

필수 헬퍼:

- `getAttackLane(board, attackerId)`
- `getDefendingFrontSlot(board, defenderId, column)`
- `getDefendingBackSlot(board, defenderId, column)`
- `findAttackTargetSlot(board, target)`
- `isBackRowProtected(board, defenderId, column): boolean`
- `canAttackPlayerDirectly(board, defenderId, column): boolean`
- `resolveAttackTarget(state, attackerId, target): AttackTargetResolution`

기본 대상 규칙:

- 공격자는 전장 슬롯에 있어야 한다.
- 공격자의 열(`column`)을 기준으로 같은 열 상대 진영을 본다.
- 같은 열 상대 전열에 유닛이 있으면 해당 전열 유닛만 기본 공격 대상이다.
- 같은 열 상대 전열이 비어 있고 후열에 유닛이 있으면 해당 후열 유닛을 공격할 수 있다.
- 같은 열 상대 전열과 후열이 모두 비어 있으면 상대 플레이어를 직접 공격할 수 있다.
- `PIERCE_BACK_ROW` 태그가 있으면 후열 보호 예외를 허용할 수 있다. Phase7에서는 태그만 확인하고 복잡한 효과 조건은 Phase8로 남긴다.
- 다른 열 유닛 공격은 Phase7 기본 정책에서 허용하지 않는다.

## 3. 공격자 검증

`ATTACK` 액션의 공통 검증 이후 다음을 확인한다.

필수 검증:

- `phase === 'COMBAT'`
- `action.playerId === priorityPlayerId`
- `attackerId`가 존재한다.
- 공격자가 전장 슬롯에 있다.
- 공격자의 `controllerId === action.playerId`
- 공격자의 현재 zone이 `BATTLEFIELD`다.
- 공격자가 `turnState.attackedUnitIds`에 없다.
- 공격자가 `exhausted === false`다.
- 공격자가 `summonedThisTurn === false`다.
- 공격자가 `CANNOT_ATTACK` 또는 `STUNNED` 상태를 갖고 있지 않다.
- 공격자의 `currentAttack`이 0보다 커야 한다.

`RuleErrorCode` 보강 후보:

- `ERR_ATTACKER_NOT_FOUND`
- `ERR_ATTACKER_NOT_CONTROLLED`
- `ERR_ATTACKER_ALREADY_ATTACKED`
- `ERR_ATTACKER_CANNOT_ATTACK`
- `ERR_ATTACKER_POWER_ZERO`
- `ERR_TARGET_PROTECTED`
- `ERR_TARGET_NOT_ATTACKABLE`
- `ERR_DIRECT_ATTACK_BLOCKED`

기존 `ERR_ATTACKER_EXHAUSTED`, `ERR_SUMMONING_SICKNESS`, `ERR_INVALID_TARGET`, `ERR_UNIT_NOT_ON_BOARD`도 적극 재사용한다.

## 4. 대상 검증

대상 타입별 검증:

### 유닛 대상

- 대상 유닛이 전장에 있어야 한다.
- 대상 유닛의 `controllerId`는 공격자 플레이어와 달라야 한다.
- 대상 유닛은 공격자와 같은 열에 있어야 한다.
- 대상이 후열 유닛이고 같은 열 상대 전열이 비어 있지 않으면 실패한다.
- 대상이 후열 유닛이고 공격자가 `PIERCE_BACK_ROW` 태그를 갖고 있으면 예외적으로 허용한다.

### 플레이어 대상

- 대상 플레이어는 공격자 플레이어와 달라야 한다.
- 공격자와 같은 열의 대상 플레이어 전열/후열이 모두 비어 있어야 한다.
- 같은 열에 상대 유닛이 하나라도 있으면 직접 공격은 실패한다.

Phase7에서는 도발, 은신, 사거리, 광역 공격, 타겟 변경 효과를 구현하지 않는다.

## 5. 피해 계산

Phase7의 피해 계산은 기본 수치만 사용한다.

필수 헬퍼:

- `getUnitAttack(instance): number`
- `getUnitRemainingHealth(instance): number`
- `calculateAttackDamage(state, attackerId, target): DamagePlan`
- `applyDamageToUnit(state, unitId, amount, source): DamageResult`
- `applyDamageToPlayer(state, playerId, amount, source): DamageResult`

기본 정책:

- 유닛 공격 피해는 `max(0, currentAttack ?? 0)`이다.
- 유닛 남은 체력은 `max(0, (currentHealth ?? 0) - damage)`다.
- 대상이 유닛이면 공격자 공격력만큼 대상 유닛의 `damage`가 증가한다.
- 대상이 플레이어이면 공격자 공격력만큼 대상 플레이어의 `hp`가 감소한다.
- Phase7에서는 보호막, 피해 감소, 관통, 생명 흡수, 광역 피해를 구현하지 않는다.
- 피해량이 0이면 공격은 가능하더라도 `DAMAGE_DEALT`는 기록하지 않거나 amount 0 이벤트로 기록할 수 있다. 정책은 테스트로 고정한다.

권장 이벤트 정책:

- 실제 피해량이 1 이상일 때만 `DAMAGE_DEALT`를 기록한다.
- 피해 이벤트 payload에는 source, target, amount를 포함한다.

## 6. 반격 정책

Core Rule Spec의 Phase7 기본 반격 정책은 “전열 유닛 간 동시 피해”다.

반격 조건:

- 공격 대상이 유닛이어야 한다.
- 공격 대상 슬롯의 row가 `FRONT`여야 한다.
- 공격자 슬롯의 row도 `FRONT`여야 한다.
- 방어자가 피해 적용 전 전장에 있었고 `STUNNED` 상태가 아니어야 한다.
- 방어자의 공격력이 1 이상이어야 한다.

반격 처리:

- 공격 피해와 반격 피해는 같은 전투 교환의 결과로 취급한다.
- 실제 구현은 순차 적용해도 되지만, 반격 가능 여부는 공격 피해 적용 전 상태를 기준으로 판단한다.
- 후열 유닛은 Phase7 기본 정책에서 반격하지 않는다.
- 플레이어 대상 공격에는 반격이 없다.

## 7. 파괴 처리

체력이 0 이하가 된 유닛은 상태 기반 처리로 파괴한다.

필수 헬퍼:

- `isUnitDestroyed(instance): boolean`
- `collectDestroyedUnits(state): InstanceId[]`
- `destroyUnit(state, unitId, reason): DestroyUnitResult`
- `destroyUnits(state, unitIds, reason): DestroyUnitsResult`

파괴 처리 순서:

1. 파괴 대상 유닛의 현재 보드 슬롯을 찾는다.
2. 해당 보드 슬롯의 `unit`을 `null`로 만든다.
3. 카드 인스턴스를 `BATTLEFIELD -> GRAVEYARD`로 이동한다.
4. 카드 인스턴스의 `damage`, `exhausted`, `summonedThisTurn`은 묘지 이동 후에도 기록 보존을 우선한다.
5. `UNIT_DESTROYED` 이벤트를 기록한다.
6. `CARD_MOVED` 이벤트를 기록한다.
7. 파괴된 유닛의 컨트롤러 지배력을 재계산한다.

이벤트 순서:

- 권장 순서: `UNIT_DESTROYED` -> `CARD_MOVED` -> `DOMINANCE_CHANGED`
- 공격 전체 로그에서는 피해 이벤트 뒤에 파괴 이벤트가 온다.

Phase7에서는 사망 트리거, 유언 효과, 대체 파괴 효과, 부활 효과를 구현하지 않는다.

## 8. 공격 액션 처리

`ATTACK` 액션은 다음 순서로 처리한다.

1. 공통 검증을 수행한다.
2. 공격자 검증을 수행한다.
3. 대상 검증을 수행한다.
4. `ATTACK_DECLARED` 이벤트를 기록한다.
5. 피해 계획을 계산한다.
6. 대상 피해를 적용하고 `DAMAGE_DEALT` 이벤트를 기록한다.
7. 반격 조건을 만족하면 공격자 피해를 적용하고 `DAMAGE_DEALT` 이벤트를 기록한다.
8. 체력 0 이하 유닛을 수집한다.
9. 파괴 대상 유닛을 묘지로 이동하고 파괴/이동/지배력 이벤트를 기록한다.
10. 공격자를 `exhausted = true`로 설정한다.
11. `turnState.attackedUnitIds`에 공격자 ID를 추가한다.
12. `ActionLogEntry`를 기록한다.

로그 순서 예시:

- 유닛 공격, 파괴 없음: `ATTACK_DECLARED` -> `DAMAGE_DEALT`
- 전열 유닛 교전: `ATTACK_DECLARED` -> 공격 피해 `DAMAGE_DEALT` -> 반격 피해 `DAMAGE_DEALT`
- 유닛 파괴 발생: 피해 이벤트 뒤 `UNIT_DESTROYED` -> `CARD_MOVED` -> `DOMINANCE_CHANGED`
- 플레이어 직접 공격: `ATTACK_DECLARED` -> `DAMAGE_DEALT`

## 9. Phase/action 연결

Phase7부터 `ATTACK`은 구현된 액션이다.

허용 액션:

| Phase | 허용 액션 |
|---|---|
| `MAIN` | `SUMMON_UNIT`, `MOVE_UNIT`, `END_PHASE` |
| `COMBAT` | `ATTACK`, `END_PHASE` |
| `END` | `END_TURN` |

미지원 유지 액션:

- `PLAY_CARD`
- `ACTIVATE_EFFECT`
- `MULLIGAN`
- `SELECT_TARGET`

정책:

- `ATTACK`은 `applyAction`에서 성공/실패 결과를 반환한다.
- 검증 실패 시 입력 `state`를 변경하지 않는다.
- 성공 시 새 `GameState`, 발생 이벤트 배열, action log entry를 반환한다.
- 공격 후 게임 종료 판정은 Phase10에서 연결한다. Phase7에서는 플레이어 HP가 0 이하가 되어도 `GAME_ENDED`를 기록하지 않는다.

## 10. 테스트 요구사항

Phase7 테스트는 최소한 다음을 검증한다.

- `COMBAT` 페이즈에서 전장 유닛이 같은 열 상대 전열 유닛을 공격할 수 있다.
- `MAIN` 페이즈 공격은 실패한다.
- 전장에 없는 공격자는 실패한다.
- 상대가 조종하는 유닛으로 공격하면 실패한다.
- 이미 공격한 유닛은 실패한다.
- exhausted 유닛은 실패한다.
- 이번 턴 소환된 유닛은 실패한다.
- `CANNOT_ATTACK` 또는 `STUNNED` 상태 유닛은 실패한다.
- 같은 열 상대 전열이 있으면 후열 유닛 직접 공격은 실패한다.
- 같은 열 상대 전열이 없으면 후열 유닛 공격은 성공한다.
- 같은 열 상대 유닛이 없으면 상대 플레이어 직접 공격은 성공한다.
- 다른 열 유닛 공격은 실패한다.
- 플레이어 직접 공격이 유닛에 의해 막히면 실패한다.
- 유닛 대상 공격은 대상 유닛의 `damage`를 증가시킨다.
- 플레이어 대상 공격은 대상 플레이어의 `hp`를 감소시킨다.
- 전열 유닛 간 공격은 공격자에게 반격 피해를 적용한다.
- 후열 유닛 대상 공격은 반격 피해를 적용하지 않는다.
- 체력 0 이하 유닛은 묘지로 이동하고 보드 슬롯이 비워진다.
- 유닛 파괴 후 지배력이 재계산된다.
- 공격 성공 시 공격자가 exhausted 처리되고 `attackedUnitIds`에 기록된다.
- 공격 성공 시 `ATTACK_DECLARED`, `DAMAGE_DEALT`, 필요 시 `UNIT_DESTROYED`, `CARD_MOVED`, `DOMINANCE_CHANGED` 이벤트가 기록된다.
- `ATTACK`이 `applyAction`에서 처리된다.
- 실패한 공격은 입력 상태를 변경하지 않는다.
- 룰 엔진 영역이 `src/scenes`, `src/ui`, Phaser, DOM을 import하지 않는다.

## 11. 완료 검증 명령

Phase7 완료 전 다음 명령을 모두 통과시킨다.

```bash
npm run build
npm run lint
npm run format:check
npm test
```

추가 감사 명령:

```bash
rg -n "from ['\"]\\.\\.?/.*/(scenes|ui)|from ['\"]phaser|document\\.|window\\." src/core src/game src/rules src/cards src/zones src/board src/dominance src/battle src/events src/effects src/replay src/ai
rg -n "창각|創刻|アテリアル" src tests card-data
```

첫 번째 명령은 룰 엔진 계층의 UI/Phaser/DOM 의존성이 없어야 한다. 두 번째 명령은 문서 외 코드와 카드 데이터에 원작 보호 대상 텍스트가 들어가지 않았는지 확인하기 위한 감사다.

## 12. Phase7 완료 후 남겨야 할 경계

Phase7이 끝나도 다음은 아직 미완성으로 남겨야 한다.

- 카드 효과 DSL 실행
- 공격 전/후 트리거 해결
- 지속 효과 레이어에 따른 공격력/체력/피해 감소/보호막 계산
- 도발, 은신, 사거리, 광역 공격, 관통, 생명 흡수
- HP 0, 덱 아웃, PvE 목표 기반 승리 조건
- `GAME_ENDED` 이벤트와 최종 로그 고정
- 저장 파일 포맷과 리플레이 재생기
- AI 행동 탐색과 평가 함수

이 경계를 넘는 구현은 Phase8 이후 문서에서 다룬다.
