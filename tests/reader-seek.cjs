// Run with Node and Playwright: node tests/reader-seek.cjs [entry URL]
const assert = require('node:assert/strict');
const path = require('node:path');
const {after, before, test} = require('node:test');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const entry = new URL(process.argv[2] || pathToFileURL(path.resolve(__dirname, '../index.html')));
entry.searchParams.set('sample', 'd-opsd');
let browser;
before(async () => {
  browser = await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
});
after(async () => { await browser?.close(); });

for (const width of [390, 1100]) {
  test(`the slider seeks and resumes by article position at ${width}px`, async () => {
    const page = await browser.newPage({viewport: {width, height: 800}});
    try {
      await page.goto(entry.href);
      await page.locator('#open-reader').click();
      const slider = page.getByRole('slider', {name: '阅读进度'});
      const counter = page.locator('.ks-counter');
      await slider.press('Home');
      const box = await slider.boundingBox();
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + 9, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, y, {steps: 5});
      const middle = Number(await slider.inputValue());
      assert.ok(middle > 1 && middle < Number(await slider.getAttribute('max')));
      assert.equal(await slider.getAttribute('aria-valuetext'), await counter.innerText());
      await page.mouse.move(box.x + box.width - 2, y, {steps: 4});
      await page.mouse.up();
      assert.ok(await page.locator('.ks-next').isDisabled(), 'dragging reaches the last page');
      const end = await counter.innerText();

      await slider.press('ArrowLeft');
      assert.notEqual(await counter.innerText(), end);
      await slider.press('End');
      assert.equal(await counter.innerText(), end);
      await page.reload();
      await page.locator('#open-reader').click();
      assert.equal(await counter.innerText(), end, 'seeking saves the article anchor');
      await slider.press('Home');
      assert.ok(await page.locator('.ks-prev').isDisabled());
      await slider.press('ArrowRight');
      assert.match(await counter.innerText(), width > 700 ? /^第 3–4 \/ / : /^第 2 \/ /);
      const start = await page.locator('.ks-leaf:visible [data-ks-block]').first().evaluate(el =>
        ({block: el.dataset.ksBlock, offset: Number(el.dataset.ksOffset)}));
      await page.locator('.ks-larger').click();
      await page.setViewportSize({width: width > 700 ? 390 : 1100, height: 800});
      await page.waitForFunction(({block, offset}) => {
        const pieces = document.querySelectorAll('.ks-leaf [data-ks-block="'+block+'"]');
        return [...pieces].some(el => el.getClientRects().length &&
          Number(el.dataset.ksOffset) <= offset && offset <= Number(el.dataset.ksOffset) + el.textContent.length);
      }, start);
      assert.equal(await slider.getAttribute('aria-valuetext'), await counter.innerText());
    } finally { await page.close(); }
  });
}

test('a short answer shows one page with seeking disabled', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(entry.href);
    await page.locator('#article-body').evaluate(body => {
      const paragraph = document.createElement('p');
      paragraph.textContent = '这一篇只占一页。';
      body.replaceChildren(paragraph);
    });
    await page.locator('#open-reader').click();
    const slider = page.getByRole('slider', {name: '阅读进度'});
    assert.ok(await slider.isDisabled());
    assert.equal(await slider.getAttribute('aria-valuetext'), '第 1 / 1 页');
  } finally { await page.close(); }
});
