import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE = join(ROOT, 'scripts/premium/template');
const VERSION = '1';
const IMPORT = /(?:from\s+|^\s*import\s*)['"]([^'"]+)['"]/gm;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function hash(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function resolveImport(from, specifier) {
  const base = specifier.startsWith('@/')
    ? join(ROOT, specifier.slice(2))
    : resolve(dirname(from), specifier);
  for (const suffix of [
    '',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '/index.ts',
    '/index.tsx',
  ]) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Fecha as dependências locais do renderer que estava em produção. */
function runtimeClosure(entries) {
  const files = new Set();
  const visit = (relativePath) => {
    const file = resolve(ROOT, relativePath);
    if (files.has(file)) return;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT)) {
      const specifier = match[1];
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
      const dependency = resolveImport(file, specifier);
      if (!dependency)
        throw new Error(
          `Import local não resolvido em ${relative(ROOT, file)}: ${specifier}`,
        );
      visit(relative(ROOT, dependency));
    }
  };
  entries.forEach(visit);
  return [...files].sort((left, right) => left.localeCompare(right));
}

function put(target, content) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`);
}

function copyFrozenRuntime(target) {
  const entries = [
    'lib/blocks/render.tsx',
    'lib/blocks/theme.ts',
    'lib/images/logo-schema.ts',
    'lib/sites/logo-metadata.ts',
    'lib/sites/structured-data.ts',
    'lib/tracking.ts',
  ];
  for (const source of runtimeClosure(entries)) {
    const destination = join(target, relative(ROOT, source));
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
  for (const name of [
    'site.css',
    'creative.css',
    'primitives.css',
    'vibes.css',
    'typography.css',
    'iconography.css',
    'navigation.css',
    'operator.css',
  ])
    cpSync(join(ROOT, 'app/(sites)', name), join(target, 'app', name));
  cpSync(join(ROOT, 'app/(sites)/layout.tsx'), join(target, 'app/layout.tsx'));
}

function packageJson(key) {
  return JSON.stringify(
    {
      name: `@eixu/premium-${key}`,
      version: '1.0.0',
      private: true,
      engines: { node: '>=22.13.0' },
      scripts: {
        dev: 'next dev',
        build: 'next build',
        lint: 'oxlint',
        typecheck: 'next typegen && tsc --noEmit',
      },
      dependencies: {
        '@phosphor-icons/react': '^2.1.10',
        'embla-carousel': '8.5.2',
        'framer-motion': '^13.2.0',
        next: '16.3.3',
        react: '19.2.6',
        'react-dom': '19.2.6',
        zod: '^4.6.0',
      },
      devDependencies: {
        '@tailwindcss/postcss': '4.2.1',
        '@types/node': '22.19.19',
        '@types/react': '19.2.14',
        '@types/react-dom': '19.2.3',
        oxlint: '1.76.0',
        tailwindcss: '4.2.1',
        typescript: '5.9.3',
      },
      type: 'module',
    },
    null,
    2,
  );
}

function writeProject(job, target) {
  cpSync(TEMPLATE, target, { recursive: true });
  copyFrozenRuntime(target);
  put(join(target, 'package.json'), packageJson(job.projectKey));
  put(join(target, 'content/site.json'), JSON.stringify(job.snapshot, null, 2));
  put(
    join(target, 'eixu.project.json'),
    JSON.stringify(
      {
        version: 1,
        tenantId: job.snapshot.tenant.id,
        projectKey: job.projectKey,
        canonicalHost: job.canonicalHost,
        conversionId: job.id,
        sourceHash: job.sourceHash,
        sourceCommit: job.sourceCommit,
        converterVersion: job.converterVersion,
        platformUrl: 'https://eixu.com.br',
        assets: job.snapshot.assets,
      },
      null,
      2,
    ),
  );
  put(
    join(target, 'AGENTS.md'),
    `# Projeto Premium ${job.projectKey}\n\nEste app pertence à EIXU e atende https://${job.canonicalHost}. Edite e valide dentro desta pasta. O gerador não mantém mais a implementação.\n\n- npm run typecheck\n- npm run lint\n- npm run build\n\nMantenha EIXU_PREMIUM_TOKEN apenas no ambiente da Vercel. Leads, eventos e WhatsApp passam pelas rotas server-side locais para a plataforma central.`,
  );
  put(
    join(target, 'README.md'),
    `# ${job.snapshot.tenant.name}\n\nProjeto Premium da EIXU convertido do snapshot publicado ${job.sourceHash}. A URL canônica permanece https://${job.canonicalHost}.`,
  );
}

const input = argument('--input');
if (!input) throw new Error('Use --input <job.json>.');
const outputRoot = resolve(argument('--output-root') ?? ROOT);
const job = JSON.parse(readFileSync(resolve(input), 'utf8'));
if (job.converterVersion !== VERSION)
  throw new Error(`Versão do conversor incompatível: ${job.converterVersion}.`);
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(job.projectKey))
  throw new Error('projectKey inválida.');
if (job.directory !== `apps/premium/${job.projectKey}`)
  throw new Error('Diretório do job não corresponde à projectKey.');
if (job.canonicalHost !== `${job.snapshot.tenant.slug}.eixu.com.br`)
  throw new Error('Host canônico não corresponde ao tenant.');
if (hash(job.snapshot) !== job.sourceHash)
  throw new Error('Hash do snapshot não confere.');
const target = resolve(outputRoot, job.directory);
if (!target.startsWith(join(outputRoot, 'apps/premium/')))
  throw new Error('Diretório fora de apps/premium.');
if (existsSync(target)) {
  const receipt = join(target, 'eixu.project.json');
  if (!existsSync(receipt))
    throw new Error('A pasta existe e não é um projeto gerado pela EIXU.');
  const current = JSON.parse(readFileSync(receipt, 'utf8'));
  if (current.conversionId !== job.id || current.sourceHash !== job.sourceHash)
    throw new Error('A pasta já pertence a outra conversão.');
  rmSync(target, { recursive: true, force: true });
}
mkdirSync(target, { recursive: true });
writeProject(job, target);
process.stdout.write(`${relative(outputRoot, target)}\n`);
