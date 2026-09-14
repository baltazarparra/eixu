import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

/**
 * Contrato estático dos degradês de fundo.
 *
 * Degradê de fundo é luz sobre papel: um brilho que nasce na borda ou fora da
 * caixa e chega ao papel antes do texto. O padrão que este teste recusa é o
 * que produziu o rodapé de creme a vermelho do Skinão: dois pontos opacos
 * ligados por uma reta, um deles calculado contra o papel da marca enquanto o
 * outro era o papel de uma seção de outro tom. Uma regra nova com esse
 * formato falha aqui, não na prévia do cliente.
 *
 * Ver docs/archive/gradient-technique-plan-2026-09-13.md, seções 3 e 7.
 */

/** Tokens que nunca são parada de um degradê de fundo. */
const FORBIDDEN_STOPS = [
  '--paper',
  '--brand-paper',
  '--ink',
  '--brand-ink',
  '--wash',
  '--wash-2',
  '--accent-deep',
];

/**
 * Exceções, cada uma com o seletor e o motivo. São véus, máscaras e padrões
 * chapados: nenhum deles é a cor da marca lavando uma superfície de texto.
 */
const EXCEPTIONS = [
  {
    file: 'app/(sites)/site.css',
    selector: '.site-hero-cover .site-hero-copy::before',
    reason:
      'Véu do hero cover: escurece a foto sob a cópia branca, não pinta papel.',
  },
  {
    file: 'app/(sites)/site.css',
    selector: '.site-hero-cover .site-hero-media::after',
    reason: 'Véu lateral da foto do hero cover, pela mesma razão.',
  },
  {
    file: 'app/(sites)/operator.css',
    selector: "[data-scrim='paper'] .site-hero-cover .site-hero-copy::before",
    reason: 'O mesmo véu na cor da seção quando o operador pediu fundo escuro.',
  },
  {
    file: 'app/(sites)/operator.css',
    selector: "[data-scrim='paper'] .site-hero-cover .site-hero-media::after",
    reason: 'O mesmo véu lateral na cor da seção.',
  },
  {
    file: 'app/(sites)/site.css',
    selector: "[data-design-version='2'][data-motif='grid']",
    reason:
      'Grade do perfil v2, preservada no que está no ar: dois fios de 1px repetidos, não uma transição.',
  },
  {
    file: 'app/(sites)/site.css',
    selector: "[data-motif='stripes'] .site-cta::before",
    reason: 'Faixa chapada repetida do ousado; o padrão é a assinatura da vibe.',
  },
  {
    file: 'app/(admin)/admin.css',
    selector: ".admin-vibe-preview[data-vibe='moderno']",
    exact: true,
    reason: 'Fio de 1px da miniatura moderna, desenhado com background-size.',
  },
  {
    file: 'app/(admin)/admin.css',
    selector: ".admin-vibe-preview[data-vibe='moderno'] .admin-vibe-image",
    exact: true,
    reason:
      'Painel escuro do moderno: a vibe não tem degradê tonal, e a miniatura mostra um painel de mídia, não papel lavado.',
  },
  {
    file: 'app/(admin)/admin.css',
    selector: ".admin-vibe-preview[data-vibe='ousado'] .admin-vibe-image",
    exact: true,
    reason:
      'Corte duro do ousado: duas cores sem transição, que é o que a vibe entrega.',
  },
];

/** Uma exceção casa pelo seletor inteiro ou por um trecho estável dele. */
function matches(decl, exception) {
  return exception.exact
    ? decl.selector === exception.selector
    : decl.selector.includes(exception.selector);
}

const COLORISH =
  /#[0-9a-f]{3,8}|rgba?\(|hsla?\(|color-mix\(|var\(|transparent|currentcolor/i;

/** Declarações de um CSS, com o seletor em que vivem e a linha de origem. */
function declarations(css) {
  // Comentários viram espaços para preservar o número da linha.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' '),
  );
  const out = [];
  const stack = [];
  let buffer = '';
  let line = 1;
  let declLine = 1;
  let depth = 0;
  let quote = null;
  for (const ch of clean) {
    if (!buffer.trim() && !/\s/.test(ch)) declLine = line;
    if (ch === '\n') line += 1;
    if (quote) {
      buffer += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buffer += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (depth === 0 && (ch === '{' || ch === '}' || ch === ';')) {
      const text = buffer.trim();
      buffer = '';
      if (ch === '{') {
        stack.push(text.replace(/\s+/g, ' '));
        continue;
      }
      if (ch === '}') {
        stack.pop();
        continue;
      }
      const at = text.indexOf(':');
      if (at > 0 && stack.length)
        out.push({
          selector: stack.filter((s) => !s.startsWith('@')).join(' '),
          property: text.slice(0, at).trim().toLowerCase(),
          value: text
            .slice(at + 1)
            .trim()
            .replace(/\s+/g, ' '),
          line: declLine,
        });
      continue;
    }
    buffer += ch;
  }
  return out;
}

