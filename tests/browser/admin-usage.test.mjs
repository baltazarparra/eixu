import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';

await test(
  'Dados: consumo em desktop/mobile, filtros, paginação e estados sem valor',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const jiti = createJiti(import.meta.url, {
      alias: { '@': process.cwd() },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { UsageHistoryPanel } = await jiti.import(
      '../../components/admin/usage-history.tsx',
    );
    const { usageFilters } = await jiti.import(
      '../../lib/admin/usage-history.ts',
    );
    const chunks = '.next/static/chunks';
    const css = (
      await Promise.all(
        (
          await readdir(chunks)
        )
          .filter((name) => name.endsWith('.css'))
          .map((name) => readFile(`${chunks}/${name}`, 'utf8')),
      )
    )
      .filter((text) => text.includes('.admin-consumption'))
      .join('\n');
    assert.ok(css.includes('.admin-consumption'));
    const numbers = {
      calls: 2,
      inputTokens: 150_020,
      outputTokens: 12_800,
      totalTokens: 162_820,
      cacheReadTokens: 90_000,
      cacheWriteTokens: 2_000,
      reasoningTokens: 4_000,
      costUsd: 0.123456,
      missingInput: 0,
      missingOutput: 0,
      missingTotal: 0,
      missingCache: 0,
      missingCacheWrite: 0,
      missingReasoning: 0,
      missingCost: 0,
      pending: 0,
      failed: 0,
      legacy: 0,
    };
    const server = createServer((request, response) => {
      const url = new URL(request.url, 'http://fixture.test');
      if (url.pathname.startsWith('/_next/static/media/')) {
        readFile(`.next/static/media/${url.pathname.split('/').at(-1)}`).then(
          (data) => response.end(data),
          () => {
            response.statusCode = 404;
            response.end();
          },
        );
        return;
      }
      const empty = url.searchParams.get('start') === '2020-01-01';
      const page = Number(url.searchParams.get('usagePage') ?? 1);
      const data = {
        totals: empty
          ? { ...numbers, calls: 0 }
          : { ...numbers, missingCost: 1, calls: 4 },
        totalRows: empty ? 0 : 21,
        page,
        pages: 2,
        firstRecordedAt: '2026-09-01T15:00:00Z',
        rows: empty
          ? []
          : [
              {
                ...numbers,
                operationId:
                  page === 1 ? 'operation-conversa-123' : 'operation-pagina-2',
                kind: 'conversa',
                model: 'google/gemini-3.8-flash',
                phase: null,
                runId: null,
                createdAt: '2026-09-15T15:00:00Z',
              },
              {
                ...numbers,
                calls: 1,
                operationId: 'image-123',
                kind: 'imagem',
                model: 'openai/gpt-image-2',
                totalTokens: null,
                inputTokens: null,
                outputTokens: null,
                missingTotal: 1,
                missingInput: 1,
                missingOutput: 1,
                costUsd: null,
                missingCost: 1,
                pending: 1,
                phase: null,
                runId: null,
                createdAt: '2026-09-15T14:30:00Z',
              },
            ],
        daily: [{ ...numbers, day: '2026-09-15' }],
      };
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="admin-page admin-settings-page">${renderToStaticMarkup(createElement(UsageHistoryPanel, { data, filters: usageFilters(Object.fromEntries(url.searchParams)), slug: 'fixture' }))}</main></body></html>`,
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const base = `http://127.0.0.1:${server.address().port}/admin/fixture/dados`;
    await mkdir('outputs/usage-history', { recursive: true });
    for (const [width, height] of [
      [1440, 1000],
      [390, 844],
      [320, 568],
      [844, 390],
    ]) {
      await page.setViewport({ width, height });
      await page.goto(base, { waitUntil: 'networkidle0' });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow em ${width}x${height}`,
      );
      assert.ok(
        (await page.$eval('body', (element) => element.innerText)).includes(
          'Parcial',
        ),
      );
      const summary = await page.$('.admin-consumption-details summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(
        await page.$eval(
          '.admin-consumption-details',
          (element) => element.open,
        ),
        true,
      );
      assert.ok(
        (
          await page.$eval(
            '.admin-consumption-details',
            (element) => element.innerText,
          )
        ).includes('operation-conversa-123'),
      );
      await page.click('.admin-consumption-daily summary');
      assert.equal(
        await page.$eval('.admin-consumption-daily', (element) => element.open),
        true,
      );
      const target = await page.$eval(
        '.admin-consumption-presets a',
        (element) => {
          const rect = element.getBoundingClientRect();
          return { height: rect.height, width: rect.width };
        },
      );
      assert.ok(target.height >= 40 && target.width >= 40);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `outputs/usage-history/${width}.png`,
          fullPage: true,
        });
    }
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(base);
    await Promise.all([
      page.waitForNavigation(),
      page.click('a[href*="period=all"]'),
    ]);
    assert.ok(page.url().includes('period=all'));
    await Promise.all([
      page.waitForNavigation(),
      page.click('a[href*="usagePage=2"]'),
    ]);
    assert.ok(
      (await page.$eval('body', (element) => element.innerText)).includes(
        'Página 2 de 2',
      ),
    );
    assert.ok(page.url().includes('period=all'));
    await page.$eval('input[name=start]', (element) => {
      element.value = '2020-01-01';
    });
    await page.$eval('input[name=end]', (element) => {
      element.value = '2020-01-02';
    });
    await Promise.all([
      page.waitForNavigation(),
      page.click('button[type=submit]'),
    ]);
    assert.ok(
      (await page.$eval('body', (element) => element.innerText)).includes(
        'Nenhum consumo registrado',
      ),
    );
    assert.ok(!page.url().includes('usagePage'));
    await page.goto(`${base}?start=2026-02-30&end=2026-03-01`);
    assert.ok(
      (
        await page.$eval('[role=alert]', (element) => element.innerText)
      ).includes('Confira as datas'),
    );
  },
);
