import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { handoffFixture } from '../helpers/admin-handoff-fixture.mjs';

await test(
  'Premium: confirma a URL, reserva a conversão e bloqueia o gerador',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const fixtures = [];
    t.after(async () => {
      await browser.close();
      for (const fixture of fixtures) await fixture.server.close();
    });
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const fixture = await handoffFixture();
      fixtures.push(fixture);
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewport(viewport);
      await page.goto(`${fixture.base}/admin/marcenaria-horizonte`, {
        waitUntil: 'networkidle0',
      });
      await page.waitForSelector('button');
      const premium = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some(
          (button) => button.textContent.trim() === 'Premium',
        ),
      );
      assert.equal(premium, true);

      page.once('dialog', async (dialog) => {
        assert.match(dialog.message(), /mesma URL|será preservado/i);
        assert.match(dialog.message(), /rascunho/i);
        await dialog.accept();
      });
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find(
          (item) => item.textContent.trim() === 'Premium',
        );
        button.click();
      });
      await page.waitForFunction(() =>
        document.body.textContent.includes('Conversão Premium em andamento'),
      );
      assert.match(
        await page.evaluate(() => document.body.textContent),
        /versão publicada continua na URL original.*gerador está bloqueado/s,
      );
      assert.equal(
        await page.evaluate(() =>
          [...document.querySelectorAll('button')].some(
            (button) => button.textContent.trim() === 'Publicar',
          ),
        ),
        false,
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
  },
);
