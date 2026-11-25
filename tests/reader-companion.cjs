// node tests/reader-companion.cjs [entry URL], with Playwright and optional CHROME_PATH.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const entry = new URL(process.argv[2] || pathToFileURL(path.resolve(__dirname, '../index.html')));
entry.searchParams.set('sample', 'su-yang');
let browser;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
});
after(async () => { await browser?.close(); });

async function openBook(page) {
  await page.goto(entry.href);
  await page.locator('#open-reader').click();
  await page.locator('.ks-reader[open] .ks-pet-button').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function expectOutsideText(page, selector) {
  const blocking = await page.locator(selector).evaluate(el => {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return 'attribute reports visible but box is empty';
    if (rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1) {
      return 'outside viewport';
    }
    for (const body of document.querySelectorAll('.ks-leaf .ks-body')) {
      if (!body.getClientRects().length) continue;
      const text = body.getBoundingClientRect();
      if (rect.left < text.right && rect.right > text.left && rect.top < text.bottom && rect.bottom > text.top) {
        return 'overlaps a reading column';
      }
    }
    return null;
  });
  assert.equal(blocking, null, selector);
}

test('pet settings, preview and an actual page turn work without disrupting book controls', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    await openBook(page);
    const pet = page.locator('.ks-pet-button');
    const settings = page.locator('.ks-pet-panel');
    const bubble = page.locator('.ks-pet-bubble');
    const pop = page.locator('.ks-pet-pop');
    const counter = page.locator('.ks-counter');
    const first = await counter.textContent();
    await expectOutsideText(page, '.ks-pet-button');
    await pet.click();
    assert.ok(await settings.isVisible());
    assert.equal(await settings.locator('.ks-pet-reminders').getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('ArrowRight');
    assert.equal(await counter.textContent(), first);
    await page.keyboard.press('Escape');
    assert.ok(await settings.isHidden());
    assert.ok(await page.locator('.ks-reader[open]').isVisible());
    assert.ok(await pet.evaluate(el => document.activeElement === el));

    await pet.click();
    await settings.locator('.ks-pet-resume').click();
    assert.equal(await page.locator('.ks-follow').getAttribute('aria-pressed'), 'true');
    assert.ok(await settings.isHidden());
    await pet.click();
    await settings.locator('.ks-pet-preview').click();
    await bubble.waitFor();
    await expectOutsideText(page, '.ks-pet-bubble');
    await page.locator('.ks-next').click();
    assert.notEqual(await counter.textContent(), first);
    assert.ok(await bubble.isHidden());
    assert.ok(await pop.isVisible(), 'the user sees a pop on the same turn');
    assert.equal(await page.locator('.ks-pet').getAttribute('data-pose'), 'hop');
    await pop.waitFor({ state: 'hidden' });
    await page.locator('.ks-prev').click();
    assert.ok(await pop.isHidden(), 'ordinary turns do not burst an absent bubble');
    await pet.click();
    await settings.locator('.ks-pet-preview').click();
    await bubble.locator('.ks-pet-dismiss').click();
    assert.ok(await bubble.isHidden());
    await page.locator('.ks-contents-toggle').click();
    await page.locator('.ks-contents-list button').last().click();
    assert.notEqual(await counter.textContent(), first);
    await page.locator('.ks-exit').click();
    assert.ok(await page.locator('.ks-reader').isHidden());
    assert.ok(await page.locator('#open-reader').isVisible());
  } finally { await context.close(); }
});

test('dragging the pet docks it without opening the book, keyboard still works', async () => {
  const context = await browser.newContext({ viewport: { width: 1030, height: 740 } });
  try {
    const page = await context.newPage();
    await page.goto(entry.href);
    const sourcePet = page.locator('#open-reader');
    const rect = await sourcePet.boundingBox();
    const y = rect.y + rect.height / 2;
    await page.mouse.move(rect.x + rect.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(50, y, { steps: 12 });
    await page.mouse.up();
    assert.ok(await page.locator('.ks-reader').isHidden());
    assert.equal(await page.locator('html').getAttribute('data-ks-pet-dock'), 'left');
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-ks-pet-dock'), 'left');
    await sourcePet.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('html').getAttribute('data-ks-pet-dock'), 'right');
    await page.keyboard.press('Enter');
    await page.locator('.ks-reader[open]').waitFor();
  } finally { await context.close(); }
});

test('small screens and reduced motion keep both the reminder and reading controls usable', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await openBook(page);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 740 });
      await expectOutsideText(page, '.ks-pet-button');
      await page.locator('.ks-pet-button').click();
      assert.equal(await page.locator('.ks-pet-quiet').getAttribute('aria-pressed'), 'true');
      await page.locator('.ks-pet-preview').click();
      await page.locator('.ks-pet-bubble').waitFor();
      await expectOutsideText(page, '.ks-pet-bubble');
      await page.locator('.ks-next').click();
      assert.ok(await page.locator('.ks-pet-bubble').isHidden());
      assert.ok(await page.locator('.ks-pet-pop').isHidden(), 'reduced motion still acknowledges the turn');
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('.ks-pet-button').click();
    await page.locator('.ks-pet-quiet').click();
    assert.equal(await page.locator('.ks-pet-quiet').getAttribute('aria-pressed'), 'true');
    await openBook(page);
    await page.locator('.ks-pet-button').click();
    assert.equal(await page.locator('.ks-pet-quiet').getAttribute('aria-pressed'), 'true');
  } finally { await context.close(); }
});

test('focus reminders count foreground reading time and the visible spread, once per page', async () => {
  const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
  try {
    const page = await context.newPage();
    await page.clock.install();
    await openBook(page);
    const bubble = page.locator('.ks-pet-bubble');
    await page.clock.fastForward(600000);
    assert.ok(await bubble.isHidden(), 'a reminder requires opt-in');
    await page.locator('.ks-pet-button').click();
    await page.locator('.ks-pet-reminders').click();
    // Browsers in headless mode keep tabs visible. Deliver the same visibility events
    // that backgrounding and foregrounding the document would produce.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    if (await page.locator('.ks-pet-panel').isVisible()) await page.keyboard.press('Escape');
    await page.clock.fastForward(600000);
    assert.ok(await bubble.isHidden(), 'time in a background tab does not count');
    await page.evaluate(() => {
      delete document.hidden;
      delete document.visibilityState;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const units = await page.locator('.ks-leaf:visible .ks-body').evaluateAll(bodies => {
      const text = bodies.map(body => body.innerText).join('\n');
      return (text.match(/\p{Script=Han}|[\p{Script=Latin}\p{N}]+/gu) || []).length;
    });
    assert.ok(units > 20);
    const duration = 120000 + Math.ceil(units * 60000 / 450);
    await page.clock.fastForward(duration - 2000);
    assert.ok(await bubble.isHidden(), 'reading estimate plus two full minutes of grace');
    await page.clock.fastForward(4000);
    assert.ok(await bubble.isVisible(), 'the deadline uses the current spread');
    await page.locator('.ks-pet-dismiss').click();
    await page.clock.fastForward(duration * 2);
    assert.ok(await bubble.isHidden(), 'dismissal silences the current spread');
    await page.locator('.ks-next').click();
    assert.ok(await bubble.isHidden());
    await page.clock.fastForward(600000);
    assert.ok(await bubble.isVisible(), 'a new page gets a fresh timer');
    await page.locator('.ks-exit').click();
    await openBook(page);
    await page.locator('.ks-pet-button').click();
    assert.equal(await page.locator('.ks-pet-reminders').getAttribute('aria-pressed'), 'true');
  } finally { await context.close(); }
});
