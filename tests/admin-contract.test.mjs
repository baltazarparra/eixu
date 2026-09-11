import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
import { convertToModelMessages } from 'ai';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { hasDraftChanges, workspaceState } = await j.import(
  '../lib/admin/state.ts',
);
const { economicalMessages, chatRequestSchema } = await j.import(
  '../lib/ai/context.ts',
);
const { usageMetadata, sumGatewayCosts } = await j.import('../lib/ai/usage.ts');
const { structuredData } = await j.import('../lib/sites/structured-data.ts');
const { csvCell } = await j.import('../lib/admin/csv.ts');
const { previewHref, previewProps } = await j.import('../lib/sites/preview.ts');
const { canApplyLogo } = await j.import('../lib/images/logo-access.ts');
const { tenantFromHost } = await j.import('../lib/tenant-host.ts');
const {
  tenantSlugSchema,
  tenantDetailsSchema,
  brandColorsSchema,
  contactsFromForm,
} = await j.import('../lib/admin/tenant-input.ts');
const {
  contactsSchema,
  contactsOf,
  primaryWhatsapp,
  whatsappAt,
  derivedSocialUrl,
  formatPhone,
  phoneE164,
  socialNetwork,
  contactsSummary,
} = await j.import('../lib/tenant-contacts.ts');
const { vibeSchema, vibeOf, laneIssues } = await j.import(
  '../lib/design/vibes.ts',
);
const { themeVars } = await j.import('../lib/blocks/theme.ts');
const { confirmationAccepted, deletionImpact, requiresSlugConfirmation } =
  await j.import('../lib/admin/tenant-delete.ts');
const { deleteTenantBlobs, tenantBlobPrefix } = await j.import(
  '../lib/blob/tenant-files.ts',
);
const { defaultPeriod, periodSchema, spendSchema, mergeCampaigns } =
  await j.import('../lib/admin/traffic.ts');
const { attributionScript } = await j.import('../lib/tracking.ts');
const { createSessionToken, verifySessionToken } =
  await j.import('../lib/auth.ts');

const tenant = {
  id: 'fixture',
  slug: 'atelier-teste',
  name: 'Atelier de teste',
  brand: {},
  brief: {},
  dials: { variance: 5, density: 5, motion: 2 },
  imageGuide: {},
  whatsapp: null,
};
const page = {
  id: 'p1',
  tenantId: 'fixture',
  slug: '',
  title: 'Início',
  type: 'page',
  seo: { title: 'Início', description: 'Descrição' },
  publishedSeo: { description: 'Descrição', title: 'Início' },
  blocks: [],
  publishedBlocks: [],
  publishedAt: '2026-09-10T12:00:00Z',
  meta: {},
};

await test('mudança só de SEO fica pendente; ordem das chaves não cria alteração', () => {
  assert.equal(hasDraftChanges(page), false);
  assert.equal(
    hasDraftChanges({
      ...page,
      seo: { ...page.seo, description: 'Descrição nova' },
    }),
    true,
  );
  assert.equal(hasDraftChanges({ ...page, publishedBlocks: null }), true);
});
await test('estado inicial e refresh incluem pendências do projeto mesmo sem páginas', () => {
  const state = workspaceState(tenant, [], []);
  assert.ok(state.errors.length > 0);
  assert.equal(state.generation.next, 'briefing');
  assert.deepEqual(state.pages, []);
});

