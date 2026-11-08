/**
 * Regression tests for year/month folders, run history and multi-run Undo,
 * backup cleanup, the watched folder, and saved rule sets.
 * Uses disposable synthetic files under .test-artifacts. Run with
 * `npm run test:features`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const base = path.resolve('.test-artifacts');
await fs.mkdir(base, { recursive: true });
const root = await fs.mkdtemp(path.join(base, 'features-'));
const userData = path.join(root, 'profile');
const trash = path.join(root, 'recycle-bin');
await fs.mkdir(userData); await fs.mkdir(trash);
const bundle = path.join(root, 'services.mjs');
const electronFixture = `
  import fs from 'node:fs/promises'; import path from 'node:path';
  export const app = { getPath: () => ${JSON.stringify(userData)} };
  export const safeStorage = { decryptString: () => { throw new Error(); } };
  export const shell = { trashItem: async (p) => fs.rename(p, path.join(${JSON.stringify(trash)}, String(Date.now()) + path.basename(p))) };
`;
await build({
  stdin: { contents: 'export * from "./electron/services/organizer"; export * from "./electron/services/history"; export * from "./electron/services/backups"; export * from "./electron/services/watch"; export * from "./electron/services/preview"; export * from "./src/app/lib/ruleSets"; export * from "./src/shared/dateFolders";', resolveDir: process.cwd() },
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', external: ['@google/genai'],
  plugins: [{ name: 'electron-fixture', setup(b) { b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'fixture' })); b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: electronFixture, loader: 'js', resolveDir: process.cwd() })); } }],
});
const m = await import(pathToFileURL(bundle));
process.env.GEMINI_API_KEY = '';
const filters = { dateModified: 'any', fileSize: 'any', excludeHidden: true };
const exists = (p) => fs.access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Year / month folders ────────────────────────────────────────────────────
{
  const source = path.join(root, 'photos'); const dest = path.join(root, 'photos-out');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'beach.jpg'), 'a');
  await fs.writeFile(path.join(source, 'snow.jpg'), 'b');
  await fs.utimes(path.join(source, 'beach.jpg'), new Date(2024, 6, 4, 12), new Date(2024, 6, 4, 12));
  await fs.utimes(path.join(source, 'snow.jpg'), new Date(2023, 0, 15, 12), new Date(2023, 0, 15, 12));
  assert.deepEqual(m.dateFolderSegments(new Date(2024, 6, 4).getTime(), 'month'), ['2024', '07']);
  assert.deepEqual(m.dateFolderSegments(Date.now(), 'bogus'), []);
  const categories = [{ id: 'images', name: 'Images', enabled: true, extensions: ['jpg'], subfolders: false, dateFolders: 'month' }];
  const preview = await m.buildPreview(source, categories, false, filters);
  assert.ok(preview.every((file) => Number.isFinite(file.modifiedMs)));
  const result = await m.runOrganizeJob({ sourcePath: source, destPath: dest, categories, filters, conflictResolution: 'rename' });
  assert.equal(result.moved, 2);
  assert.ok(await exists(path.join(dest, 'Images', '2024', '07', 'beach.jpg')));
  assert.ok(await exists(path.join(dest, 'Images', '2023', '01', 'snow.jpg')));
  const yearOnly = await m.runOrganizeJob({ sourcePath: path.join(dest, 'Images', '2024', '07'), destPath: path.join(root, 'year-out'), categories: [{ ...categories[0], subfolders: true, dateFolders: 'year' }], filters, conflictResolution: 'rename' });
  assert.equal(yearOnly.moved, 1);
  assert.ok(await exists(path.join(root, 'year-out', 'Images', 'jpg', '2024', 'beach.jpg')));
  console.log('PASS year and year/month folders use the modified date, after extension subfolders');
}

// ── Limiting a run to specific files ────────────────────────────────────────
{
  const source = path.join(root, 'only'); const dest = path.join(root, 'only-out');
  await fs.mkdir(source);
  for (const name of ['old.txt', 'new.txt']) await fs.writeFile(path.join(source, name), name);
  const result = await m.runOrganizeJob({ sourcePath: source, destPath: dest, categories: [{ id: 'd', name: 'Docs', enabled: true, extensions: ['txt'], subfolders: false }], filters, conflictResolution: 'rename', onlyPaths: [path.join(source, 'new.txt')] });
  assert.equal(result.moved, 1);
  assert.ok(await exists(path.join(source, 'old.txt')));
  assert.ok(await exists(path.join(dest, 'Docs', 'new.txt')));
  console.log('PASS onlyPaths limits a run to the given files');
}

// ── Run history and multi-run Undo ──────────────────────────────────────────
{
  let changes = 0;
  m.loadHistory(() => { changes += 1; });
  const source = path.join(root, 'history'); const dest = path.join(root, 'history-out');
  await fs.mkdir(source);
  const categories = [{ id: 'd', name: 'Docs', enabled: true, extensions: ['txt'], subfolders: false }];
  await fs.writeFile(path.join(source, 'first.txt'), '1');
  const request = { sourcePath: source, destPath: dest, categories, filters, conflictResolution: 'rename' };
  const first = await m.runOrganizeJob(request);
  const firstId = m.recordRun('manual', request, first);
  await fs.writeFile(path.join(source, 'second.txt'), '2');
  const second = await m.runOrganizeJob(request);
  const secondId = m.recordRun('scheduled', request, second);
  assert.equal(m.recordRun('manual', request, { success: true, operations: [] }), undefined, 'empty runs are not kept');
  let runs = m.listRuns();
  assert.deepEqual(runs.map((run) => [run.id, run.kind, run.remaining]), [[secondId, 'scheduled', 1], [firstId, 'manual', 1]]);
  assert.ok(!('operations' in runs[0]), 'summaries omit move lists');
  // Undo the older run only.
  const ops = m.getRunOperations(firstId);
  const undo = await m.undoOperations(ops);
  m.applyUndo(ops, undo.remainingOperations);
  runs = m.listRuns();
  assert.equal(runs.find((run) => run.id === firstId).undone, true);
  assert.equal(runs.find((run) => run.id === secondId).remaining, 1);
  assert.ok(await exists(path.join(source, 'first.txt')));
  assert.ok(await exists(path.join(dest, 'Docs', 'second.txt')));
  // History survives a restart.
  m.loadHistory();
  assert.equal(m.listRuns().length, 2);
  assert.ok(changes >= 3);
  // Two runs reuse a destination; the older Undo must not restore the new file.
  const sharedDest = path.join(root, 'overlap-out');
  const firstSource = path.join(root, 'versions'); const secondSource = firstSource;
  await fs.mkdir(firstSource);
  await fs.writeFile(path.join(firstSource, 'same.txt'), 'VERSION A');
  const requestA = { ...request, sourcePath: firstSource, destPath: sharedDest, conflictResolution: 'overwrite' };
  const a = await m.runOrganizeJob(requestA); const aId = m.recordRun('manual', requestA, a);
  await fs.writeFile(path.join(secondSource, 'same.txt'), 'VERSION B');
  const requestB = { ...requestA, sourcePath: secondSource };
  const b = await m.runOrganizeJob(requestB); const bId = m.recordRun('watch', requestB, b);
  m.loadHistory();
  const blocked = await m.undoOperations(m.getRunOperations(aId));
  assert.equal(blocked.reverted, 0); assert.match(blocked.error, /newer run/);
  const stale = await m.undoOperations(a.operations.map(operation => ({ ...operation, id: 'stale-' + operation.id })));
  assert.equal(stale.reverted, 0); assert.match(stale.error, /out of date/);
  assert.equal(await fs.readFile(path.join(sharedDest, 'Docs', 'same.txt'), 'utf8'), 'VERSION B');
  const undoB = await m.undoOperations(m.getRunOperations(bId));
  assert.equal(undoB.success, true); m.applyUndo(m.getRunOperations(bId), undoB.remainingOperations);
  assert.equal(m.getRunOperations(aId).length, 1, 'newer Undo must not erase an older operation');
  assert.equal(await fs.readFile(path.join(secondSource, 'same.txt'), 'utf8'), 'VERSION B');
  await fs.rename(path.join(secondSource, 'same.txt'), path.join(root, 'preserved-version-b.txt'));
  const undoA = await m.undoOperations(m.getRunOperations(aId));
  assert.equal(undoA.success, true); m.applyUndo(m.getRunOperations(aId), undoA.remainingOperations);
  assert.equal(await fs.readFile(path.join(firstSource, 'same.txt'), 'utf8'), 'VERSION A');
  assert.equal(await fs.readFile(path.join(root, 'preserved-version-b.txt'), 'utf8'), 'VERSION B');
  // Only the last 10 runs are kept.
  for (let index = 0; index < 12; index += 1) m.recordRun('watch', request, { success: true, moved: 1, operations: [{ originalPath: `/x/${index}`, newPath: `/y/${index}`, originalName: 'a', newName: 'a' }] });
  assert.equal(m.listRuns().length, 10);
  console.log('PASS run history records runs, undoes an older run independently, persists, and keeps 10');
}

// ── Backup cleanup ──────────────────────────────────────────────────────────
{
  const source = path.join(root, 'replace'); const dest = path.join(root, 'replace-out');
  await fs.mkdir(source); await fs.mkdir(path.join(dest, 'Docs'), { recursive: true });
  await fs.writeFile(path.join(source, 'report.txt'), 'new');
  await fs.writeFile(path.join(dest, 'Docs', 'report.txt'), 'old version');
  const request = { sourcePath: source, destPath: dest, categories: [{ id: 'd', name: 'Docs', enabled: true, extensions: ['txt'], subfolders: false }], filters, conflictResolution: 'overwrite' };
  const result = await m.runOrganizeJob(request);
  const id = m.recordRun('manual', request, result);
  let status = await m.backupStatus([dest]);
  assert.equal(status.files, 1); assert.equal(status.bytes, 'old version'.length); assert.equal(status.folders.length, 1);
  const cleaned = await m.cleanUpBackups([dest]);
  assert.equal(cleaned.success, true); assert.equal(cleaned.status.files, 0);
  assert.equal((await fs.readdir(trash)).length, 1, 'backups go to the Recycle Bin, not deleted');
  assert.equal(m.getRunOperations(id).length, 1, 'the backup move is dropped from the history');
  const undo = await m.undoOperations(m.getRunOperations(id));
  assert.equal(undo.reverted, 1);
  assert.equal(await fs.readFile(path.join(source, 'report.txt'), 'utf8'), 'new');
  status = await m.backupStatus([dest]);
  assert.equal(status.files, 0);
  console.log('PASS backup cleanup measures, recycles, and keeps the remaining Undo usable');
}

// ── Watched folder ──────────────────────────────────────────────────────────
{
  const source = path.join(root, 'downloads'); const dest = path.join(root, 'downloads-out');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'already-here.pdf'), 'existing');
  const batches = [];
  m.setWatchBatchListener((request, result) => batches.push({ request, result }));
  const request = { sourcePath: source, destPath: dest, categories: [{ id: 'documents', name: 'Documents', enabled: true, extensions: ['pdf'], subfolders: false }], filters, conflictResolution: 'rename' };
  assert.equal(await m.startWatching(request), null);
  await sleep(300);
  await fs.appendFile(path.join(source, 'already-here.pdf'), ' edited while watching');
  await fs.writeFile(path.join(source, 'invoice.pdf.crdownload'), 'partial');
  await sleep(1500);
  await fs.rename(path.join(source, 'invoice.pdf.crdownload'), path.join(source, 'invoice.pdf'));
  await fs.writeFile(path.join(source, 'notes.zzz'), 'no rule');
  for (let waited = 0; waited < 15000 && batches.length === 0; waited += 500) await sleep(500);
  assert.equal(batches.length, 1, 'one batch after the download settles');
  assert.deepEqual(batches[0].request.onlyPaths.map((p) => path.basename(p)).sort(), ['invoice.pdf', 'notes.zzz']);
  assert.ok(await exists(path.join(dest, 'Documents', 'invoice.pdf')));
  assert.ok(await exists(path.join(source, 'already-here.pdf')), 'files present before watching are left alone');
  assert.ok(await exists(path.join(source, 'notes.zzz')), 'files without a rule stay');
  // Undo puts the file back; the watcher must not move it again.
  await m.undoOperations(batches[0].result.operations);
  await sleep(8000);
  assert.equal(batches.length, 1, 'restored files are not re-tidied');
  assert.ok(await exists(path.join(source, 'invoice.pdf')));
  await fs.appendFile(path.join(source, 'invoice.pdf'), ' edited after Undo');
  await fs.writeFile(path.join(source, 'repeat.pdf'), 'first arrival');
  for (let waited = 0; waited < 15000 && batches.length < 2; waited += 500) await sleep(500);
  assert.equal(batches.length, 2, 'a new filename is filed while edited restored files stay');
  await fs.writeFile(path.join(source, 'repeat.pdf'), 'second arrival');
  for (let waited = 0; waited < 15000 && batches.length < 3; waited += 500) await sleep(500);
  assert.equal(batches.length, 3, 'a fresh arrival can reuse a successfully moved filename');
  assert.equal(await fs.readFile(path.join(dest, 'Documents', 'repeat.pdf'), 'utf8'), 'first arrival');
  assert.equal(await fs.readFile(path.join(dest, 'Documents', 'repeat (1).pdf'), 'utf8'), 'second arrival');
  assert.ok(await exists(path.join(source, 'invoice.pdf')), 'editing an Undo-restored file does not move it');
  m.stopWatching();
  assert.equal(m.isWatching(), false);
  assert.match(await m.startWatching({ ...request, destPath: '' }), /Choose a source and destination/);
  assert.match(await m.startWatching({ ...request, destPath: source }), /different from the watched/);
  console.log('PASS watched folder waits for downloads, moves only new files, and respects Undo');
}

// ── Saved rule sets ─────────────────────────────────────────────────────────
{
  const builtIns = m.builtInRuleSets();
  assert.deepEqual(builtIns.map((set) => set.name), ['Downloads cleanup', 'Photos by month']);
  const photos = builtIns[1];
  assert.deepEqual(photos.categories.filter((c) => c.enabled).map((c) => [c.id, c.dateFolders]), [['images', 'month']]);
  const mine = { ...builtIns[0], id: m.newRuleSetId(), name: 'Work', builtIn: undefined };
  const file = JSON.parse(JSON.stringify(m.toExportFile([mine])));
  assert.equal(file.type, 'tidy-rule-sets');
  const imported = m.fromImportFile(file, [mine]);
  assert.equal(imported.length, 1); assert.equal(imported[0].name, 'Work (imported)'); assert.notEqual(imported[0].id, mine.id);
  const again = m.fromImportFile(file, [mine, ...imported]);
  assert.equal(again[0].name, 'Work (imported 2)');
  assert.match(m.fromImportFile({ type: 'other' }, []), /isn't a Tidy rule set/);
  assert.match(m.fromImportFile({ type: 'tidy-rule-sets', version: 1, ruleSets: [{ name: 'bad' }] }, []), /No usable/);
  assert.match(m.fromImportFile({ ...file, version: 999 }, []), /not supported/);
  assert.match(m.fromImportFile(file, Array.from({ length: 50 }, (_, i) => ({ ...mine, id: 'set_' + i, name: 'Set ' + i }))), /up to 50/);
  assert.equal(m.readRuleSets([mine, { junk: true }]).length, 1, 'invalid saved sets are dropped');
  console.log('PASS rule sets: built-ins, export/import round trip, name conflicts, and validation');
}

await fs.writeFile(path.join(root, 'results.json'), JSON.stringify({ passed: true, groups: 6, overlappingUndo: true, existingAndRestoredFileEdits: true, repeatedDownloadNames: true, importVersionAndCapacity: true }, null, 2));
console.log('6 feature regression groups passed');
