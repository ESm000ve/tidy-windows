import fs from 'node:fs/promises';
import path from 'node:path';

// The main/preload/renderer builds bundle all runtime libraries. Stage only
// those artifacts, excluding development modules and optional native accelerators.
const root = path.resolve('build/windows-app');
if (root !== path.join(process.cwd(), 'build', 'windows-app')) throw new Error('Unexpected staging directory');
await fs.mkdir(root, { recursive: true });

for (const folder of ['dist', 'dist-electron']) {
  const target = path.join(root, folder);
  if (!target.startsWith(root + path.sep)) throw new Error('Invalid staging path');
  // Only these verified, generated staging folders are cleared.
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  await fs.cp(path.resolve(folder), target, { recursive: true, force: true, filter: (p) => !path.basename(p).startsWith('._') });
}

await fs.mkdir(path.join(root, 'build'), { recursive: true });
await fs.copyFile('assets/icon.png', path.join(root, 'build/icon.png'));
const p = JSON.parse(await fs.readFile('package.json', 'utf8'));
await fs.writeFile(
  path.join(root, 'package.json'),
  JSON.stringify(
    {
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      type: 'module',
      main: 'dist-electron/main.js',
    },
    null,
    2
  )
);
console.log('Prepared Windows runtime without development dependencies.');
