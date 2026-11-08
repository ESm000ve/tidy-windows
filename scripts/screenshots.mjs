/** Capture the working desktop app with disposable files and no API requests. */
import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const artifacts = path.resolve('.test-artifacts');
await fs.mkdir(artifacts, { recursive: true });
const root = await fs.mkdtemp(path.join(artifacts, 'portfolio-'));
const source = path.join(root, 'Downloads');
const destination = path.join(root, 'Organized');
const output = path.resolve('docs/screenshots');
await Promise.all([source, destination, output].map(folder => fs.mkdir(folder, { recursive: true })));
for (const name of ['Project brief.txt', 'Research notes.md', 'Reading list.epub', 'Workshop agenda.txt', 'Design checklist.md']) {
  await fs.writeFile(path.join(source, name), `Synthetic portfolio sample: ${name}\nNo personal information.\n`);
}
const env = { ...process.env, GEMINI_API_KEY: '' };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.', `--user-data-dir=${path.join(root, 'profile')}`], env, timeout: 60000 });
try {
  const page = await app.firstWindow();
  await page.locator('#main-content').waitFor();
  await app.evaluate(({ BrowserWindow, nativeTheme }) => {
    nativeTheme.themeSource = 'light';
    BrowserWindow.getAllWindows()[0].setSize(1440, 1280);
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await page.evaluate(() => window.electron.getApiKeyStatus())).configured, false);
  await page.evaluate(({ source, destination }) => {
    localStorage.setItem('tidy_source_path', source);
    localStorage.setItem('tidy_dest_path', destination);
    localStorage.setItem('tidy_theme', 'light');
    localStorage.setItem('theme', 'light');
  }, { source, destination });
  await page.reload();
  await page.locator('#main-content').waitFor();

  async function capture(filename) {
    await page.waitForTimeout(500);
    // Only visible labels are changed; all operations use real fixture paths.
    await page.evaluate(({ root }) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) if (walker.currentNode.textContent.includes(root)) nodes.push(walker.currentNode);
      for (const node of nodes) node.textContent = node.textContent.split(root).join('Demo folders');
    }, { root });
    await page.screenshot({
      path: path.join(output, filename),
      animations: 'disabled',
    });
  }
  await capture('home-light.png');

  await page.getByRole('button', { name: 'Run Tidy', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Preview Changes', exact: true });
  await preview.waitFor();
  await capture('preview.png');
  await page.getByRole('button', { name: 'Confirm & Run', exact: true }).click();
  await page.getByRole('heading', { name: 'Tidy Complete!', exact: true }).waitFor();
  const organized = await page.evaluate(() => JSON.parse(localStorage.getItem('tidy_metrics')));
  assert.equal(organized.moved, 5);
  await page.getByRole('button', { name: 'Undo Changes', exact: true }).click();
  await page.getByRole('heading', { name: 'Undo Complete', exact: true }).waitFor();
  assert.equal((await fs.readdir(source)).length, 5);
  await page.evaluate(() => localStorage.removeItem('tidy_metrics'));
  await page.reload();

  await page.keyboard.press('Control+,');
  await page.getByRole('dialog').waitFor();
  await capture('settings.png');
  await page.getByRole('button', { name: /Theme selector/ }).click();
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await capture('home-dark.png');
  console.log('PASS captured four desktop screenshots; real preview, move and Undo verified using five synthetic files. No API key or network calls.');
} finally {
  await app.close();
}
