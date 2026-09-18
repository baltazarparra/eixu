import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalTenantOrigin,
  matchesTenantOrigin,
  tenantRedirectUrl,
  tenantCorsHeaders,
} from '../lib/public-origin.mjs';

void test('origem pública pertence exatamente ao subdomínio do tenant', () => {
  assert.equal(
    canonicalTenantOrigin('acme-labs'),
    'https://acme-labs.eixu.com.br',
  );
  assert.equal(canonicalTenantOrigin('../admin'), null);
  assert.equal(
    matchesTenantOrigin('https://acme-labs.eixu.com.br', 'acme-labs'),
    true,
  );
  assert.equal(
    matchesTenantOrigin('https://outro.eixu.com.br', 'acme-labs'),
    false,
  );
  assert.equal(matchesTenantOrigin('', 'acme-labs'), false);
  assert.equal(
    matchesTenantOrigin('', 'acme-labs', { allowMissing: true }),
    true,
  );
});

void test('redirecionamento do formulário permanece no host do cliente', () => {
  assert.equal(
    tenantRedirectUrl('acme-labs', '/obrigado?origem=site'),
    'https://acme-labs.eixu.com.br/obrigado?origem=site',
  );
  assert.equal(
    tenantRedirectUrl('acme-labs', '//evil.example/path'),
    'https://acme-labs.eixu.com.br/obrigado',
  );
  assert.equal(
    tenantRedirectUrl('acme-labs', '/\\evil.example/path'),
    'https://acme-labs.eixu.com.br/obrigado',
  );
});

void test('CORS não usa wildcard nem credenciais', () => {
  const headers = tenantCorsHeaders('https://acme.eixu.com.br');
  assert.equal(
    headers['access-control-allow-origin'],
    'https://acme.eixu.com.br',
  );
  assert.equal(headers['access-control-allow-credentials'], undefined);
  assert.equal(headers.vary, 'Origin');
});
