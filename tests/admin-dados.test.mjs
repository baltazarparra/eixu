import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-module.mjs';

const {
  brandColorsFromForm,
  contactsFromForm,
  directionFromForm,
  intakeFromForm,
} = await loadModule('lib/admin/tenant-input.ts');

function baseForm() {
  const form = new FormData();
  form.set('story', 'A empresa nasceu em 2012 e atende indústrias da região.');
  form.set('evidence', 'Fundada em 2012\nAtendimento industrial');
  form.set('constraints', 'Não prometer prazo sem confirmação');
  form.set('currentSiteUrl', 'https://cliente.example/');
  form.set('reference', 'https://referencia.example/');
  form.set('direction', 'referencia');
  form.set('primary', '#112233');
  form.set('secondary', '#f0f1f2');
  form.set('highlight', '#ff5500');
  form.append('phone', '+55 (14) 99999-0000');
  form.append('phoneKind', 'whatsapp');
  form.append('addressLabel', 'Matriz');
  form.append('addressText', 'Rua Principal, 100, Brotas - SP');
  form.append('addressPhone', '14 3333-0000');
  form.append('addressHours', 'Segunda a sexta, 8h às 18h');
  form.append('social', '@cliente');
  return form;
}

void test('/dados preserva fatos, contatos e uma referência visual', () => {
  const form = baseForm();
  const contacts = contactsFromForm(form);
  const intake = intakeFromForm(form);
  assert.equal(contacts.success, true);
  assert.deepEqual(contacts.data.phones, [
    { number: '+5514999990000', whatsapp: true },
  ]);
  assert.equal(contacts.data.addresses[0].label, 'Matriz');
  assert.equal(intake.success, true);
  assert.equal(intake.data.references.length, 1);
  assert.equal(intake.data.evidence.length, 2);
  assert.match(intake.data.socialUrl, /instagram\.com\/cliente/);
  assert.equal(directionFromForm(form).data, 'referencia');
  assert.deepEqual(brandColorsFromForm(form).data, {
    primary: '#112233',
    secondary: '#f0f1f2',
    highlight: '#ff5500',
  });
});

void test('/dados recusa duas referências e cores sem contraste de papel', () => {
  const form = baseForm();
  form.append('reference', 'https://segunda.example/');
  assert.equal(intakeFromForm(form).success, false);

  form.set('primary', '#112233');
  form.set('secondary', '#112233');
  assert.equal(brandColorsFromForm(form).success, false);
  form.set('direction', 'inventado');
  assert.equal(directionFromForm(form).success, false);
});