await test('compacta dados repetidos e mantém todas as instruções, respostas finais e anexo atual', async () => {
  const oldFile = {
    type: 'file',
    mediaType: 'image/png',
    url: 'https://assets.test/old.png',
  };
  const newFile = {
    type: 'file',
    mediaType: 'image/png',
    url: 'https://assets.test/new.png',
  };
  const messages = [
    {
      id: 'u1',
      role: 'user',
      parts: [{ type: 'text', text: 'Preserve o rodapé com 28px.' }, oldFile],
    },
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-build_site',
          state: 'output-available',
          toolCallId: 't1',
          input: { pages: ['payload grande'.repeat(1000)] },
          output: { ok: true, pages: ['conteúdo repetido'.repeat(1000)] },
        },
        { type: 'text', text: 'Projeto salvo como rascunho.' },
      ],
    },
    {
      id: 'u2',
      role: 'user',
      parts: [
        { type: 'text', text: 'Aumente o cabeçalho para 52px.' },
        newFile,
      ],
    },
  ];
  const before = structuredClone(messages);
  const compact = economicalMessages(messages);
  assert.deepEqual(messages, before);
  assert.ok(
    JSON.stringify(compact).length < JSON.stringify(messages).length / 20,
  );
  assert.equal(compact[0].parts[0].text, messages[0].parts[0].text);
  assert.deepEqual(compact[2].parts, messages[2].parts);
  assert.ok(compact[0].parts[1].text.includes(oldFile.url));
  assert.ok(
    compact[1].parts.some(
      (part) => part.text === 'Projeto salvo como rascunho.',
    ),
  );
  assert.ok(compact[1].parts.some((part) => part.text.includes('concluída')));
  const model = await convertToModelMessages(compact);
  assert.ok(model.length >= 3);
  assert.ok(!JSON.stringify(model).includes('tool-call'));
});
await test('recibo de ferramenta não anuncia sucesso após falha ou interrupção', () => {
  const message = {
    id: 'a',
    role: 'assistant',
    parts: [
      {
        type: 'tool-build_site',
        state: 'output-available',
        toolCallId: 'a',
        output: { ok: false, error: 'Página inválida' },
      },
      {
        type: 'tool-update_block',
        state: 'input-available',
        toolCallId: 'b',
        input: {},
      },
    ],
  };
  const result = economicalMessages([message])[0];
  assert.match(result.parts[0].text, /recusada; Página inválida/);
  assert.match(result.parts[1].text, /interrompida/);
});
await test('requisição inválida é recusada antes de acessar tenant ou modelo', () => {
  const valid = {
    tenant: 'atelier-teste',
    messages: [
      { id: 'u', role: 'user', parts: [{ type: 'text', text: 'Ajuste' }] },
    ],
  };
  assert.equal(chatRequestSchema.safeParse(valid).success, true);
  for (const change of [
    { phase: 'inventada' },
    { tenant: '' },
    { messages: [] },
    { messages: [{ id: 'u', role: 'system', parts: [] }] },
    { messages: [{ id: 'u', role: 'user', parts: [{ type: 'text' }] }] },
  ]) {
    assert.equal(
      chatRequestSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
  }
  assert.equal(
    chatRequestSchema.safeParse({
      ...valid,
      messages: [
        {
          id: 'u',
          role: 'user',
          parts: [
            {
              type: 'file',
              url: 'data:image/png;base64,xxx',
              mediaType: 'image/png',
            },
          ],
        },
      ],
    }).success,
    false,
  );
});
await test('uso do stream soma passos e mantém cache desconhecido como ausente', () => {
  const metadata = usageMetadata('fixture-model', 'composicao', Date.now());
  assert.equal(metadata({ part: { type: 'finish-step' } }), undefined);
  metadata({ part: { type: 'finish-step' } });
  const result = metadata({
    part: {
      type: 'finish',
      totalUsage: {
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
        inputTokenDetails: { cacheReadTokens: 60 },
      },
    },
  });
  assert.equal(result.usage.steps, 2);
  assert.equal(result.usage.cacheReadTokens, 60);
  assert.equal(result.usage.cacheWriteTokens, undefined);
});
await test('custo real soma todos os passos; ausência não vira custo zero', () => {
  assert.equal(sumGatewayCosts(['0.1', 0.2]), 0.1 + 0.2);
  assert.equal(sumGatewayCosts(['0.1', undefined]), undefined);
  assert.equal(sumGatewayCosts([null]), undefined);
  assert.equal(sumGatewayCosts(['']), undefined);
  assert.equal(sumGatewayCosts([0]), 0);
});
await test('prévia mantém tenant, modo e âncora sem reescrever URLs externas ou rascunho persistido', () => {
  const ctx = { tenant, previewTenant: tenant.slug, isPreview: true };
  assert.equal(
    previewHref('/materiais#acabamento', ctx),
    '/s/atelier-teste/materiais?__tenant=atelier-teste&preview=1#acabamento',
  );
  assert.equal(previewHref('#contato', ctx), '#contato');
  assert.equal(previewHref('https://example.com', ctx), 'https://example.com');
  assert.equal(previewHref('//example.com', ctx), '//example.com');
  const props = { links: [{ href: '/materiais' }], image: '/foto.jpg' };
  const copy = structuredClone(props);
  assert.ok(previewProps(props, ctx).links[0].href.includes('__tenant='));
  assert.deepEqual(props, copy);
  assert.equal(previewHref('/materiais', { tenant }), '/materiais');
});
await test('exportação CSV neutraliza fórmulas e preserva aspas e texto comum', () => {
  for (const value of ['=SUM(1,2)', '+5511999999999', '@cmd', '  =1+1', '-1+2'])
    assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('Atelier "Teste"'), '"Atelier ""Teste"""');
});
await test('logo gerado exige aprovação; upload manual precisa pertencer ao cliente', () => {
  const prefix =
    'https://store.public.blob.vercel-storage.com/tenants/atelier-teste/logo/';
  assert.equal(canApplyLogo('atelier-teste', `${prefix}123-logo.png`), true);
  assert.equal(canApplyLogo('outro-cliente', `${prefix}123-logo.png`), false);
  assert.equal(canApplyLogo('atelier-teste', `${prefix}batch/logo.png`), false);
  assert.equal(
    canApplyLogo('atelier-teste', `${prefix}batch/logo.png`, {
      kind: 'logo',
      status: 'candidata',
    }),
    false,
  );
  assert.equal(
    canApplyLogo('atelier-teste', `${prefix}batch/logo.png`, {
      kind: 'foto',
      status: 'aprovada',
    }),
    false,
  );
  assert.equal(
    canApplyLogo('atelier-teste', `${prefix}batch/logo.png`, {
      kind: 'logo',
      status: 'aprovada',
    }),
    true,
  );
  assert.equal(
    canApplyLogo(
      'atelier-teste',
      'https://example.com/tenants/atelier-teste/logo/123-logo.png',
    ),
    false,
  );
});
await test('host numérico, domínio estranho e nome reservado não viram cliente', () => {
  assert.equal(tenantFromHost('atelier-teste.eixu.com.br'), 'atelier-teste');
  assert.equal(tenantFromHost('atelier-teste.localhost:3100'), 'atelier-teste');
  for (const host of [
    '127.0.0.1:3100',
    'atelier-teste.example.com.br',
    'www.eixu.com.br',
    'a.b.eixu.com.br',
    'eixu.com.br',
  ])
    assert.equal(tenantFromHost(host), null);
  for (const slug of [
    'admin',
    'www',
    'duas--partes',
    '-cliente',
    'a'.repeat(64),
  ])
    assert.equal(tenantSlugSchema.safeParse(slug).success, false);
});
await test('cadastro normaliza nome e e-mail e recusa e-mail inválido', () => {
  const result = tenantDetailsSchema.parse({
    name: ' Oficina ',
    contactEmail: '',
  });
  assert.equal(result.name, 'Oficina');
  assert.equal(result.contactEmail, null);
  assert.equal(
    tenantDetailsSchema.safeParse({ name: ' ', contactEmail: '' }).success,
    false,
  );
  assert.equal(
    tenantDetailsSchema.safeParse({ name: 'Oficina', contactEmail: 'invalido' })
      .success,
    false,
  );
});

