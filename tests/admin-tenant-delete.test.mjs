import assert from 'node:assert/strict';
import test from 'node:test';
import {
  confirmationAccepted,
  deletionImpact,
  requiresSlugConfirmation,
} from '../lib/admin/tenant-delete.ts';

void test('site publicado ou com contatos exige o slug exato', () => {
  assert.equal(
    requiresSlugConfirmation({ status: 'published', leadCount: 0 }),
    true,
  );
  assert.equal(
    requiresSlugConfirmation({ status: 'draft', leadCount: 1 }),
    true,
  );
  assert.equal(
    confirmationAccepted(
      { status: 'published', leadCount: 0, slug: 'cliente-fixture' },
      ' CLIENTE-FIXTURE ',
    ),
    true,
  );
  assert.equal(
    confirmationAccepted(
      { status: 'published', leadCount: 0, slug: 'cliente-fixture' },
      'outro-cliente',
    ),
    false,
  );
});

void test('impacto da exclusão explicita URL, dados e vínculo do Kanban', () => {
  const impact = deletionImpact({
    slug: 'cliente-fixture',
    name: 'Cliente Fixture',
    status: 'published',
    pageCount: 3,
    leadCount: 2,
    imageCount: 4,
  }).join('\n');
  assert.match(impact, /cliente-fixture\.eixu\.com\.br/);
  assert.match(impact, /2 contatos recebidos/);
  assert.match(impact, /4 imagens/);
  assert.match(impact, /Kanban/);
});
