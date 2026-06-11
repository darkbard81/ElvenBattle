import {
  checkBuildArtifacts,
  DEFAULT_BUILD_ARTIFACT_BUDGET,
  formatBuildArtifactCheckResult,
  type BuildArtifactCheckOptions,
} from './check-build-artifacts';

export function checkPerformanceBudget(options: BuildArtifactCheckOptions = {}) {
  return checkBuildArtifacts({
    ...options,
    budgets: options.budgets ?? DEFAULT_BUILD_ARTIFACT_BUDGET,
  });
}

const result = checkPerformanceBudget();

console.log(formatBuildArtifactCheckResult(result));

if (!result.ok) {
  process.exitCode = 1;
}
