import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { premiumEditorContract } from './editor-contract.mjs';

const index = process.argv.indexOf('--project');
const directory = index >= 0 ? process.argv[index + 1] : '';
if (!/^apps\/premium\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directory))
  throw new Error('Use --project apps/premium/<project-key>.');
const root = resolve(directory);
const snapshot = JSON.parse(
  readFileSync(resolve(root, 'content/site.json'), 'utf8'),
);
const contract = premiumEditorContract(snapshot);
writeFileSync(
  resolve(root, 'content/editor.json'),
  `${JSON.stringify(contract, null, 2)}\n`,
);
process.stdout.write(
  `${contract.pages.length} página(s) e ${contract.pages.flatMap((page) => page.sections).length} seção(ões) editoriais geradas.\n`,
);
