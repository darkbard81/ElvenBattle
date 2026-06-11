import { spawnSync } from 'node:child_process';

const COMMANDS: readonly string[][] = [
  ['npm', '--silent', 'run', 'build'],
  ['npm', 'run', 'lint'],
  ['npm', 'run', 'format:check'],
  ['npm', 'test', '--', '--reporter=dot'],
  ['npm', 'run', 'generate:cards:check'],
  ['npm', 'run', 'check:balance'],
  ['npm', 'run', 'check:artifacts'],
  ['npm', 'run', 'check:performance'],
];

for (const command of COMMANDS) {
  const [binary, ...args] = command;

  if (!binary) {
    continue;
  }

  console.log(`\n> ${command.join(' ')}`);

  const result = spawnSync(binary, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
