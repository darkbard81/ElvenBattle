import { formatPhase14BalanceReport, runPhase14BalanceCheck } from './phase14-balance';

const report = runPhase14BalanceCheck();

console.log(formatPhase14BalanceReport(report));

if (!report.ok) {
  process.exitCode = 1;
}
