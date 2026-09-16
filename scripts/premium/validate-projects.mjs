import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const manifests = globSync('apps/premium/*/eixu.project.json');
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
  ])
    if (!existsSync(resolve(root, required)))
      throw new Error(`${manifestPath}: ausente ${required}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.projectKey))
    throw new Error(`${manifestPath}: projectKey inválida`);
  if (manifest.canonicalHost !== `${manifest.projectKey}.eixu.com.br`)
    throw new Error(`${manifestPath}: host canônico divergente`);
}
process.stdout.write(`${manifests.length} projeto(s) Premium válido(s).\n`);
