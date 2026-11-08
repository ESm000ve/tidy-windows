// Native APIs are exercised, not replaced. Uses an installed app and synthetic
// files. Startup registration is tested only when no Tidy entry already exists.
import { _electron as electron, chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';

assert.equal(process.platform, 'win32', 'This suite requires Windows.');
const exec = promisify(execFile);
const base = path.resolve('.test-artifacts'); await fs.mkdir(base, { recursive: true });
const root = await fs.mkdtemp(path.join(base, 'native-'));
await fs.mkdir(path.join(base, 'native-windows'), { recursive: true });
await fs.writeFile(path.join(base, 'native-windows', 'current.json'), JSON.stringify({ root }));
const profile = path.join(root, 'profile'), source = path.join(root, 'Source'), dest = path.join(root, 'Organized');
await fs.mkdir(source); await fs.mkdir(dest);
const executablePath = process.env.TIDY_EXECUTABLE || path.join(process.env.LOCALAPPDATA, 'Programs', 'Tidy', 'Tidy.exe');
const env = { ...process.env, GEMINI_API_KEY: '' }; delete env.ELECTRON_RUN_AS_NODE;
const startupName = 'com.ericauzenne.tidy';
const startupKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const originalStartup = await exec('reg.exe', ['query', startupKey, '/v', startupName]).then(r => r.stdout, () => null);
assert.equal(originalStartup, null, 'Use a separate test account or turn Tidy startup off before this suite. The existing startup entry was left untouched.');
const checks = [], notifications = [];
const exists = p => fs.access(p).then(() => true, () => false);
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
async function until(fn, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await fn()) return; await new Promise(r => setTimeout(r, 250)); }
  throw new Error('Timed out waiting for a native test condition.');
}
function pass(name) { checks.push(name); console.log('PASS ' + name); }
const categories = [{ id: 'documents', name: 'Documents', enabled: true, extensions: ['txt', 'pdf'], subfolders: false }];
const config = { sourcePath: source, destPath: dest, categories, filters: { dateModified: 'any', fileSize: 'any', excludeHidden: true }, conflictResolution: 'rename' };
let app, page, browser, server, lockProcess;
let startupTouched = false;
async function launch(extra = []) {
  app = await electron.launch({ executablePath, args: [`--user-data-dir=${profile}`, ...extra], env, timeout: 60000 });
  page = await app.firstWindow(); await page.locator('#main-content').waitFor();
  await app.evaluate(({ Notification }) => {
    globalThis.__nativeNotifications = [];
    const show = Notification.prototype.show;
    Notification.prototype.show = function (...args) {
      const entry = { title: this.title, shown: false, failed: false }; globalThis.__nativeNotifications.push(entry);
      this.on('show', () => { entry.shown = true; }); this.on('failed', () => { entry.failed = true; });
      return show.apply(this, args);
    };
  });
}
async function snapshotNotifications() {
  if (app) notifications.push(...await app.evaluate(() => globalThis.__nativeNotifications || []).catch(() => []));
}
try {
  await launch();
  const version = await app.evaluate(({ app }) => app.getVersion());
  assert.equal(version, JSON.parse(await fs.readFile('package.json', 'utf8')).version);
  // Observe real Tray/Notification objects while preserving every native call.
  await app.evaluate(({ Tray }) => {
    const tooltip = Tray.prototype.setToolTip, menu = Tray.prototype.setContextMenu;
    Tray.prototype.setToolTip = function (...args) { globalThis.__nativeTray = this; return tooltip.apply(this, args); };
    Tray.prototype.setContextMenu = function (...args) { globalThis.__nativeTrayMenu = args[0]; return menu.apply(this, args); };
  });
  assert.equal((await page.evaluate(() => window.electron.setBackgroundSettings({ keepRunningInTray: true, startWithWindows: false }))).success, true);
  const tray = await app.evaluate(() => ({ destroyed: globalThis.__nativeTray.isDestroyed(), bounds: globalThis.__nativeTray.getBounds(), labels: globalThis.__nativeTrayMenu.items.map(item => item.label) }));
  assert.equal(tray.destroyed, false); assert.ok(tray.bounds.width > 0); assert.ok(tray.labels.includes('Exit Tidy'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  assert.deepEqual(await app.evaluate(({ BrowserWindow }) => ({ count: BrowserWindow.getAllWindows().length, visible: BrowserWindow.getAllWindows()[0].isVisible() })), { count: 1, visible: false });
  const secondProcess = spawn(executablePath, [`--user-data-dir=${profile}`], { env, windowsHide: true, stdio: 'ignore' });
  assert.equal((await once(secondProcess, 'exit'))[0], 0);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await app.evaluate(() => globalThis.__nativeTrayMenu.items.find(item => item.label === 'Open Tidy').click());
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
  pass('Native tray created; X hides; real second launch and tray Open restore the single existing window');

  if (!originalStartup) {
    startupTouched = true;
    await page.evaluate(() => window.electron.setBackgroundSettings({ keepRunningInTray: true, startWithWindows: true }));
    let login = await app.evaluate(({ app }) => app.getLoginItemSettings({ path: process.execPath, args: ['--hidden'] }));
    assert.equal(login.openAtLogin, true); assert.equal(login.executableWillLaunchAtLogin, true);
    assert.ok(login.launchItems.some(item => item.name === 'com.ericauzenne.tidy'));
    assert.match((await exec('reg.exe', ['query', startupKey, '/v', startupName])).stdout, /--hidden/);
    await app.evaluate(({ app }) => app.setLoginItemSettings({ name: 'com.ericauzenne.tidy', path: process.execPath, args: ['--hidden'], openAtLogin: true, enabled: false }));
    assert.equal((await page.evaluate(() => window.electron.getBackgroundSettings())).startWithWindows, false);
    await page.evaluate(() => window.electron.setBackgroundSettings({ keepRunningInTray: true, startWithWindows: true }));
    login = await app.evaluate(({ app }) => app.getLoginItemSettings({ path: process.execPath, args: ['--hidden'] }));
    assert.equal(login.executableWillLaunchAtLogin, true, 'User must be able to re-enable an OS-disabled startup entry');
    await snapshotNotifications(); await app.close(); app = null;
    await launch(['--hidden']);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    await page.evaluate(() => window.electron.setBackgroundSettings({ keepRunningInTray: true, startWithWindows: false }));
    assert.equal((await app.evaluate(({ app }) => app.getLoginItemSettings({ path: process.execPath, args: ['--hidden'] }))).openAtLogin, false);
    pass('Real startup registration, OS-disabled status, re-enable, hidden process launch and removal');
  } else { checks.push('SKIPPED startup mutations: an existing user startup entry was preserved'); }

  await page.evaluate(config => { localStorage.setItem('tidy_source_path', config.sourcePath); localStorage.setItem('tidy_dest_path', config.destPath); localStorage.setItem('tidy_categories', JSON.stringify(config.categories)); }, config);
  await page.reload(); await page.locator('#main-content').waitFor();
  const when = new Date(Date.now() + 65000), time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  await fs.writeFile(path.join(source, 'scheduled.txt'), 'Scheduled native fixture');
  assert.equal((await page.evaluate(config => window.electron.saveSchedule(config), { ...config, schedule: { enabled: true, frequency: 'daily', time, date: null } })).success, true);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await until(() => exists(path.join(dest, 'Documents', 'scheduled.txt')), 130000);
  const scheduled = (await page.evaluate(() => window.electron.listRunHistory())).find(run => run.kind === 'scheduled');
  assert.ok(scheduled); assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  assert.equal((await page.evaluate(id => window.electron.undoRun(id), scheduled.id)).success, true);
  assert.equal(await fs.readFile(path.join(source, 'scheduled.txt'), 'utf8'), 'Scheduled native fixture');
  await page.evaluate(config => window.electron.saveSchedule(config), { ...config, schedule: { enabled: false, frequency: 'manual', time, date: null } });
  pass('Actual timed scheduled run while window hidden, scheduled history and exact Undo');

  assert.equal((await page.evaluate(config => window.electron.saveWatch(config, true), config)).watching, true);
  const payload = Buffer.alloc(8 * 1024 * 1024, 65); const expectedHash = hash(payload);
  server = http.createServer(async (request, response) => {
    if (request.url !== '/download') { response.end('<a href="/download">Download synthetic PDF</a>'); return; }
    response.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Browser fixture.pdf"', 'Content-Length': payload.length });
    response.write(payload.subarray(0, 1024 * 1024)); await new Promise(r => setTimeout(r, 9000)); response.end(payload.subarray(1024 * 1024));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: false });
  const context = await browser.newContext({ acceptDownloads: true });
  const downloadPage = await context.newPage();
  const cdp = await context.newCDPSession(downloadPage);
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: source });
  await downloadPage.goto(`http://127.0.0.1:${server.address().port}/`);
  await downloadPage.getByRole('link', { name: 'Download synthetic PDF' }).click();
  await until(async () => (await fs.readdir(source)).some(name => name.endsWith('.crdownload')));
  await new Promise(r => setTimeout(r, 6500));
  assert.equal(await exists(path.join(dest, 'Documents', 'Browser fixture.pdf')), false, 'Partial download must stay put past the settling delay');
  await until(() => exists(path.join(dest, 'Documents', 'Browser fixture.pdf')), 30000);
  assert.equal(hash(await fs.readFile(path.join(dest, 'Documents', 'Browser fixture.pdf'))), expectedHash);
  await browser.close(); browser = null; await new Promise(resolve => server.close(resolve)); server = null;
  const watched = (await page.evaluate(() => window.electron.listRunHistory())).find(run => run.kind === 'watch'); assert.ok(watched);
  assert.equal((await page.evaluate(id => window.electron.undoRun(id), watched.id)).success, true);
  assert.equal(hash(await fs.readFile(path.join(source, 'Browser fixture.pdf'))), expectedHash);
  await new Promise(r => setTimeout(r, 7500)); assert.equal(await exists(path.join(source, 'Browser fixture.pdf')), true);
  await page.evaluate(config => window.electron.saveWatch(config, false), config);
  pass('Real visible Edge download: 8 MB, paused partial ignored, final bytes filed once, watched Undo stays restored');

  const lockFile = path.join(source, 'locked.txt'); await fs.writeFile(lockFile, 'Locked native fixture');
  const holdFile = '$stream=[System.IO.File]::Open($env:TIDY_TEST_PATH,[System.IO.FileMode]::Open,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None); try { [Console]::WriteLine("READY"); [Console]::ReadLine() | Out-Null } finally { $stream.Dispose() }';
  lockProcess = spawn('powershell.exe', ['-NoProfile', '-Command', holdFile], { windowsHide: true, env: { ...process.env, TIDY_TEST_PATH: lockFile }, stdio: ['pipe', 'pipe', 'pipe'] });
  await once(lockProcess.stdout, 'data');
  const locked = await page.evaluate(config => window.electron.organizeFiles(config), { ...config, onlyPaths: [lockFile] });
  assert.equal(locked.moved, 0); assert.equal(locked.errors, 1); assert.equal(await exists(lockFile), true);
  const unlocked = once(lockProcess, 'exit'); lockProcess.stdin.end('\n'); await unlocked; lockProcess = null;
  const retry = await page.evaluate(config => window.electron.organizeFiles(config), { ...config, onlyPaths: [lockFile] }); assert.equal(retry.moved, 1);
  assert.equal((await page.evaluate(id => window.electron.undoRun(id), retry.runId)).success, true);
  assert.equal(await fs.readFile(lockFile, 'utf8'), 'Locked native fixture');
  pass('Real Windows exclusive file lock preserves source; unlocked retry and Undo work');

  const crossSource = await fs.mkdtemp(path.join(os.tmpdir(), 'tidy-native-'));
  const crossInput = path.join(crossSource, 'cross-volume.txt'); await fs.writeFile(crossInput, 'Cross-volume native fixture');
  const cross = { ...config, sourcePath: crossSource, destPath: path.join(root, 'Cross-volume') };
  const moved = await page.evaluate(config => window.electron.organizeFiles(config), cross); assert.equal(moved.moved, 1);
  assert.equal((await page.evaluate(id => window.electron.undoRun(id), moved.runId)).success, true);
  assert.equal(await fs.readFile(crossInput, 'utf8'), 'Cross-volume native fixture');
  pass('Actual C: to F: move and Undo preserve contents');

  const replaceSource = path.join(root, 'Replace-source'), replaceDest = path.join(root, 'Replace-dest');
  await fs.mkdir(replaceSource); await fs.mkdir(path.join(replaceDest, 'Documents'), { recursive: true });
  await fs.writeFile(path.join(replaceSource, 'replace.txt'), 'NEW VERSION'); await fs.writeFile(path.join(replaceDest, 'Documents', 'replace.txt'), 'OLD VERSION');
  const replace = await page.evaluate(config => window.electron.organizeFiles(config), { ...config, sourcePath: replaceSource, destPath: replaceDest, conflictResolution: 'overwrite' }); assert.equal(replace.moved, 1);
  assert.equal((await page.evaluate(dest => window.electron.getBackupStatus([dest]), replaceDest)).files, 1);
  assert.equal((await page.evaluate(dest => window.electron.cleanUpBackups([dest]), replaceDest)).success, true);
  assert.equal(await exists(path.join(replaceDest, '.Tidy Undo')), false);
  assert.equal((await page.evaluate(id => window.electron.undoRun(id), replace.runId)).success, true);
  assert.equal(await fs.readFile(path.join(replaceSource, 'replace.txt'), 'utf8'), 'NEW VERSION');
  pass('Real Windows shell.trashItem completes; backup disappears and remaining Undo preserves the new file');

  await snapshotNotifications();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
  await page.screenshot({ path: path.join(root, 'native-app.png') });
  await app.close(); app = null;
  await launch();
  // Recreate the tray after installing observers in this process.
  await app.evaluate(({ Tray }) => {
    const menu = Tray.prototype.setContextMenu;
    Tray.prototype.setContextMenu = function (...args) { globalThis.__nativeTrayMenu = args[0]; return menu.apply(this, args); };
  });
  await page.evaluate(() => window.electron.setBackgroundSettings({ keepRunningInTray: false, startWithWindows: false }));
  await page.evaluate(() => window.electron.setBackgroundSettings({ keepRunningInTray: true, startWithWindows: false }));
  const quit = app.waitForEvent('close');
  await app.evaluate(() => { setTimeout(() => globalThis.__nativeTrayMenu.items.find(item => item.label === 'Exit Tidy').click(), 50); }); await quit; app = null;
  pass('Native tray Exit really quits with background enabled');
  await launch();
  await page.evaluate(() => window.electron.setBackgroundSettings({ keepRunningInTray: false, startWithWindows: false }));
  const closed = app.waitForEvent('close'); await app.evaluate(({ BrowserWindow }) => { setTimeout(() => BrowserWindow.getAllWindows()[0].close(), 50); }); await closed; app = null;
  pass('With background off, native window close really exits');
  await fs.writeFile(path.join(root, 'results.json'), JSON.stringify({ passed: true, executablePath, version, checks, notifications, pending: ['Actual sign-out/sign-in', 'OneDrive and SMB environments'] }, null, 2));
  console.log('RESULT ' + path.join(root, 'results.json'));
} catch (error) {
  await snapshotNotifications();
  await fs.writeFile(path.join(root, 'results.json'), JSON.stringify({ passed: false, checks, notifications, error: error.message, stack: error.stack }, null, 2));
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.closeAllConnections?.(); if (server) server.close();
  lockProcess?.stdin.end();
  if (app) {
    if (startupTouched) await page.evaluate(() => window.electron.setBackgroundSettings({ keepRunningInTray: false, startWithWindows: false })).catch(() => {});
    await app.close().catch(() => {});
  }
  if (startupTouched && !originalStartup) await exec('reg.exe', ['delete', startupKey, '/v', startupName, '/f']).catch(() => {});
}
