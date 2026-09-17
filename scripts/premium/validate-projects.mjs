import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEditorContract } from './editor-contract.mjs';

const projectIndex = process.argv.indexOf('--project');
const project = projectIndex >= 0 ? process.argv[projectIndex + 1] : '';
if (project && !/^apps\/premium\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project))
  throw new Error('Use --project apps/premium/<project-key>.');
const manifests = project
  ? [resolve(project, 'eixu.project.json')]
  : globSync('apps/premium/*/eixu.project.json');
for (const manifestPath of manifests) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const root = resolve(dirname(manifestPath));
  for (const required of [
    'package.json',
    'app/layout.tsx',
    'app/[[...slug]]/page.tsx',
    'app/robots.txt/route.ts',
    'app/sitemap.xml/route.ts',
    'content/site.json',
    'content/editor.json',
  ])
    if (!existsSync(resolve(root, required)))
      throw new Error(`${manifestPath}: ausente ${required}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.projectKey))
    throw new Error(`${manifestPath}: projectKey inválida`);
  if (manifest.canonicalHost !== `${manifest.projectKey}.eixu.com.br`)
    throw new Error(`${manifestPath}: host canônico divergente`);
  assertEditorContract(
    JSON.parse(readFileSync(resolve(root, 'content/editor.json'), 'utf8')),
  );
}
process.stdout.write(`${manifests.length} projeto(s) Premium válido(s).\n`);