await test('contatos normalizam número, rede e endereço, e recusam lixo', () => {
  const contacts = contactsSchema.parse({
    phones: [
      { number: '+55 (11) 99999-9999', whatsapp: true },
      { number: '55 11 3333-4444', whatsapp: false },
      { number: '+55 (11) 99999-9999', whatsapp: false },
    ],
    addresses: [{ label: ' Loja ', text: '  Rua das Pedras, 100, Bauru  ' }],
    social: ['@padaria', 'facebook.com/padaria', 'https://x.com/padaria'],
  });
  assert.deepEqual(
    contacts.phones.map((phone) => phone.number),
    ['5511999999999', '551133334444'],
  );
  assert.equal(contacts.phones[0].whatsapp, true);
  assert.deepEqual(contacts.addresses[0], {
    label: 'Loja',
    text: 'Rua das Pedras, 100, Bauru',
  });
  assert.deepEqual(contacts.social, [
    'https://www.instagram.com/padaria/',
    'https://facebook.com/padaria',
    'https://x.com/padaria',
  ]);
  assert.equal(primaryWhatsapp(contacts), '5511999999999');
  assert.equal(whatsappAt(contacts, 1), null);
  assert.equal(derivedSocialUrl(contacts), 'https://www.instagram.com/padaria/');
  assert.equal(formatPhone('551133334444'), '+55 (11) 3333-4444');
  assert.equal(formatPhone('442071234567'), '+442071234567');
  // Sem DDI o número não vira E.164: o "+" faria um fixo local de São Paulo
  // ser lido como um número dos Estados Unidos.
  assert.equal(formatPhone('1133334444'), '(11) 3333-4444');
  assert.equal(phoneE164('1133334444'), '1133334444');
  assert.equal(phoneE164('5511988887777'), '+5511988887777');
  assert.equal(socialNetwork(contacts.social[1]).label, 'Facebook');
  assert.equal(socialNetwork('https://exemplo.com.br').key, 'site');
  assert.match(contactsSummary(contacts, 'oi@exemplo.com'), /WhatsApp/);

  for (const invalid of [
    { phones: [{ number: '1234567', whatsapp: true }] },
    { phones: [{ number: '1'.repeat(16), whatsapp: false }] },
    { phones: [{ number: 'ligue', whatsapp: false }] },
    { addresses: [{ text: 'Rua' }] },
    { social: ['ftp://exemplo.com'] },
    { phones: Array.from({ length: 5 }, () => ({ number: '5511999999999' })) },
  ])
    assert.equal(contactsSchema.safeParse(invalid).success, false, JSON.stringify(invalid));

  assert.deepEqual(contactsSchema.parse({}), {
    phones: [],
    addresses: [],
    social: [],
  });
});

