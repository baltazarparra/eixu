import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { assertEditorContract } from './editor-contract.mjs';

const INCLUDED_EXTENSIONS = new Set(['.css', '.json', '.md', '.ts', '.tsx']);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.vercel',
  'node_modules',
]);

function sourceFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name))
          visit(join(directory, entry.name));
        continue;
      }
      if (entry.isFile() && INCLUDED_EXTENSIONS.has(extname(entry.name)))
        files.push(join(directory, entry.name));
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

const index = process.argv.indexOf('--project');
const directory = index >= 0 ? process.argv[index + 1] : '';
if (!/^apps\/premium\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directory))
  throw new Error('Use --project apps/premium/<project-key>.');
const project = JSON.parse(
  readFileSync(resolve(directory, 'eixu.project.json'), 'utf8'),
);
const editor = assertEditorContract(
  JSON.parse(readFileSync(resolve(directory, 'content/editor.json'), 'utf8')),
);
const assets = new Set();
for (const file of sourceFiles(resolve(directory))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/https:\/\/[^\s"'<>)}\]]+/g))
    assets.add(match[0].replace(/[.,;:]$/, ''));
}
process.stdout.write(
  `${JSON.stringify(
    {
      version: 1,
      project,
      editor,
      assets: [...assets].sort((left, right) => left.localeCompare(right)),
    },
    null,
    2,
  )}\n`,
);
