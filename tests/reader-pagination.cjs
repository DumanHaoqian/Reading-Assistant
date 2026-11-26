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

async function pauseAnimationClock(page) {
  // Install before the page attaches its timers. Each observation then samples
  // one known point on the actual animation, irrespective of the test runner's load.
  await page.clock.install({time: new Date('2026-01-01T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
}

async function paperAfter(page, milliseconds) {
  await page.clock.runFor(milliseconds);
  return page.locator('.ks-pet-button .ks-book-sheet').evaluate(leaf => {
    const spine = leaf.closest('.ks-fox-book').querySelector('.ks-book-spine');
    const motion = leaf.closest('.ks-fox-motion');
    const bounds = motion.ownerSVGElement.viewBox.baseVal;
    const foot = new DOMPoint(bounds.width / 2, bounds.height * .89);
    const paper = leaf.getBoundingClientRect(), gutter = spine.getBoundingClientRect();
    if (!paper.width) return null;
    return {
      x: (paper.left + paper.right - gutter.left - gutter.right) / 2,
      lift: gutter.top - paper.top,
      footX: foot.matrixTransform(motion.getScreenCTM()).x,
    };
  });
}

test('the sheet crosses the binding in both directions and mirrors with the companion', async () => {
  const page = await browser.newPage({viewport: {width: 1024, height: 768}, reducedMotion: 'no-preference'});
  try {
    const url = new URL(entry);
    url.searchParams.set('sample', 'article-630130227');
    await pauseAnimationClock(page);
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
          const screenDirection = mirrored ? -direction : direction;
          if (reminder) {
            const shift = await page.locator('.ks-pet .ks-fox-motion').evaluate(motion => {
              const hop = motion.getAnimations().find(a => a.animationName === 'ks-happy-hop');
              hop.pause();
              const bounds = motion.ownerSVGElement.viewBox.baseVal;
              const foot = new DOMPoint(bounds.width * .5, bounds.height * .89);
              hop.currentTime = 0;
              const rest = foot.matrixTransform(motion.getScreenCTM()).x;
              hop.currentTime = hop.effect.getTiming().duration * .44;
              return foot.matrixTransform(motion.getScreenCTM()).x - rest;
            });
            assert.ok(screenDirection * shift > 1, 'the celebration hop follows the facing direction');
          } else {
            const start = await paperAfter(page, 170);
            const middle = await paperAfter(page, 320);
            const end = await paperAfter(page, 340);
            assert.ok(start && middle && end, 'a sheet is visible at pickup, mid-turn and landing');
            assert.ok(start.x * screenDirection > 1 && end.x * screenDirection < -1, 'one sheet travels across the binding');
            assert.ok(middle.lift > Math.max(start.lift, end.lift) + 3, 'the page lifts off the spread');
            const feet = [start.footX, middle.footX, end.footX];
            assert.ok(Math.max(...feet) - Math.min(...feet) < 1, 'the feet stay planted as the paper moves');
            assert.equal(await paperAfter(page, 250), null, 'the leaf has settled before another turn');
          }
          assert.match(await page.locator('.ks-counter').innerText(), direction === 1 ? /^第 3–4 \/ / : /^第 1–2 \/ /);
        }
      }
    }
  } finally { await page.close(); }
});

test('quickly turning back lays the lifted sheet down without starting a second flip', async () => {
  const page = await browser.newPage({viewport: {width: 1024, height: 768}, reducedMotion: 'no-preference'});
  try {
    const url = new URL(entry);
    url.searchParams.set('sample', 'article-2082792378637758790');
    await pauseAnimationClock(page);
    await page.goto(url.href);
    await page.locator('#open-reader').click();
    const counter = page.locator('.ks-counter');
    const first = await counter.innerText();
    await page.locator('.ks-next').click();
    assert.notEqual(await counter.innerText(), first);
    const raised = await paperAfter(page, 560);
    assert.ok(raised && raised.x < 0, 'the sheet is above the far side of the binding');
    await page.locator('.ks-prev').click();
    assert.equal(await counter.innerText(), first);
    const reversing = await paperAfter(page, 40);
    const landing = await paperAfter(page, 440);
    assert.ok(reversing && landing && landing.x > 1, 'the same sheet returns to the original side');
    assert.ok(reversing.lift > landing.lift + 3, 'the reversing sheet stays lifted at the change of direction');
    assert.equal(await paperAfter(page, 200), null, 'the reversed sheet has settled');
    assert.ok(await page.locator('.ks-pet-button .ks-fox-book').isVisible());
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
