import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { handoffFixture } from '../helpers/admin-handoff-fixture.mjs';
import { navigationPage } from '../helpers/navigation-fixture.mjs';
const button = async (page, label) => {
  const handles = await page.$$('button');
  for (const el of handles)
    if (await el.evaluate((e, label) => e.textContent.trim() === label, label))
      return el;
  throw Error(`Botão ${label} ausente`);
};
const click = async (page, label) => (await button(page, label)).click();
async function start(page, f) {
  await page.goto(f.base + '/admin/marcenaria-horizonte');
  await page.waitForSelector('.admin-workspace');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some(
      (b) => b.textContent === 'Editar',
    ),
  );
  await click(page, 'Editar');
  await page.waitForFunction(
    () =>
      document.querySelector('.admin-edit-status')?.textContent ===
      'editando /',
  );
  const frame = page.frames().find((frame) => frame.url().includes('&edit=1'));
  assert.ok(frame);
  await frame.waitForSelector('[data-field="headline"][contenteditable]');
  return frame;
}
async function change(frame) {
  await frame.focus('[data-field="headline"]');
  await frame.evaluate(() => {
    const el = document.querySelector('[data-field="headline"]');
    el.textContent = 'Escolha os materiais da casa';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
}
await test(
  'workspace: edição publicada, rascunho, cancelar e respostas 200/409/422',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const f = await handoffFixture();
    const b = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    t.after(async () => {
      f.releaseFeed();
      await b.close();
      await f.server.close();
    });
    for (const width of [1440, 390]) {
      const p = await navigationPage(b);
      await p.setViewport({ width, height: 900 });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      let frame = await start(p, f);
      assert.equal(
        await p.$$eval('button', (buttons) =>
          buttons.some((b) => b.textContent === 'Publicar'),
        ),
        false,
      );
      assert.equal(await p.$eval('textarea', (el) => el.disabled), true);
      assert.equal(await p.$eval('.admin-bar-page', (el) => el.disabled), true);
      await change(frame);
      await p.waitForFunction(() =>
        [...document.querySelectorAll('button')].some(
          (b) => b.textContent === 'Salvar' && !b.disabled,
        ),
      );
      await click(p, 'Salvar');
      await p.waitForFunction(() =>
        [...document.querySelectorAll('button')].some(
          (b) => b.textContent === 'Editar',
        ),
      );
      assert.match(
        await p.$eval('.admin-notice', (e) => e.textContent),
        /salvas no rascunho/,
      );
      assert.equal(
        await p.$eval('iframe', (e) => e.src.includes('edit=1')),
        false,
      );
      f.holdFeed();
      frame = await start(p, f);
      await change(frame);
      const iframeUrl = await p.$eval('iframe', (e) => e.src);
      f.data.site.previewRevision += '-external';
      f.releaseFeed();
      await p.waitForFunction(() =>
        document.body.textContent.includes('O site mudou em outra operação'),
      );
      assert.equal(await p.$eval('iframe', (e) => e.src), iframeUrl);
      assert.equal(
        await frame.$eval('[data-field="headline"]', (e) => e.textContent),
        'Escolha os materiais da casa',
      );
      let dialogs = 0;
      p.once('dialog', async (d) => {
        dialogs++;
        await d.dismiss();
      });
      await click(p, 'Cancelar');
      assert.equal(dialogs, 1);
      assert.equal(
        await p.$eval('iframe', (e) => e.src.includes('edit=1')),
        true,
      );
      p.once('dialog', (d) => d.accept());
      await click(p, 'Cancelar');
      await p.waitForFunction(
        () => !document.querySelector('iframe')?.src.includes('edit=1'),
      );
      for (const status of [422, 409]) {
        f.setEditStatus(status);
        frame = await start(p, f);
        await change(frame);
        await p.waitForFunction(() =>
          [...document.querySelectorAll('button')].some(
            (b) => b.textContent === 'Salvar' && !b.disabled,
          ),
        );
        await click(p, 'Salvar');
        await p.waitForFunction(() =>
          document.querySelector('.admin-notice[data-tone="err"]'),
        );
        assert.equal(
          await p.$eval('iframe', (e) => e.src.includes('edit=1')),
          true,
        );
        if (status === 422) {
          await frame.waitForSelector(
            '[data-field="headline"][aria-invalid="true"]',
          );
          p.once('dialog', (d) => d.accept());
          await click(p, 'Cancelar');
        } else {
          assert.match(
            await p.$$eval('.admin-notice', (n) =>
              n.map((e) => e.textContent).join(' '),
            ),
            /Recarregar a prévia/,
          );
          p.once('dialog', (d) => d.accept());
          await click(p, 'Recarregar a prévia');
        }
      }
      f.setEditStatus(200);
      assert.deepEqual(errors, []);
      await p.close();
    }
    assert.ok(f.editWrites.length >= 6);
    const p = await navigationPage(b);
    await p.goto(f.base + '/admin/studio-corda');
    await p.waitForSelector('.admin-workspace');
    assert.equal(
      await p.$$eval('button', (buttons) =>
        buttons.some((b) => b.textContent === 'Editar'),
      ),
      false,
    );
  },
);
