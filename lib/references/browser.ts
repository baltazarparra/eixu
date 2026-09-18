/** Chromium local em desenvolvimento e binário serverless na Vercel. */
export async function launchBrowser(extraArgs: string[] = []) {
  const puppeteer = await import('puppeteer-core');
  const local = process.env.EIXU_CHROME_PATH;
  if (local)
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        ...extraArgs,
      ],
    });
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, ...extraArgs],
    defaultViewport: null,
    headless: true,
  });
}
