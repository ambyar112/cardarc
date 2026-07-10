import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  await context.addInitScript(() => {
    const provider = {
      isMetaMask: true, isConnected: () => true,
      request: ({ method, params }) => new Promise((resolve) => {
        setTimeout(() => {
          if (method === 'eth_accounts' || method === 'eth_requestAccounts') return resolve(['0x665ec4E48D14978304Ea80962391009833DB8A82']);
          if (method === 'eth_chainId') return resolve('0x4cef52');
          resolve('0x');
        }, 50);
      }),
      send: () => Promise.resolve('0x4cef52'),
      on: () => {}, removeListener: () => {}
    };
    if (!window.ethereum) Object.defineProperty(window, 'ethereum', { value: provider, writable: true });
    else Object.assign(window.ethereum, provider);
  });

  const page = await context.newPage();
  const outDir = '/tmp/cardarc-mobile-blank';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('https://cardarc.vercel.app/marketplace', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/01-marketplace.png`, fullPage: true });

  await page.click('button:has-text("CONNECT WALLET")');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/02-after-connect.png`, fullPage: true });

  await page.click('button:has-text("Sell Cards")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/03-sell-tab.png`, fullPage: true });

  const cardSelector = '[class*="cursor-pointer"]:has(img)';
  const cards = await page.$$(cardSelector).catch(() => []);
  if (cards.length) {
    await cards[0].click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${outDir}/04-after-card-click.png`, fullPage: true });
  } else {
    console.log('no cards found');
  }

  const w3m = await page.$('w3m-modal.open').catch(() => null);
  console.log('w3m-open', !!w3m);

  await browser.close();
})();
