/** Review files Git would publish without printing credential values. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
const patterns = [
  /AIza[0-9A-Za-z_-]{30,}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:GEMINI_API_KEY|GOOGLE_API_KEY)\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/,
];
const privatePath = /(^|\/)(?:\.env(?:\..+)?|gemini-key\.bin(?:\.tmp)?|node_modules|release|dist|dist-electron|build|\.test-artifacts|_to_delete)(\/|$)|\.(?:pem|key|pfx|p12|exe|zip|blockmap)$/i;
const binary = /\.(?:png|jpe?g|gif|ico|woff2?|pdf)$/i;
const findings = [];
function inspect(buffer, label, filename) {
  if (binary.test(filename) || buffer.includes(0)) return;
  const contents = buffer.toString('utf8');
  if (patterns.some(pattern => pattern.test(contents))) findings.push(`${label}: possible credential`);
}

const candidates = new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString().split('\0').filter(Boolean));
for (const filename of candidates) {
  if (!fs.existsSync(filename)) continue; // Deleted tracked files are not published.
  if (filename !== '.env.example' && privatePath.test(filename)) findings.push(`${filename}: private or generated file`);
  if (fs.statSync(filename).isFile()) inspect(fs.readFileSync(filename), filename, filename);
}

if (process.argv.includes('--build')) {
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(filename);
      else inspect(fs.readFileSync(filename), filename, filename);
    }
  }
  for (const folder of ['dist', 'dist-electron']) walk(folder);
}

if (process.argv.includes('--history')) {
  const objects = git('rev-list', '--objects', '--all').toString().trim().split('\n');
  let blobs = 0;
  for (const object of objects) {
    const [id, ...parts] = object.split(' ');
    const filename = parts.join(' ');
    if (!filename || binary.test(filename) || git('cat-file', '-t', id).toString().trim() !== 'blob') continue;
    inspect(git('cat-file', 'blob', id), `history ${id.slice(0, 7)} (${filename})`, filename);
    if (filename !== '.env.example' && /(^|\/)\.env(?:\..+)?$|gemini-key\.bin/.test(filename)) findings.push(`history ${id.slice(0, 7)}: credential file`);
    blobs++;
  }
  console.log(`Reviewed ${blobs} historical text blobs.`);
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS publication check (${candidates.size} candidate paths). No recognized credentials or private build/profile files found.`);
}
// Pattern matching is a guardrail; review unknown document and image contents too.
