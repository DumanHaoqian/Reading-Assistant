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
    await settings.getByRole('button', {name: '摸摸头'}).click();
    assert.ok(await settings.isHidden());
    assert.equal(await page.locator('.ks-pet').getAttribute('data-pose'), 'nuzzle');
    await page.waitForFunction(() => document.querySelector('.ks-pet').dataset.pose === 'idle');

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

async function center(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, 'the pet is visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragPet(page, locator, x, y) {
  const start = await center(locator);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
}

function expectNear(actual, expected, tolerance = 3) {
  for (const axis of ['x', 'y']) {
    assert.ok(Math.abs(actual[axis] - expected[axis]) <= tolerance,
      `${axis}: expected ${actual[axis]} to be within ${tolerance} of ${expected[axis]}`);
  }
}

async function expectInsideViewport(page, locator) {
  await locator.waitFor({ state: 'visible', timeout: 2500 });
  const box = await locator.boundingBox();
  const { width, height } = page.viewportSize();
  assert.ok(box && box.x >= -1 && box.y >= -1 &&
    box.x + box.width <= width + 1 && box.y + box.height <= height + 1,
    `cropped control in ${width}×${height}: ${JSON.stringify(box)}`);
}

test('both pets move across the viewport, retain separate positions and accept keyboard moves', async () => {
  const context = await browser.newContext({ viewport: { width: 1030, height: 740 } });
  try {
    const page = await context.newPage();
    await page.goto(entry.href);
    const sourcePet = page.locator('#open-reader'), bookPet = page.locator('.ks-pet-button');
    await dragPet(page, sourcePet, 380, 240);
    expectNear(await center(sourcePet), {x: 380, y: 240});
    assert.ok(await page.locator('.ks-reader').isHidden());
    await sourcePet.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    const sourcePosition = await center(sourcePet);
    assert.ok(sourcePosition.x < 378 && sourcePosition.y < 238);
    await page.keyboard.press('Enter');
    await bookPet.waitFor();
    await dragPet(page, bookPet, 700, 420);
    expectNear(await center(bookPet), {x: 700, y: 420});
    assert.ok(await page.locator('.ks-pet-panel').isHidden(), 'drag must not toggle settings');
    const counter = await page.locator('.ks-counter').textContent();
    await bookPet.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await page.keyboard.press('Alt+ArrowDown');
    const bookPosition = await center(bookPet);
    assert.ok(bookPosition.x > 702 && bookPosition.y > 422);
    assert.equal(await page.locator('.ks-counter').textContent(), counter);
    await page.locator('.ks-exit').click();
    await page.reload();
    expectNear(await center(sourcePet), sourcePosition);
    await sourcePet.click();
    expectNear(await center(bookPet), bookPosition);
    await page.setViewportSize({width: 750, height: 570});
    await page.waitForFunction(() => document.querySelector('.ks-pet-button').getBoundingClientRect().x < 570);
    expectNear(await center(bookPet), {x: bookPosition.x * 750 / 1030, y: bookPosition.y * 570 / 740}, 16);
    for (const [x, y] of [[1, 1], [749, 1], [749, 569], [1, 569]]) {
      await dragPet(page, bookPet, x, y);
      expectNear(await center(bookPet), {x, y}, 62);
      await expectInsideViewport(page, bookPet);
      await bookPet.click();
      await expectInsideViewport(page, page.locator('.ks-pet-panel'));
      await page.locator('.ks-pet-preview').click();
      await expectInsideViewport(page, page.locator('.ks-pet-bubble'));
      await page.locator('.ks-pet-dismiss').click();
    }
  } finally { await context.close(); }
});

