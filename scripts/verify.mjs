import { spawnSync } from 'node:child_process';

const suites = [
  'check:publish', 'typecheck', 'build:app', 'test:files', 'test:duplicates',
  'test:features', 'test:subfolders', 'test', 'test:desktop',
  'test:features:desktop', 'test:subfolders:desktop', 'test:source-choices',
  'test:books', 'test:key', 'test:a11y', 'test:fluent',
];
for (const suite of suites) {
  console.log(`\nRunning ${suite}`);
  // Use npm's JS entry point so arguments never pass through a shell.
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', suite], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nPASS all verification suites.');