/** Divide uma lista de argumentos CSS nas vírgulas de primeiro nível. */
function splitTop(text) {
  const parts = [];
  let current = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Cada função de degradê de um valor, sem entrar em aninhamentos. */
function gradientsIn(value) {
  const out = [];
  const re = /(repeating-)?(linear|radial|conic)-gradient\(/gi;
  let match;
  while ((match = re.exec(value))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < value.length && depth > 0) {
      if (value[i] === '(') depth += 1;
      else if (value[i] === ')') depth -= 1;
      i += 1;
    }
    out.push({
      kind: match[0].slice(0, -1).toLowerCase(),
      args: value.slice(re.lastIndex, i - 1),
    });
    re.lastIndex = i;
  }
  return out;
}

/** Violações de uma folha; vazio é o contrato cumprido. */
function violations(file, css) {
  const findings = [];
  for (const decl of declarations(css)) {
    if (decl.property !== 'background' && decl.property !== 'background-image')
      continue;
    if (!/-gradient\(/i.test(decl.value)) continue;
    // No admin só as miniaturas de vibe ensinam o degradê ao operador.
    if (file.includes('(admin)') && !decl.selector.includes('.admin-vibe'))
      continue;
    const excepted = EXCEPTIONS.find(
      (e) => e.file === file && matches(decl, e),
    );
    if (excepted) continue;
    const where = `${file}:${decl.line} ${decl.selector}`;
    for (const gradient of gradientsIn(decl.value)) {
      const stops = splitTop(gradient.args).filter((a) => COLORISH.test(a));
      if (gradient.kind.startsWith('repeating-')) {
        findings.push(`${where}: degradê repetido fora da lista de exceções`);
        continue;
      }
      for (const token of FORBIDDEN_STOPS)
        if (new RegExp(`var\\(\\s*${token}\\s*[,)]`).test(gradient.args))
          findings.push(
            `${where}: parada usa var(${token}); os dois extremos precisam sair do mesmo contexto de cor`,
          );
      if (!/transparent/i.test(stops.at(-1) ?? ''))
        findings.push(
          `${where}: a última parada não é transparent; o brilho precisa chegar ao papel`,
        );
      const opaque = stops.filter((s) => !/transparent/i.test(s));
      if (gradient.kind === 'linear-gradient' && opaque.length === 2)
        findings.push(
          `${where}: linear-gradient entre duas paradas opacas; o olho lê a direção da reta, não uma luz`,
        );
    }
  }
  return findings;
}

await test('nenhum degradê de fundo liga duas cores plenas por uma reta', async () => {
  const files = [
    ...(await readdir('app/(sites)'))
      .filter((f) => f.endsWith('.css'))
      .map((f) => `app/(sites)/${f}`),
    'app/(admin)/admin.css',
  ];
  const findings = [];
  for (const file of files)
    findings.push(...violations(file, await readFile(file, 'utf8')));
  assert.deepEqual(findings, []);
});

await test('o contrato recusa o padrão que produziu o rodapé do Skinão', () => {
  const skinao = `
    .site-theme[data-vibe='comercial'] .site-footer {
      background-image: linear-gradient(160deg, var(--wash), var(--paper) 68%);
    }
    .site-theme[data-vibe='comercial'] .site-cta {
      background-image: linear-gradient(135deg, var(--accent), var(--accent-deep));
    }
  `;
  const findings = violations('app/(sites)/vibes.css', skinao);
  assert.ok(
    findings.some((f) => f.includes('var(--wash)')),
    'a lavagem ligada ao papel precisa falhar',
  );
  assert.ok(
    findings.some((f) => f.includes('var(--paper)')),
    'o papel como parada precisa falhar',
  );
  assert.ok(
    findings.some((f) => f.includes('var(--accent-deep)')),
    'a mistura com a tinta precisa falhar',
  );
  assert.ok(
    findings.some((f) => f.includes('duas paradas opacas')),
    'a reta entre duas cores plenas precisa falhar',
  );
  assert.ok(
    findings.some((f) => f.includes('última parada')),
    'o degradê que não chega ao papel precisa falhar',
  );
});

await test('a lista de exceções continua nomeando regras que existem', async () => {
  for (const exception of EXCEPTIONS) {
    const css = await readFile(exception.file, 'utf8');
    const selectors = declarations(css).map((d) => d.selector);
    assert.ok(
      selectors.some((s) => matches({ selector: s }, exception)),
      `exceção órfã: ${exception.file} ${exception.selector}`,
    );
    assert.ok(exception.reason.length > 20, exception.selector);
  }
});