test('both eyes track the pointer on each surface and retain their direction when it stops', async () => {
  const context = await browser.newContext({viewport: {width: 1120, height: 800}});
  try {
    const page = await context.newPage();
    await page.goto(entry.href);
    // Measure the visible pupil inside each eye; moving or tilting the entire
    // character would leave these offsets unchanged.
    function eyesLookToward({host, signX, signY}) {
      const eyes = Array.from(document.querySelectorAll(host + ' .ks-fox-eye'));
      return eyes.length === 2 && eyes.every(eye => {
        const sclera = eye.querySelector('.ks-fox-sclera').getBoundingClientRect();
        const pupil = eye.querySelector('.ks-fox-pupil ellipse').getBoundingClientRect();
        if (!sclera.width || !sclera.height || !pupil.width || !pupil.height) return false;
        const x = (pupil.left + pupil.width / 2 - sclera.left) / sclera.width - .5;
        const y = (pupil.top + pupil.height / 2 - sclera.top) / sclera.height - .5;
        return Math.abs(x) < .5 && Math.abs(y) < .5 &&
          (!signX || x * signX > .035) && (!signY || y * signY > .035);
      });
    }
    for (const [host, button, x, y] of [
      ['#open-reader', '#open-reader', 630, 490],
      ['.ks-pet', '.ks-pet-button', 330, 230],
    ]) {
      const handle = page.locator(button);
      await dragPet(page, handle, x, y);
      for (const [signX, signY] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        await page.mouse.move(x + 220 * signX, y + 170 * signY);
        await page.waitForFunction(eyesLookToward, {host, signX, signY}, {timeout: 2000});
      }
      // Wait beyond the landing/greeting animations without moving the pointer.
      await page.waitForTimeout(850);
      assert.ok(await page.evaluate(eyesLookToward, {host, signX: 1, signY: 1}));
      // The pointer stays still while the character moves past it via the keyboard.
      const position = await center(handle);
      await handle.focus();
      await page.mouse.move(position.x + 50, position.y - 65);
      await page.waitForFunction(eyesLookToward, {host, signX: 1, signY: -1}, {timeout: 2000});
      const right = host === '#open-reader' ? 'Shift+ArrowRight' : 'Alt+Shift+ArrowRight';
      for (let index = 0; index < 3; index++) await page.keyboard.press(right);
      await page.waitForFunction(eyesLookToward, {host, signX: -1, signY: -1}, {timeout: 2000});
      if (host === '#open-reader') await handle.click();
    }
  } finally { await context.close(); }
});

test('real touch drags move vertically without opening, scrolling or turning a page', async () => {
  const context = await browser.newContext({viewport: {width: 390, height: 740}, isMobile: true, hasTouch: true});
  try {
    const page = await context.newPage();
    const input = await context.newCDPSession(page);
    async function stroke(locator, to, cancel = false) {
      const start = await center(locator);
      const send = (type, points) => input.send('Input.dispatchTouchEvent', {type, touchPoints: points});
      await send('touchStart', [start]);
      await send('touchMove', [{x: (start.x + to.x) / 2, y: (start.y + to.y) / 2}]);
      await send('touchMove', [to]);
      await send(cancel ? 'touchCancel' : 'touchEnd', []);
    }
    await page.goto(entry.href);
    const sourcePet = page.locator('#open-reader'), bookPet = page.locator('.ks-pet-button');
    await stroke(sourcePet, {x: 110, y: 265});
    expectNear(await center(sourcePet), {x: 110, y: 265}, 5);
    assert.equal(await page.evaluate(() => scrollY), 0);
    assert.ok(await page.locator('.ks-reader').isHidden());
    await stroke(sourcePet, {x: 230, y: 490}, true);
    expectNear(await center(sourcePet), {x: 110, y: 265}, 5);
    await sourcePet.tap();
    const counter = await page.locator('.ks-counter').textContent();
    await stroke(bookPet, {x: 90, y: 115});
    expectNear(await center(bookPet), {x: 90, y: 115}, 5);
    assert.equal(await page.locator('.ks-counter').textContent(), counter);
    assert.ok(await page.locator('.ks-pet-panel').isHidden());
    await bookPet.tap();
    await expectInsideViewport(page, page.locator('.ks-pet-panel'));
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
