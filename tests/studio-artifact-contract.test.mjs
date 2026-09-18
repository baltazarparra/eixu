import assert from 'node:assert/strict';
import test from 'node:test';
import {
  studioArtifactInputSchema,
  studioValidationArtifactSchema,
} from '../lib/studio/artifact-contract.ts';

void test('o contrato de contexto separa fatos, inferências e lacunas', () => {
  const artifact = studioArtifactInputSchema.parse({
    kind: 'context',
    payload: {
      summary: 'A Acme atende empresas locais com manutenção especializada.',
      tone: {
        voice: 'Direta, técnica e próxima.',
        traits: ['clara', 'segura'],
        avoid: ['promessas sem prova'],
      },
      facts: [
        {
          statement: 'O telefone comercial é (11) 99999-9999.',
          source: { kind: 'operator', location: '/dados' },
          status: 'confirmed',
        },
        {
          statement: 'O site atual apresenta manutenção preventiva.',
          source: { kind: 'official', url: 'https://example.com/servicos' },
          status: 'observed',
        },
      ],
      inferences: [
        {
          statement: 'A prova técnica deve aparecer cedo na página.',
          basis: 'A oferta depende de confiança e segurança operacional.',
        },
      ],
      gaps: [
        {
          topic: 'Área de atendimento',
          impact: 'Não afirmar cobertura geográfica até confirmação.',
        },
      ],
      sitePlan: [
        {
          slug: '/',
          purpose: 'Apresentar valor e conduzir ao contato.',
          content: ['proposta de valor', 'serviços', 'contato'],
        },
      ],
      constraints: ['Não inventar certificações.'],
    },
  });

  assert.equal(artifact.kind, 'context');
  assert.equal(artifact.payload.facts.length, 2);
});

void test('um objeto genérico não satisfaz o contrato de direção de arte', () => {
  const result = studioArtifactInputSchema.safeParse({
    kind: 'art_direction',
    payload: { style: 'moderno' },
  });

  assert.equal(result.success, false);
});

void test('a validação exige typecheck, build e ready coerente', () => {
  const missingBuild = studioValidationArtifactSchema.safeParse({
    summary: 'Tipagem validada.',
    checks: [
      {
        kind: 'command',
        command: 'typecheck',
        status: 'passed',
        evidence: 'Saída 0.',
      },
      {
        kind: 'manual',
        name: 'mobile',
        status: 'passed',
        evidence: 'Layout conferido.',
      },
    ],
    limitations: [],
    ready: true,
  });
  assert.equal(missingBuild.success, false);

  const failedButReady = studioValidationArtifactSchema.safeParse({
    summary: 'Build com falha.',
    checks: [
      {
        kind: 'command',
        command: 'typecheck',
        status: 'passed',
        evidence: 'Saída 0.',
      },
      {
        kind: 'command',
        command: 'build',
        status: 'failed',
        evidence: 'Saída 1.',
      },
    ],
    limitations: ['O build precisa de reparo.'],
    ready: true,
  });
  assert.equal(failedButReady.success, false);
});
