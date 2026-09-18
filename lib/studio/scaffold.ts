// Checkpoints antigos são imutáveis: continue aceitando somente a configuração
// exata que a plataforma gerava antes de habilitar imagens remotas.
export const STUDIO_LEGACY_NEXT_CONFIG = `import type { NextConfig } from 'next';\n\nconst config: NextConfig = {\n  output: 'standalone',\n};\n\nexport default config;\n`;

export const STUDIO_SCAFFOLD_FILES: ReadonlyArray<{
  path: string;
  content: string;
}> = [
  {
    path: 'package.json',
    content: `${JSON.stringify(
      {
        name: 'eixu-client-site',
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          typecheck: 'next typegen && tsc --noEmit',
        },
        dependencies: {
          next: '16.3.3',
          react: '19.2.6',
          'react-dom': '19.2.6',
        },
        devDependencies: {
          '@types/node': '22.19.19',
          '@types/react': '19.2.14',
          '@types/react-dom': '19.2.3',
          typescript: '5.9.3',
        },
      },
      null,
      2,
    )}\n`,
  },
  {
    path: 'tsconfig.json',
    content: `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: false,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'react-jsx',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./*'] },
        },
        include: [
          'next-env.d.ts',
          '.next/types/**/*.ts',
          '.next/dev/types/**/*.ts',
          '**/*.ts',
          '**/*.tsx',
        ],
        exclude: ['node_modules'],
      },
      null,
      2,
    )}\n`,
  },
  {
    path: 'next.config.ts',
    content: `import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [{
      protocol: 'https',
      hostname: '*.public.blob.vercel-storage.com',
      port: '',
      pathname: '/tenants/__EIXU_TENANT__/**',
      search: '',
    }],
    maximumRedirects: 0,
  },
};

export default config;
`,
  },
  {
    path: '.gitignore',
    content: `.next/\nnode_modules/\n.vercel/\n.env*\nnext-env.d.ts\n*.tsbuildinfo\n`,
  },
  {
    path: 'app/layout.tsx',
    content: `import type { Metadata } from 'next';\nimport './globals.css';\n\nexport const metadata: Metadata = {\n  title: 'Projeto em criação',\n  robots: { index: false, follow: false },\n};\n\nexport default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {\n  return (\n    <html lang="pt-BR">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
  },
  {
    path: 'app/page.tsx',
    content: `export default function ProjectInProgress() {\n  return (\n    <main className="project-status">\n      <p>EIXU</p>\n      <h1>Projeto em criação</h1>\n    </main>\n  );\n}\n`,
  },
  {
    path: 'app/globals.css',
    content: `* { box-sizing: border-box; }\nhtml { background: #f4f1ea; color: #171714; }\nbody { margin: 0; font-family: Arial, sans-serif; }\n.project-status { min-height: 100svh; display: grid; place-content: center; padding: 2rem; }\n.project-status p { margin: 0 0 1rem; letter-spacing: .16em; font-size: .75rem; }\n.project-status h1 { margin: 0; font-size: clamp(2.5rem, 9vw, 8rem); letter-spacing: -.06em; }\n`,
  },
  {
    path: 'content/schema.json',
    content: `${JSON.stringify(
      {
        version: 1,
        pages: [
          {
            slug: '',
            label: 'Início',
            sections: [
              {
                id: 'status',
                label: 'Status',
                fields: [
                  {
                    key: 'status.title',
                    label: 'Título',
                    type: 'text',
                    value: 'Projeto em criação',
                    required: true,
                    maxLength: 120,
                  },
                ],
              },
            ],
          },
        ],
      },
      null,
      2,
    )}\n`,
  },
  {
    path: 'content/values.json',
    content: `${JSON.stringify(
      { 'status.title': 'Projeto em criação' },
      null,
      2,
    )}\n`,
  },
  {
    path: 'project.json',
    content: `${JSON.stringify(
      {
        version: 1,
        platform: 'eixu-studio',
        tenant: '__EIXU_TENANT__',
        canonicalHost: '__EIXU_TENANT__.eixu.com.br',
        contentContract: 1,
      },
      null,
      2,
    )}\n`,
  },
  {
    path: 'proxy.ts',
    content: `import { NextResponse, type NextRequest } from 'next/server';

const COOKIE = '__eixu_preview';
const QUERY = '__eixu_preview';

export function proxy(request: NextRequest) {
  const secret = process.env.EIXU_PREVIEW_TOKEN;
  if (!secret) return NextResponse.next();
  const query = request.nextUrl.searchParams.get(QUERY);
  const cookie = request.cookies.get(COOKIE)?.value;
  if (query !== secret && cookie !== secret)
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' },
    });
  const cleanUrl = request.nextUrl.clone();
  cleanUrl.searchParams.delete(QUERY);
  const response = query === secret
    ? NextResponse.redirect(cleanUrl)
    : NextResponse.next();
  response.headers.set('x-eixu-preview-gate', 'authorized');
  response.headers.set('x-robots-tag', 'noindex');
  response.headers.set('referrer-policy', 'no-referrer');
  response.headers.set(
    'content-security-policy',
    "frame-ancestors 'self' https://eixu.com.br https://*.eixu.com.br http://localhost:*",
  );
  if (query === secret)
    response.cookies.set({
      name: COOKIE,
      value: secret,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
      maxAge: 45 * 60,
    });
  return response;
}

export const config = { matcher: '/:path*' };
`,
  },
  {
    path: 'lib/eixu.ts',
    content: `export const EIXU_TENANT = '__EIXU_TENANT__';
export const EIXU_PLATFORM = 'https://eixu.com.br';

export const eixuFormAction = \`${'${EIXU_PLATFORM}'}/api/form\`;

export function eixuWhatsappHref(input: { from?: string; campaign?: string } = {}) {
  const url = new URL('/go/wa', EIXU_PLATFORM);
  url.searchParams.set('t', EIXU_TENANT);
  if (input.from) url.searchParams.set('from', input.from);
  if (input.campaign) url.searchParams.set('utm_campaign', input.campaign);
  return url.toString();
}

export async function trackEixuEvent(input: {
  type: 'page_view' | 'whatsapp_click' | 'phone_click' | 'booking';
  path?: string;
  session?: string;
  source?: Record<string, unknown>;
}) {
  await fetch(\`${'${EIXU_PLATFORM}'}/api/e?tenant=${'${encodeURIComponent(EIXU_TENANT)}'}\`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenant: EIXU_TENANT, ...input }),
    keepalive: true,
    credentials: 'omit',
  });
}
`,
  },
  {
    path: 'README.md',
    content: `# Projeto EIXU

Site Next.js independente, publicado no projeto Vercel deste cliente.

- \`project.json\` vincula o artefato ao tenant e ao domínio canônico.
- \`content/schema.json\` e \`content/values.json\` formam o contrato do CMS.
- \`lib/eixu.ts\` integra formulários, eventos e WhatsApp à plataforma central.
- Formulários devem enviar os campos ocultos \`tenant\`, \`page\` e \`redirect\` para \`eixuFormAction\`.
- Não armazene segredos no projeto e não altere o tenant ou o host canônico.
`,
  },
];

export const STUDIO_PROTECTED_FILES = [
  'package.json',
  'project.json',
  'proxy.ts',
  'lib/eixu.ts',
  'tsconfig.json',
  'next.config.ts',
  '.gitignore',
] as const;

export function studioScaffoldContent(
  path: string,
  slug: string,
): string | null {
  const file = STUDIO_SCAFFOLD_FILES.find(
    (candidate) => candidate.path === path,
  );
  return file ? file.content.replaceAll('__EIXU_TENANT__', slug) : null;
}

export function isStudioProtectedFileContent(
  path: string,
  content: string | null,
  slug: string,
): boolean {
  const expected = studioScaffoldContent(path, slug);
  return (
    (expected !== null && content === expected) ||
    (path === 'next.config.ts' && content === STUDIO_LEGACY_NEXT_CONFIG)
  );
}