await test('contatos do formulário pareiam tipo por índice e ignoram linha vazia', () => {
  const form = new FormData();
  for (const [number, kind] of [
    ['11 3333-4444', 'telefone'],
    ['', 'whatsapp'],
    ['+55 11 98888-7777', 'whatsapp'],
  ]) {
    form.append('phone', number);
    form.append('phoneKind', kind);
  }
  form.append('addressLabel', '');
  form.append('addressText', 'Avenida Central, 22, Recife');
  form.append('social', '');
  form.append('social', 'instagram.com/fixture');
  const parsed = contactsFromForm(form);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
  assert.deepEqual(parsed.data.phones, [
    { number: '1133334444', whatsapp: false },
    { number: '5511988887777', whatsapp: true },
  ]);
  assert.equal(primaryWhatsapp(parsed.data), '5511988887777');
  assert.equal(parsed.data.addresses[0].label, '');
  assert.deepEqual(parsed.data.social, ['https://www.instagram.com/fixture/']);
});

await test('leitura de contatos tolera coluna ausente e cliente anterior à mudança', () => {
  assert.deepEqual(contactsOf(undefined), {
    phones: [],
    addresses: [],
    social: [],
  });
  assert.deepEqual(contactsOf({}, '5511999999999').phones, [
    { number: '5511999999999', whatsapp: true },
  ]);
  assert.deepEqual(contactsOf({ phones: 'quebrado' }, null).phones, []);
});

