import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const index = process.argv.indexOf('--project');
const directory = index >= 0 ? process.argv[index + 1] : '';
if (!/^apps\/premium\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directory))
  throw new Error('Use --project apps/premium/<project-key>.');
const project = JSON.parse(
  readFileSync(resolve(directory, 'eixu.project.json'), 'utf8'),
);
const assets = new Set();
for (const file of globSync(`${directory}/**/*.{css,json,md,ts,tsx}`, {
  exclude: (entry) =>
    entry.fullpath().includes('/.next/') ||
    entry.fullpath().includes('/node_modules/'),
})) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/https:\/\/[^\s"'<>)}\]]+/g))
    assets.add(match[0].replace(/[.,;:]$/, ''));
}
process.stdout.write(
  `${JSON.stringify(
    {
      version: 1,
      project,
      assets: [...assets].sort((left, right) => left.localeCompare(right)),
    },
    null,
    2,
  )}\n`,
);
