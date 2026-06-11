# 밸런스 리포트

검증 대상: Phase14 PvE starter deck / scenario baseline

## 기준

- rule version: 코드의 `RULE_VERSION`
- card data version: `phase13-pve-cards`
- deck ID: `PVE_PLAYER_STARTER_DECK`, `PVE_AI_STARTER_DECK`
- scenario ID: `pve_intro_duel`, `pve_boss_trial`
- seed policy: `PHASE14_BALANCE_SEEDS`
- 자동 검증 명령: `npm run check:balance`

## 실패 기준

다음 항목은 hard fail이다.

- AI illegal action 또는 simulation error가 발생한다.
- deterministic replay mismatch가 1건 이상 발생한다.
- build artifact 또는 card asset 참조가 누락된다.

## Warning 기준

다음 항목은 현재 MVP 카드 풀이 작으므로 warning으로 기록하고, 다음 밸런스 조정에서 우선 검토한다.

- 일반전 플레이어 승률이 45% 미만 또는 75% 초과
- 보스전 클리어율이 25% 미만 또는 60% 초과
- 일반전 평균 종료 턴이 5턴 미만 또는 14턴 초과
- 보스전 평균 종료 턴이 7턴 미만 또는 20턴 초과

## 현재 결과 기록 양식

`npm run check:balance` 실행 결과를 아래에 붙여 갱신한다.

```text
# Phase14 Balance Check

status: ok
seeds: phase14-balance-001, phase14-balance-002, phase14-balance-003, phase14-balance-004

## pve_intro_duel
sampleCount: 4
completedGames: 0
playerWinRate: 0.0%
bossClearRate: n/a
averageTurnCount: 13.00
medianTurnCount: 13.00
deckOutRate: 0.0%
averageRemainingHp: 20.00
dominanceOverloadRate: 0.0%
illegalActionRate: 0.0%
replayMismatchCount: 0
finalStateHashes: fnv1a32:a598e57b, fnv1a32:fe704fa8, fnv1a32:15e2452b, fnv1a32:a65ddf13
warnings: intro playerWinRate outside recommended 45%-75% range

## pve_boss_trial
sampleCount: 4
completedGames: 0
playerWinRate: 0.0%
bossClearRate: 0.0%
averageTurnCount: 13.00
medianTurnCount: 13.00
deckOutRate: 0.0%
averageRemainingHp: 24.00
dominanceOverloadRate: 0.0%
illegalActionRate: 0.0%
replayMismatchCount: 0
finalStateHashes: fnv1a32:624dbe75, fnv1a32:cd0b5266, fnv1a32:7c5b1ed4, fnv1a32:33ebbd45
warnings: bossClearRate outside recommended 25%-60% range
```

## 조정 메모

- starter deck은 현재 독자 예시 카드 4종으로 구성되어 있어 승률과 평균 턴 수가 카드 풀이 적은 영향을 크게 받는다.
- Phase14에서는 재현성, 불법 행동 방지, replay mismatch 방지를 hard gate로 둔다.
- 30장 덱 기준 자동 밸런스 검증은 짧은 bounded simulation으로 실행하므로 `completedGames`는 참고 지표로만 본다.
- 승률과 턴 수는 향후 카드 수 확장, AI 평가 함수 보강, 보스 시나리오 수치 조정 시 hard gate로 전환한다.