await test('vibe ausente vira comercial e a faixa recusa direção fora dela', () => {
  assert.equal(vibeOf(undefined), 'comercial');
  assert.equal(vibeOf({ vibe: 'inventada' }), 'comercial');
  assert.equal(vibeOf({ vibe: 'ousado' }), 'ousado');
  assert.equal(vibeSchema.safeParse('inventada').success, false);

  const moderno = {
    displayFont: 'geometric',
    bodyFont: 'sans',
    heroComposition: 'editorial',
    navigation: 'minimal',
    rhythm: 'chapters',
    imageTreatment: 'framed',
    surfaceStyle: 'outlined',
    motif: 'none',
    radius: 'sm',
    ink: '#f5f6f8',
    paper: '#0b0c0e',
    surface: '#131519',
    variance: 3,
    motion: 4,
    density: 4,
  };
  assert.deepEqual(laneIssues('moderno', moderno), []);
  assert.deepEqual(laneIssues('comercial', { ...moderno, motif: 'rings' }), []);
  const claro = laneIssues('moderno', { ...moderno, paper: '#ffffff' });
  assert.equal(claro.length, 1);
  assert.match(claro[0], /paper/);
  const fora = laneIssues('moderno', {
    ...moderno,
    displayFont: 'editorial',
    radius: 'full',
    density: 9,
  });
  assert.equal(fora.length, 3);
  assert.match(fora.join(' '), /displayFont/);
  assert.match(
    laneIssues('ousado', { ...moderno, paper: '#0b0c0e' }).join(' '),
    /escuro demais/,
  );
});
await test('sessões válidas, expiradas, malformadas e ambiente sem segredo', async () => {
  const env = {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  };
  try {
    process.env.ADMIN_SESSION_SECRET = 'fixture-only-secret';
    process.env.NODE_ENV = 'test';
    assert.equal(await verifySessionToken(await createSessionToken()), true);
    const token = (payload) =>
      `${payload}.${createHmac('sha256', 'fixture-only-secret').update(payload).digest('base64url')}`;
    for (const payload of [
      'admin.NaN',
      'admin.1',
      `outro.${Date.now() + 60000}`,
      'admin.Infinity',
    ])
      assert.equal(await verifySessionToken(token(payload)), false);
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
    process.env.NODE_ENV = 'production';
    assert.equal(await verifySessionToken('admin.9999999999999.forged'), false);
    await assert.rejects(() => createSessionToken(), /não configurada/);
  } finally {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
await test('períodos e dinheiro são validados sem datas impossíveis ou valores negativos', () => {
  assert.deepEqual(defaultPeriod(new Date('2026-09-10T15:00:00Z')), {
    start: '2026-08-12',
    end: '2026-09-10',
  });
  for (const period of [
    { start: '2026-02-30', end: '2026-03-01' },
    { start: '2026-09-10', end: '2026-09-01' },
  ])
    assert.equal(periodSchema.safeParse(period).success, false);
  const valid = {
    campaign: 'teste',
    channel: 'google',
    start: '2026-09-01',
    end: '2026-09-10',
    spend: '120,50',
  };
  assert.equal(spendSchema.parse(valid).spend, 12050);
  for (const spend of ['-20', 'NaN', 'Infinity', '1e3', '0', '1,234'])
    assert.equal(spendSchema.safeParse({ ...valid, spend }).success, false);
});
await test('gastos de canais repetidos somam; campanha sem visita permanece no relatório', () => {
  const campaigns = mergeCampaigns(
    [
      {
        campaign: 'mesma',
        src: 'google, meta',
        visitors: 12,
        forms: 2,
        whats: 3,
      },
    ],
    [
      { campaign: 'mesma', cents: 10000, partial: 0 },
      { campaign: 'mesma', cents: 20000, partial: 0 },
      { campaign: 'sem-visitas', cents: 4000, partial: 0 },
    ],
  );
  assert.equal(campaigns[0].cents, 30000);
  assert.equal(campaigns[1].campaign, 'sem-visitas');
  assert.equal(campaigns[1].visitors, 0);
});
await test('clique WhatsApp leva atribuição ao redirect sem duplicar beacon', async () => {
  const events = [];
  const callbacks = new Map();
  const store = new Map();
  const anchor = {
    href: '/go/wa?from=/',
    getAttribute(key) {
      return key === 'href' ? this.href : 'whatsapp';
    },
    setAttribute(key, value) {
      if (key === 'href') this.href = value;
    },
  };
  const location = {
    href: 'https://atelier-teste.eixu.com.br/?utm_campaign=lancamento&utm_source=google',
    origin: 'https://atelier-teste.eixu.com.br',
    hostname: 'atelier-teste.eixu.com.br',
    search: '?utm_campaign=lancamento&utm_source=google',
  };
  const ctx = {
    URL,
    URLSearchParams,
    Blob,
    location,
    window: {
      localStorage: {
        getItem: (key) => store.get(key),
        setItem: (key, val) => store.set(key, val),
      },
    },
    navigator: { sendBeacon: (_url, body) => events.push(body) },
    document: {
      referrer: '',
      querySelectorAll: (selector) => (selector === 'a[href]' ? [anchor] : []),
      addEventListener: (type, fn) => callbacks.set(type, fn),
    },
  };
  vm.runInNewContext(attributionScript('atelier-teste', '/servicos'), ctx);
  const target = new URL(anchor.href, location.origin);
  assert.equal(target.searchParams.get('utm_campaign'), 'lancamento');
  assert.equal(target.searchParams.get('t'), 'atelier-teste');
  assert.ok(target.searchParams.get('sid'));
  callbacks.get('click')({ target: { closest: () => anchor } });
  assert.equal(events.length, 1);
  assert.equal(JSON.parse(await events[0].text()).type, 'page_view');
});

await test('JSON-LD público não expõe SEO ou FAQ do rascunho; prévia usa o rascunho', () => {
  const post = {
    ...page,
    type: 'post',
    seo: { description: 'Descrição privada' },
    publishedSeo: { description: 'Descrição publicada' },
    blocks: [
      {
        type: 'faq.accordion',
        props: { items: [{ q: 'Pergunta privada', a: 'Resposta privada' }] },
      },
    ],
    publishedBlocks: [
      {
        type: 'faq.accordion',
        props: { items: [{ q: 'Pergunta pública', a: 'Resposta pública' }] },
      },
    ],
  };
  const published = JSON.stringify(structuredData(tenant, post));
  const draft = JSON.stringify(structuredData(tenant, post, true));
  assert.ok(
    published.includes('Descrição publicada') &&
      published.includes('Pergunta pública'),
  );
  assert.ok(!published.includes('privada'));
  assert.ok(
    draft.includes('Descrição privada') && draft.includes('Pergunta privada'),
  );
  assert.ok(!draft.includes('Pergunta pública'));
});

await test('as cores do cadastro exigem hexadecimal e papéis distintos', () => {
  const ok = brandColorsSchema.safeParse({
    primary: '#1F6FEB',
    secondary: '#14532D',
    highlight: '#EA580C',
  });
  assert.equal(ok.success, true);
  // O formulário devolve o valor do seletor nativo em maiúsculas.
  assert.equal(ok.data.primary, '#1f6feb');
  assert.equal(
    brandColorsSchema.safeParse({
      primary: '#1f6feb',
      secondary: '#1f6feb',
      highlight: '#ea580c',
    }).success,
    false,
  );
  for (const invalid of ['azul', '#fff', '#1f6feb0', ''])
    assert.equal(
      brandColorsSchema.safeParse({
        primary: invalid,
        secondary: '#14532d',
        highlight: '#ea580c',
      }).success,
      false,
    );
});

await test('o acento tem token próprio e cai na cor primária quando falta', () => {
  const tresCores = themeVars({
    accent: '#14532d',
    accentAlt: '#1f6feb',
    highlight: '#ea580c',
    ink: '#14161a',
    paper: '#ffffff',
  });
  assert.equal(tresCores['--accent'], '#14532d');
  assert.equal(tresCores['--accent-2'], '#1f6feb');
  assert.equal(tresCores['--highlight'], '#ea580c');
  assert.ok(tresCores['--highlight-ink']);

  // Cliente antigo, sem acento próprio: o site continua como foi publicado.
  const legado = themeVars({
    accent: '#14532d',
    ink: '#14161a',
    paper: '#fff',
  });
  assert.equal(legado['--highlight'], legado['--accent']);
  assert.equal(legado['--highlight-ink'], legado['--accent-ink']);
});

await test('exclusão pede o endereço quando há site publicado ou contato recebido', () => {
  const rascunho = {
    slug: 'atelier-teste',
    name: 'Atelier',
    status: 'draft',
    pageCount: 2,
    leadCount: 0,
  };
  const publicado = { ...rascunho, status: 'published' };
  const comContato = { ...rascunho, leadCount: 3 };
  assert.equal(requiresSlugConfirmation(rascunho), false);
  assert.equal(requiresSlugConfirmation(publicado), true);
  assert.equal(requiresSlugConfirmation(comContato), true);
  assert.equal(confirmationAccepted(rascunho, ''), true);
  assert.equal(confirmationAccepted(publicado, ''), false);
  assert.equal(confirmationAccepted(publicado, 'outro-cliente'), false);
  assert.equal(confirmationAccepted(publicado, ' Atelier-Teste '), true);
  assert.ok(
    deletionImpact(publicado).some((line) =>
      line.includes('atelier-teste.eixu.com.br'),
    ),
  );
  assert.equal(
    deletionImpact(rascunho).some((line) => line.includes('sai do ar')),
    false,
  );
  assert.ok(deletionImpact(rascunho)[0].includes('2 páginas'));
  assert.ok(
    deletionImpact({ ...rascunho, pageCount: 1, leadCount: 1 })[0].includes(
      '1 página',
    ),
  );
});

await test('limpeza do Blob pagina por cursor, respeita o prefixo e é idempotente', async () => {
  assert.equal(tenantBlobPrefix('atelier-teste'), 'tenants/atelier-teste/');
  const seen = [];
  const removed = [];
  const pages = [
    {
      blobs: Array.from({ length: 120 }, (_, i) => ({
        url: `https://blob.test/a${i}`,
      })),
      cursor: 'c1',
      hasMore: true,
    },
    { blobs: [{ url: 'https://blob.test/b0' }], hasMore: false },
  ];
  const result = await deleteTenantBlobs('atelier-teste', {
    list: async (options) => {
      seen.push(options);
      return pages[seen.length - 1];
    },
    del: async (urls) => {
      removed.push(urls);
    },
  });
  assert.equal(result.deleted, 121);
  assert.deepEqual(
    seen.map((options) => options.prefix),
    ['tenants/atelier-teste/', 'tenants/atelier-teste/'],
  );
  assert.equal(seen[0].cursor, undefined);
  assert.equal(seen[1].cursor, 'c1');
  assert.deepEqual(
    removed.map((batch) => batch.length),
    [100, 20, 1],
  );

  let calls = 0;
  const vazio = await deleteTenantBlobs('atelier-teste', {
    list: async () => ({ blobs: [], hasMore: false }),
    del: async () => {
      calls += 1;
    },
  });
  assert.equal(vazio.deleted, 0);
  assert.equal(calls, 0);
});

await test('falha ao apagar arquivo interrompe a limpeza sem seguir para a página seguinte', async () => {
  let listed = 0;
  await assert.rejects(
    deleteTenantBlobs('atelier-teste', {
      list: async () => {
        listed += 1;
        return {
          blobs: [{ url: 'https://blob.test/a' }],
          cursor: 'c1',
          hasMore: true,
        };
      },
      del: async () => {
        throw new Error('token inválido');
      },
    }),
    /token inválido/,
  );
  assert.equal(listed, 1);
});

await test('o redirecionador aceita um segundo WhatsApp do cadastro', async () => {
  const contacts = {
    phones: [
      { number: '5511999990000', whatsapp: true },
      { number: '551133334444', whatsapp: false },
      { number: '5511988887777', whatsapp: true },
    ],
    addresses: [],
    social: [],
  };
  const events = [];
  const { GET } = await loadModule('app/go/wa/route.ts', {
    '@/lib/db': {
      db:
        () =>
        async (_parts, ...values) => {
          events.push(values);
          return [];
        },
    },
    '@/lib/tenant-queries': {
      getTenantBySlug: async () => ({
        id: 'fixture',
        slug: 'fixture',
        whatsapp: '5511999990000',
        contacts,
      }),
    },
    '@/lib/tenant-host': { tenantFromHost: () => 'fixture' },
  });
  const destination = async (query) => {
    const response = await GET(
      new Request(`https://fixture.eixu.com.br/go/wa${query}`),
    );
    return response.headers.get('location');
  };
  assert.match(await destination(''), /wa\.me\/5511999990000/);
  assert.match(await destination('?n=0'), /wa\.me\/5511999990000/);
  // O índice conta só os números marcados como WhatsApp.
  assert.match(await destination('?n=1'), /wa\.me\/5511988887777/);
  // Índice inexistente ou inválido cai no número principal, sem erro.
  assert.match(await destination('?n=9'), /wa\.me\/5511999990000/);
  assert.match(await destination('?n=abc'), /wa\.me\/5511999990000/);
  assert.equal(events.length, 5);

  // A prévia manda para o mesmo número, sem passar pelo redirecionador.
  const ctx = { isPreview: true, tenant: { slug: 'fixture', whatsapp: '5511999990000', contacts } };
  assert.equal(previewHref('/go/wa?n=1', ctx), 'https://wa.me/5511988887777');
  assert.equal(previewHref('/go/wa', ctx), 'https://wa.me/5511999990000');
});

await test('JSON-LD publica contatos do cadastro sem inventar dado ausente', () => {
  const completo = structuredData(
    {
      ...tenant,
      contactEmail: 'contato@fixture.com.br',
      whatsapp: '5511999990000',
      contacts: {
        phones: [{ number: '5511999990000', whatsapp: true }],
        addresses: [{ label: 'Loja', text: 'Rua das Pedras, 100, Bauru' }],
        social: ['https://www.instagram.com/fixture/'],
      },
    },
    page,
  );
  const org = completo['@graph'][0];
  assert.equal(org.telephone, '+5511999990000');
  assert.equal(org.email, 'contato@fixture.com.br');
  assert.deepEqual(org.sameAs, ['https://www.instagram.com/fixture/']);
  assert.deepEqual(org.address, [
    {
      '@type': 'PostalAddress',
      name: 'Loja',
      streetAddress: 'Rua das Pedras, 100, Bauru',
    },
  ]);
  // Fixture sem contatos nem e-mail continua válida e sem chaves vazias.
  const vazio = structuredData(tenant, page)['@graph'][0];
  assert.equal('address' in vazio, false);
  assert.equal('sameAs' in vazio, false);
  assert.equal('telephone' in vazio, false);
});
