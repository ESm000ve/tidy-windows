/**
 * Desktop checks for normal startup, rule sets, date
 * folders, run history Undo, backup cleanup, and the watched folder.
 * Synthetic files and an isolated profile only. `npm run test:features:desktop`.
 */
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const artifacts = path.resolve('.test-artifacts'); await fs.mkdir(artifacts, { recursive: true });
const root = await fs.mkdtemp(path.join(artifacts, 'features-desktop-'));
const source = path.join(root, 'Downloads'); const dest = path.join(root, 'Organized');
await fs.mkdir(source); await fs.mkdir(dest);
await fs.writeFile(path.join(source, 'trip.jpg'), 'photo');
await fs.utimes(path.join(source, 'trip.jpg'), new Date(2025, 4, 20, 12), new Date(2025, 4, 20, 12));
await fs.writeFile(path.join(source, 'letter.pdf'), 'letter');
const env = { ...process.env, GEMINI_API_KEY: '' }; delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.TIDY_EXECUTABLE;
const exists = (p) => fs.access(p).then(() => true, () => false);
const results = [];

const app = await electron.launch({ executablePath, args: [...(executablePath ? [] : ['.']), `--user-data-dir=${path.join(root, 'profile')}`], env, timeout: 60000 });
const errors = [];
try {
  const page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const preview = page.getByRole('dialog', { name: 'Preview Changes', exact: true });

  // 1. Normal startup does not open a preview or move files.
  await page.locator('#main-content').waitFor();
  assert.equal(await preview.count(), 0);
  await page.evaluate(({source,dest}) => {localStorage.setItem('tidy_source_path',source);localStorage.setItem('tidy_dest_path',dest);}, {source,dest}); await page.reload();
  await page.locator('#main-content').waitFor();
  results.push('Normal startup preserves files and restores the selected folders');

  // 2. Rule sets: apply a built-in, save, export, delete, import.
  await page.locator('#rule-set-select').click();
  await page.getByRole('option', { name: 'Photos by month (built-in)', exact: true }).click();
  await page.getByText('Applied “Photos by month”.', { exact: false }).waitFor();
  let categories = await page.evaluate(() => JSON.parse(localStorage.getItem('tidy_categories')));
  assert.deepEqual(categories.filter((c) => c.enabled).map((c) => [c.id, c.dateFolders]), [['images', 'month']]);
  await page.getByRole('button', { name: 'Save current…', exact: true }).click();
  await page.locator('#rule-set-name').fill('Family photos');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Saved “Family photos”.').waitFor();
  const exportPath = path.join(root, 'sets.json');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, exportPath);
  await page.getByRole('button', { name: 'Export…', exact: true }).click();
  await page.getByText('Exported 1 rule set(s).').waitFor();
  const exported = JSON.parse(await fs.readFile(exportPath, 'utf8'));
  assert.equal(exported.type, 'tidy-rule-sets'); assert.equal(exported.ruleSets[0].name, 'Family photos');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByText('Deleted “Family photos”.').waitFor();
  await page.getByRole('button', { name: 'Import…', exact: true }).click();
  await page.getByText(/Imported “Family photos”/).waitFor();
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('tidy_rule_sets')))).length, 1);
  for (const [content, message] of [
    ['{broken', "That file isn't a readable Tidy rule set."],
    [' '.repeat(1024 * 1024 + 1), 'That file is too large to be a Tidy rule set.'],
    [JSON.stringify({ ...exported, version: 999 }), 'That rule set version is not supported. Export it again from a compatible version of Tidy.'],
  ]) {
    await fs.writeFile(exportPath, content);
    await page.getByRole('button', { name: 'Import…', exact: true }).click();
    await page.getByText(message, { exact: true }).waitFor();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('tidy_rule_sets')))).length, 1);
  }
  results.push('Rule sets apply, save, export, delete, and import');

  // 3. Date folders show in the preview and are used by the run.
  await page.getByRole('button', { name: 'Run Tidy', exact: true }).click();
  await preview.waitFor();
  assert.ok((await preview.innerText()).includes('2025\\05'), 'preview shows the date folder');
  await page.getByRole('button', { name: 'Confirm & Run', exact: true }).click();
  await page.getByRole('heading', { name: 'Tidy Complete!', exact: true }).waitFor();
  assert.ok(await exists(path.join(dest, 'Images', '2025', '05', 'trip.jpg')));
  assert.ok(await exists(path.join(source, 'letter.pdf')), 'disabled categories stay');
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  results.push('Year/month folders appear in the preview and the run');

  // 4. Run history Undo from the Activity Log clears the last-run record.
  await page.getByRole('button', { name: 'Toggle Activity Log', exact: true }).click();
  const log = page.getByRole('dialog', { name: 'Activity Log', exact: true });
  await log.getByText(/^Manual run · Today/).waitFor();
  await log.getByRole('button', { name: /^Undo manual run from/ }).click();
  await log.getByText('Restored 1 file(s) to where they were.').waitFor();
  assert.ok(await exists(path.join(source, 'trip.jpg')));
  await log.getByText('Undone', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tidy_metrics')).operations.length), 0);
  await page.screenshot({ path: path.join(root, 'activity-log.png') });
  await page.getByRole('button', { name: 'Close Activity Log', exact: true }).click();
  results.push('Activity Log lists runs and undoes one, keeping the last-run record in step');

  // 5. Backups from "Replace existing" can be cleaned up.
  await fs.mkdir(path.join(dest, 'Images', '2025', '05'), { recursive: true });
  await fs.writeFile(path.join(dest, 'Images', '2025', '05', 'trip.jpg'), 'older copy');
  await page.evaluate(() => localStorage.setItem('tidy_conflict_resolution', '"overwrite"')); await page.reload();
  await page.locator('#main-content').waitFor();
  await page.getByRole('button', { name: 'Run Tidy', exact: true }).click(); await preview.waitFor();
  await page.getByRole('button', { name: 'Confirm & Run', exact: true }).click();
  await page.getByRole('heading', { name: 'Tidy Complete!', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const recycled = [];
  await app.evaluate(({ shell }) => { globalThis.__recycled = []; shell.trashItem = async (p) => { globalThis.__recycled.push(p); await process.getBuiltinModule('node:fs/promises').rm(p, { recursive: true }); }; });
  await page.getByRole('button', { name: 'Toggle Activity Log', exact: true }).click();
  await log.getByText(/1 file\(s\), .* in 1 “\.Tidy Undo” folder/).waitFor();
  await log.getByRole('button', { name: 'Clean up backups', exact: true }).click();
  await log.getByRole('button', { name: 'Move to Recycle Bin', exact: true }).click();
  await log.getByText('Backups moved to the Recycle Bin.').waitFor();
  recycled.push(...await app.evaluate(() => globalThis.__recycled));
  assert.equal(recycled.length, 1); assert.ok(recycled[0].endsWith('.Tidy Undo'));
  await page.getByRole('button', { name: 'Close Activity Log', exact: true }).click();
  results.push('Clean up backups confirms and sends .Tidy Undo to the Recycle Bin');

  // 6. Watched folder files new arrivals without a preview.
  await fs.writeFile(path.join(source, 'already-here.jpg'), 'existing photo');
  await page.evaluate(() => localStorage.setItem('tidy_conflict_resolution', '"rename"')); await page.reload();
  await page.locator('#main-content').waitFor();
  await page.getByRole('switch', { name: 'Tidy new files automatically' }).click();
  await page.getByText('Watching the source folder.', { exact: false }).waitFor();
  await fs.appendFile(path.join(source, 'already-here.jpg'), ' edited');
  await fs.writeFile(path.join(source, 'new-photo.jpg'), 'fresh');
  for (let waited = 0; waited < 20000 && !(await exists(path.join(dest, 'Images'))); waited += 500) await new Promise((r) => setTimeout(r, 500));
  const today = new Date();
  const watchedTarget = path.join(dest, 'Images', String(today.getFullYear()), String(today.getMonth() + 1).padStart(2, '0'), 'new-photo.jpg');
  for (let waited = 0; waited < 20000 && !(await exists(watchedTarget)); waited += 500) await new Promise((r) => setTimeout(r, 500));
  assert.ok(await exists(watchedTarget), 'watched file was filed');
  assert.equal(await fs.readFile(path.join(source, 'already-here.jpg'), 'utf8'), 'existing photo edited', 'editing a baseline file must not move it');
  await page.getByRole('button', { name: 'Toggle Activity Log', exact: true }).click();
  await log.getByText(/^New files · Today/).waitFor();
  await page.getByRole('button', { name: 'Close Activity Log', exact: true }).click();
  await page.getByRole('switch', { name: 'Tidy new files automatically' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('tidy_watch_source')), 'false');
  results.push('Watched folder files a new download and records it in the history');

  await app.evaluate(({app,BrowserWindow}) => {BrowserWindow.getAllWindows()[0].hide();app.emit('second-instance',{},['Tidy.exe']);});
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('tidy_source_path')),source);
  assert.equal(await preview.count(),0);
  results.push('Second launch restores the existing window without changing folders or starting a run');

  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(root, 'results.json'), JSON.stringify({ passed: true, packaged: !!executablePath, checks: results, pageErrors: errors }, null, 2));
  results.forEach((name) => console.log('PASS', name));
} finally {
  await app.close();
}
