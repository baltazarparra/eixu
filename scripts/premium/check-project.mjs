import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const key = process.argv[2] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))
  throw new Error('Use npm run premium:check -- <project-key>.');

const directory = `apps/premium/${key}`;
const manifestPath = resolve(directory, 'eixu.project.json');
if (!existsSync(manifestPath))
  throw new Error(`Projeto Premium ausente: ${directory}.`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.projectKey !== key)
  throw new Error('A chave pedida não corresponde ao manifesto do projeto.');

const workspace = `@eixu/premium-${key}`;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const script of ['typecheck', 'lint', 'build'])
  execFileSync(npm, ['run', script, '--workspace', workspace], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
execFileSync(
  process.execPath,
  ['scripts/premium/validate-projects.mjs', '--project', directory],
  { cwd: process.cwd(), stdio: 'inherit' },
);
