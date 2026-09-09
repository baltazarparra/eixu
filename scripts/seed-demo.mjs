import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const id = () => Math.random().toString(36).slice(2, 10);
const b = (type, props) => ({ id: id(), type, props });

const home = [
  b('nav.bar', {
    logoText: 'Vértice',
    links: [
      { label: 'Tratamentos', href: '#tratamentos' },
      { label: 'Como funciona', href: '#como' },
      { label: 'Dúvidas', href: '#duvidas' },
    ],
    cta: { label: 'Falar no WhatsApp', href: '/go/wa?from=/' },
  }),
  b('hero.split', {
    eyebrow: 'Fisioterapia e pilates clínico em Bauru',
    headline: 'Sua coluna merece um plano, não um paliativo.',
    subtext: 'Avaliação individual, plano por escrito e acompanhamento de quem operou ou convive com dor crônica.',
    cta: { label: 'Falar no WhatsApp', href: '/go/wa?from=/' },
    secondary: { label: 'Ver tratamentos', href: '#tratamentos' },
    imageAlt: 'Sala de atendimento da clínica Vértice em Bauru',
  }),
  b('proof.stats', {
    items: [
      { value: '12 anos', label: 'De atendimento em Bauru' },
      { value: '1 hora', label: 'De avaliação antes de qualquer sessão' },
      { value: '4 fisios', label: 'Com especialização em coluna' },
    ],
  }),
  b('feature.bento', {
    eyebrow: 'Tratamentos',
    title: 'O que tratamos com mais frequência',
    items: [
      { title: 'Dor lombar crônica', body: 'Protocolo de fortalecimento progressivo, com reavaliação a cada seis semanas.' },
      { title: 'Pós-operatório de coluna', body: 'Retorno ao movimento em etapas, alinhado com o relatório do seu cirurgião.' },
      { title: 'Hérnia de disco', body: 'Controle de dor e ganho de mobilidade sem exercícios de risco para o disco.' },
      { title: 'Pilates clínico', body: 'Turmas de até quatro pessoas, com plano individual dentro da aula.' },
    ],
  }),
  b('narrative.steps', {
    title: 'Três passos até a primeira sessão',
    steps: [
      { title: 'Conversa no WhatsApp', body: 'Você conta a queixa e a gente diz se o caso é para fisioterapia ou para outro profissional.' },
      { title: 'Avaliação de uma hora', body: 'Testes de movimento, leitura de exames e um plano escrito com prazo e metas.' },
      { title: 'Sessões com reavaliação', body: 'A cada seis semanas medimos de novo. Se não estiver evoluindo, o plano muda.' },
    ],
  }),
  b('proof.testimonial', {
    quote: 'Cheguei sem conseguir dirigir por causa da dor. Em dois meses voltei a trabalhar o dia inteiro sentada, com um plano que eu entendia.',
    author: 'Regina Alves',
    role: 'Paciente desde 2024',
  }),
  b('faq.accordion', {
    title: 'Dúvidas antes de marcar',
    items: [
      { q: 'Preciso de pedido médico?', a: 'Não para a avaliação. Se houver cirurgia recente ou exame de imagem, traga o relatório.' },
      { q: 'Vocês atendem convênio?', a: 'O atendimento é particular. Emitimos recibo para reembolso do seu plano.' },
      { q: 'Quanto tempo até melhorar?', a: 'Depende do caso. Na avaliação você recebe uma estimativa por escrito, com metas de seis semanas.' },
      { q: 'Onde fica a clínica?', a: 'No centro de Bauru, com estacionamento na rua e acesso sem escadas.' },
    ],
  }),
  b('form.lead', {
    title: 'Conte sua queixa',
    body: 'A gente responde no mesmo dia útil e diz se o seu caso é para a nossa equipe.',
    fields: [
      { name: 'nome', label: 'Seu nome', type: 'text', required: true },
      { name: 'telefone', label: 'WhatsApp', type: 'tel', required: true },
      { name: 'queixa', label: 'O que está doendo e há quanto tempo', type: 'textarea', required: true },
    ],
    submitLabel: 'Enviar',
    consentText: 'Autorizo o contato pela clínica e o uso dos meus dados para esse atendimento.',
    whatsappOptIn: true,
    redirectTo: '/obrigado',
  }),
  b('cta.band', {
    title: 'Prefere resolver agora pelo WhatsApp?',
    body: 'Atendimento de segunda a sexta, das 7h às 19h.',
    cta: { label: 'Abrir conversa', href: '/go/wa?from=/' },
    whatsapp: true,
  }),
  b('footer.compact', {
    logoText: 'Vértice',
    tagline: 'Fisioterapia e pilates clínico no centro de Bauru.',
    links: [{ label: 'Tratamentos', href: '#tratamentos' }, { label: 'Dúvidas', href: '#duvidas' }],
    legal: 'Vértice Fisioterapia. CNPJ 00.000.000/0001-00. Bauru, São Paulo.',
  }),
];

const thanks = [
  b('nav.bar', { logoText: 'Vértice', links: [], cta: { label: 'Voltar ao site', href: '/' } }),
  b('hero.statement', {
    headline: 'Recebemos sua mensagem.',
    subtext: 'A equipe responde no mesmo dia útil, das 7h às 19h.',
    cta: { label: 'Falar agora no WhatsApp', href: '/go/wa?from=/obrigado' },
  }),
  b('footer.compact', { logoText: 'Vértice', legal: 'Vértice Fisioterapia. Bauru, São Paulo.' }),
];

const [tenant] = await sql`select id from tenants where slug = 'vertice'`;
if (!tenant) {
  console.error('Cliente "vertice" não existe. Crie no painel primeiro.');
  process.exit(1);
}

const pages = [
  {
    slug: '',
    type: 'page',
    title: 'Fisioterapia e pilates clínico em Bauru',
    seo: {
      title: 'Fisioterapia para coluna em Bauru | Vértice',
      description: 'Avaliação de uma hora, plano por escrito e reavaliação a cada seis semanas. Dor lombar, hérnia e pós-operatório.',
    },
    blocks: home,
  },
  {
    slug: 'obrigado',
    type: 'thank_you',
    title: 'Mensagem recebida',
    seo: { title: 'Mensagem recebida | Vértice', description: 'Recebemos seu contato.', noindex: true },
    blocks: thanks,
  },
];

for (const page of pages) {
  await sql`
    insert into pages (tenant_id, slug, type, title, seo, blocks, published_blocks, published_seo, published_at)
    values (${tenant.id}, ${page.slug}, ${page.type}, ${page.title},
            ${JSON.stringify(page.seo)}::jsonb, ${JSON.stringify(page.blocks)}::jsonb,
            ${JSON.stringify(page.blocks)}::jsonb, ${JSON.stringify(page.seo)}::jsonb, now())
    on conflict (tenant_id, slug) do update set
      type = excluded.type, title = excluded.title, seo = excluded.seo, blocks = excluded.blocks,
      published_blocks = excluded.published_blocks, published_seo = excluded.published_seo,
      published_at = now(), updated_at = now()
  `;
  console.log('publicada  /' + page.slug, `(${page.blocks.length} blocos)`);
}

await sql`
  update tenants
  set status = 'published',
      brand = ${JSON.stringify({ accent: '#0f5c4a', ink: '#16191c', paper: '#fbfaf8', radius: 'sm', font: 'sans' })}::jsonb,
      dials = ${JSON.stringify({ variance: 6, motion: 3, density: 4 })}::jsonb
  where id = ${tenant.id}
`;
console.log('\nSite demo pronto em /s/vertice');
