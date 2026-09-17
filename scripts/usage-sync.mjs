#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import { Client } from '@neondatabase/serverless';
import { parseReceipts } from '../lib/usage/receipts.mjs';
import { importReceipts } from '../lib/usage/import.mjs';

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    source: { type: 'string' },
    tenant: { type: 'string' },
    lifecycle: { type: 'string' },
    apply: { type: 'boolean', default: false },
    'database-host': { type: 'string' },
    watch: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

async function main() {
  if (values.help) {
    console.log(
      'usage:sync --file=<jsonl> --source=codex|claude|external --tenant=<slug> --lifecycle=generator|converting|premium [--apply --database-host=<host>] [--watch]',
    );
    console.log(
      'Sem --apply: somente prévia local. Use arquivos de sessões dedicadas a um cliente. --watch sincroniza a cada 30s até Ctrl+C.',
    );
    return;
  }
  if (
    !values.file ||
    !['codex', 'claude', 'external'].includes(values.source) ||
    !values.tenant ||
    !['generator', 'converting', 'premium'].includes(values.lifecycle)
  )
    throw new Error(
      'Informe arquivo, origem, cliente e fase. Consulte --help.',
    );
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let lastText;
  const imported = new Map();
  const sync = async () => {
    const text = await readFile(values.file, 'utf8');
    if (text === lastText) return;
    const parsed = parseReceipts(text, values.source);
    const changed = parsed.receipts.filter(
      (receipt) => imported.get(receipt.externalId) !== JSON.stringify(receipt),
    );
    if (values.apply && changed.length) {
      const url = process.env.DATABASE_URL;
      if (!url || new URL(url).hostname !== values['database-host'])
        throw new Error(
          'DATABASE_URL ausente ou host diferente de --database-host.',
        );
      const client = new Client(url);
      try {
        await client.connect();
        const result = await importReceipts(client, {
          tenant: values.tenant,
          lifecycle: values.lifecycle,
          receipts: changed,
        });
        for (const receipt of changed)
          imported.set(receipt.externalId, JSON.stringify(receipt));
        console.log(JSON.stringify({ ...result, warnings: parsed.warnings }));
      } finally {
        await client.end();
      }
    } else if (!values.apply) {
      // Apenas campos da allowlist, nunca a sessão bruta.
      console.log(
        JSON.stringify(
          {
            mode: 'preview',
            tenant: values.tenant,
            lifecycle: values.lifecycle,
            ...parsed,
          },
          null,
          2,
        ),
      );
    } else if (!parsed.receipts.length) {
      console.log(JSON.stringify({ receipts: 0, warnings: parsed.warnings }));
    }
    lastText = text;
  };
  do {
    await sync();
    if (!values.watch || stopped) break;
    for (let i = 0; i < 30 && !stopped; i++) await setTimeout(1000);
  } while (!stopped);
  if (values.watch) await sync();
}
main().catch(() => {
  // Erros de driver podem incluir credenciais ou dados de linha. Não os replique.
  console.error(
    'Sincronização recusada. Verifique argumentos, formato dos recibos, vínculo exclusivo do cliente, migração e conexão. Nenhum lote parcialmente aplicado.',
  );
  process.exitCode = 1;
});
