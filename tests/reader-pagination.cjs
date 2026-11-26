// Run with Node and Playwright: node tests/reader-pagination.cjs [entry URL]
// Set CHROME_PATH to exercise a local Chrome installation.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');

const entry = process.argv[2] || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const cases = [
  { sample: 'd-opsd', width: 1024, height: 768, fontSize: 24 },
  { sample: 'd-opsd', width: 960, height: 650, fontSize: 20 },
  { sample: 'su-yang', width: 1440, height: 880, fontSize: 19 },
];

let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    // Exercise the normal desktop scrollbar gutter even in headless Chrome.
    ignoreDefaultArgs: ['--hide-scrollbars'],
  });
});
after(async () => { await browser?.close(); });

test('mirroring reverses the companion movement and preserves the page order', async () => {
  const page = await browser.newPage({viewport: {width: 1024, height: 768}, reducedMotion: 'no-preference'});
  try {
    const url = new URL(entry);
    url.searchParams.set('sample', 'article-630130227');
    await page.goto(url.href);
    await page.locator('#open-reader').click();
    for (const mirrored of [false, true]) {
      if (mirrored) {
        await page.locator('.ks-pet-button').click();
        await page.locator('.ks-pet-customize').click();
        await page.locator('.ks-pet-mirror').click();
        await page.locator('.ks-pet-button').click();
      }
      for (const reminder of [false, true]) {
        for (const [arrow, direction] of [['.ks-next', 1], ['.ks-prev', -1]]) {
          if (reminder) {
            await page.locator('.ks-pet-button').click();
            await page.locator('.ks-pet-preview').click();
          }
          await page.locator(arrow).click();
          const shift = await page.locator('.ks-pet .ks-fox-motion').evaluate((motion, hop) => {
            // Compare the same point on the sprite at rest and at peak travel in screen coordinates.
            const action = hop ? 'ks-happy-hop' : 'ks-turn-toward-page';
            const animation = motion.getAnimations().find(a => a.animationName === action);
            animation.pause();
            const svg = motion.ownerSVGElement;
            const foot = new DOMPoint(svg.viewBox.baseVal.width * .5, svg.viewBox.baseVal.height * .89);
            animation.currentTime = 0;
            const rest = foot.matrixTransform(motion.getScreenCTM()).x;
            animation.currentTime = hop ? 640 * .44 : 450 * .45;
            return foot.matrixTransform(motion.getScreenCTM()).x - rest;
          }, reminder);
          const screenDirection = mirrored ? -direction : direction;
          assert.ok(screenDirection * shift > 1, `screen offset ${shift}; mirror=${mirrored}, direction=${direction}`);
          assert.match(await page.locator('.ks-counter').innerText(), direction === 1 ? /^第 3–4 \/ / : /^第 1–2 \/ /);
        }
      }
    }
  } finally { await page.close(); }
});

for (const { sample, width, height, fontSize } of cases) {
  test(`${sample} at ${width}×${height}, ${fontSize}px keeps the spread stable`, async () => {
    const context = await browser.newContext({ viewport: { width, height } });
    try {
      await context.addInitScript(size => localStorage.setItem('kanshan.reader.font-size', size), String(fontSize));
      const page = await context.newPage();
      const url = new URL(entry);
      url.searchParams.set('sample', sample);
      await page.goto(url.href);
      await page.locator('#open-reader').click();

      const counter = page.locator('.ks-counter');
      const next = page.locator('.ks-next');
      const previous = page.locator('.ks-prev');
      assert.equal(await page.locator('.ks-font output').innerText(), fontSize + ' px');
      assert.match(await counter.innerText(), /^第 1–2 \/ \d+ 页$/);
      for (const start of [3, 5, 7]) {
        await next.click();
        assert.match(await counter.innerText(), new RegExp('^第 ' + start + '–' + (start + 1) + ' / '));
      }

      // Let freshly displayed media and the page-turn animation finish first.
      await page.locator('.ks-reader img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(350);
      const spread = await counter.innerText();
      assert.match(spread, /^第 7–8 \/ \d+ 页$/);
      const pages = page.locator('.ks-leaf .ks-body');
      const content = await pages.allTextContents();
      assert.equal(content.length, 2);
      assert.ok(content.every(text => text.trim().length > 0));

      // An idle pagination loop can repeatedly write exactly the same counter text.
      const repaints = await counter.evaluate(async element => {
        let writes = 0;
        const observer = new MutationObserver(records => { writes += records.length; });
        observer.observe(element, { childList: true, characterData: true, subtree: true });
        await new Promise(resolve => setTimeout(resolve, 1200));
        observer.disconnect();
        return writes;
      });
      assert.equal(repaints, 0, 'counter rewrites while idle on pages 7–8');
      assert.equal(await counter.innerText(), spread);
      await previous.click();
      assert.match(await counter.innerText(), /^第 5–6 \/ /);
      await next.click();
      assert.equal(await counter.innerText(), spread);
      assert.deepEqual(await pages.allTextContents(), content);
    } finally {
      await context.close();
    }
  });
}
