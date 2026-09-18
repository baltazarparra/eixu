import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

void test('schema vincula cada cliente ao workspace interno preservado', async () => {
  const [schema, reset] = await Promise.all([
    readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'),
    readFile(
      new URL('../scripts/reset-sites-lib.mjs', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(schema, /create table if not exists studio_workspaces/i);
  assert.match(
    schema,
    /workspace_id\s+uuid not null[\s\S]+references studio_workspaces\(id\)/i,
  );
  assert.match(schema, /values \([\s\S]+00000000-0000-4000-8000-000000000001/i);
  assert.match(reset, /PRESERVED_TABLES = \[[\s\S]+studio_workspaces/i);
});
