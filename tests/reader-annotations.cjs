// Run with Node and Playwright: node tests/reader-annotations.cjs [entry URL]
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const entry = process.argv[2] || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    ignoreDefaultArgs: ['--hide-scrollbars'],
  });
});
after(async () => { await browser?.close(); });

async function load(context, sample) {
  const url = new URL(entry);
  if (sample !== 'd-opsd') url.searchParams.set('sample', sample);
  const page = await context.newPage();
  await page.goto(url.href);
  await page.locator('#article-body img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  await page.evaluate(() => document.fonts.ready);
  return page;
}

for (const sample of ['d-opsd', 'su-yang', 'atr', 'lu-xun']) {
  test(sample + ' preserves every source block and marked passage through pagination', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 880 } });
    try {
      const page = await load(context, sample);
      const source = page.locator('#article-body');
      const original = await source.textContent();
      const plain = await context.newPage();
      await plain.addInitScript(() => Object.defineProperty(window, 'READING_HIGHLIGHTS', { get() { return {}; }, set() {} }));
      await plain.goto(page.url());
      assert.equal(await plain.locator('#article-body mark').count(), 0);
      assert.equal(original, await plain.locator('#article-body').textContent(), 'annotations preserve original text');
      await plain.close();
      const audit = await source.evaluate(article => {
        const marks = [...article.querySelectorAll('mark[data-ks-key]')];
        const forbidden = 'figure,figcaption,math,.formula,.equation,table,code,pre,.transcription-gap,.sample-sources';
        const invalid = marks.filter(mark => !mark.textContent.trim() || !mark.closest('p,li') ||
          mark.closest(forbidden) || mark.querySelector(forbidden) || mark.parentElement.closest('mark'));
        const paragraphs = new Set(marks.map(mark => mark.closest('p,li')).filter(Boolean));
        const broken = [...paragraphs].filter(paragraph => {
          const pieces = [...paragraph.querySelectorAll('mark[data-ks-key]')];
          const range = document.createRange();
          range.setStartBefore(pieces[0]);
          range.setEndAfter(pieces.at(-1));
          return new Set(pieces.map(mark => mark.dataset.ksKey)).size !== 1 ||
            range.toString() !== pieces.map(mark => mark.textContent).join('');
        });
        return { count: marks.length, unkeyed: article.querySelectorAll('mark:not([data-ks-key])').length,
          invalid: invalid.map(mark => mark.textContent), broken: broken.map(p => p.textContent) };
      });
      assert.ok(audit.count > 0, 'source has semantic marks');
      assert.equal(audit.unkeyed, 0);
      assert.deepEqual(audit.invalid, []);
      assert.deepEqual(audit.broken, []);
      await page.locator('#open-reader').click();
      assert.equal(await page.locator('.ks-follow').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('.ks-mark').getAttribute('aria-pressed'), 'true');

      // Rebuild the entire book, tracking each marked UTF-16 interval across page breaks.
      const errors = await page.evaluate(() => {
        const blocks = [...document.querySelector('#article-body').children].filter(el => !el.hidden &&
          !el.matches('script,style,template,button') && el.getClientRects().length);
        const text = blocks.map(() => '');
        function intervals(block) {
          const result = [];
          for (const mark of block.querySelectorAll('mark[data-ks-key]')) {
            const range = document.createRange();
            range.selectNodeContents(block);
            range.setEndBefore(mark);
            result.push([range.toString().length, mark.textContent.length, mark.dataset.ksKey]);
          }
          return result;
        }
        const expected = blocks.map(block => {
          const keys = Array(block.textContent.length).fill(null);
          for (const [start, length, key] of intervals(block)) keys.fill(key, start, start + length);
          return keys;
        });
        const keys = blocks.map(() => []);
        const errors = [];
        const seen = new Set();
        for (;;) {
          const counter = document.querySelector('.ks-counter').textContent;
          if (seen.has(counter)) throw Error('Page failed to advance: ' + counter);
          seen.add(counter);
          for (const piece of document.querySelectorAll('.ks-leaf .ks-body > [data-ks-block]')) {
            if (!piece.getClientRects().length) continue;
            const index = Number(piece.dataset.ksBlock);
            const offset = Number(piece.dataset.ksOffset);
            if (text[index].length !== offset) errors.push('Missing or repeated characters at block ' + index);
            text[index] += piece.textContent;
            const slice = Array(piece.textContent.length).fill(null);
            for (const [start, length, key] of intervals(piece)) slice.fill(key, start, start + length);
            keys[index].push(...slice);
          }
          const next = document.querySelector('.ks-next');
          if (next.disabled) break;
          next.click();
        }
        for (const [index, block] of blocks.entries()) {
          if (text[index] !== block.textContent) errors.push('Text differs in block ' + index);
          if (keys[index].some((value, i) => value !== expected[index][i])) errors.push('Semantic emphasis differs in block ' + index);
        }
        return errors;
      });
      assert.deepEqual(errors, []);
      await page.locator('.ks-exit').click();
      assert.equal(await source.textContent(), original);
    } finally {
      await context.close();
    }
  });
}

function activeSentence(page) {
  return page.evaluate(() => {
    const ranges = [...(CSS.highlights.get('ks-follow-sentence') || [])];
    for (const range of ranges) {
      const leaf = range.startContainer.parentElement.closest('.ks-leaf');
      if (!leaf?.getClientRects().length || !range.getClientRects().length) throw Error('Stale or hidden sentence range');
    }
    return ranges.map(range => range.toString()).join('');
  });
}

// Use the actual position of one character, including when the phrase crosses an inline mark.
async function clickPhrase(page, phrase) {
  const point = await page.locator('.ks-leaf:visible .ks-body > p').evaluateAll((pieces, phrase) => {
    for (const piece of pieces) {
      let offset = piece.textContent.indexOf(phrase);
      if (offset < 0) continue;
      const walker = document.createTreeWalker(piece, NodeFilter.SHOW_TEXT);
      for (let node; (node = walker.nextNode());) {
        if (offset < node.length) {
          const char = document.createRange();
          char.setStart(node, offset);
          char.setEnd(node, offset + 1);
          const rect = char.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        offset -= node.length;
      }
    }
  }, phrase);
  assert.ok(point, 'visible phrase: ' + phrase);
  await page.mouse.click(point.x, point.y);
}

async function layoutSettled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('sentence controls, keyboard, semantic marks and layout preserve the reading position', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 880 } });
  try {
    const page = await load(context, 'lu-xun');
    await page.locator('#open-reader').click();
    const follow = page.locator('.ks-follow');
    const mark = page.locator('.ks-mark');
    const counter = page.locator('.ks-counter');
    const first = await counter.innerText();
    assert.equal(await activeSentence(page), '');
    await follow.click();
    assert.equal(await follow.getAttribute('aria-pressed'), 'true');
    assert.ok(await activeSentence(page));

    const phrase = '革命要革到老子身上';
    await clickPhrase(page, phrase);
    const selected = await activeSentence(page);
    assert.ok(selected.includes(phrase));
    await clickPhrase(page, phrase);
    assert.equal(await activeSentence(page), selected);
    await page.keyboard.press('ArrowDown');
    assert.match(await activeSentence(page), /这九个字的题目/);
    await page.locator('.ks-sentence-prev').click();
    assert.equal(await activeSentence(page), selected);
    await page.locator('.ks-sentence-next').click();
    await page.keyboard.press('ArrowUp');
    assert.equal(await activeSentence(page), selected);

    const visibleMark = page.locator('.ks-leaf:visible mark[data-ks-key]').first();
    const appearance = () => visibleMark.evaluate(el => {
      const css = getComputedStyle(el);
      return [css.backgroundColor, css.backgroundImage, css.color, css.fontWeight, css.textDecorationLine];
    });
    const enabled = await appearance();
    await mark.click();
    assert.equal(await mark.getAttribute('aria-pressed'), 'false');
    assert.notDeepEqual(await appearance(), enabled);
    assert.equal(await activeSentence(page), selected);
    await follow.click();
    assert.equal(await activeSentence(page), '');
    assert.equal(await mark.getAttribute('aria-pressed'), 'false');
    await mark.click();
    assert.deepEqual(await appearance(), enabled);
    assert.equal(await activeSentence(page), '');
    await follow.click();
    assert.equal(await activeSentence(page), selected);

    await page.keyboard.press('ArrowRight');
    assert.notEqual(await counter.innerText(), first);
    const turned = await activeSentence(page);
    assert.ok(turned && turned !== selected);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await counter.innerText(), first);
    await clickPhrase(page, phrase);
    await page.locator('.ks-larger').click();
    await layoutSettled(page);
    assert.ok((await activeSentence(page)).includes(phrase));
    await page.setViewportSize({ width: 390, height: 844 });
    await layoutSettled(page);
    assert.equal(await page.locator('.ks-leaf:visible').count(), 1);
    assert.ok((await activeSentence(page)).includes(phrase));
    await page.locator('.ks-exit').click();
    await layoutSettled(page);
    const restored = await page.locator('#article-body > p').filter({ hasText: phrase }).evaluate(p => {
      const rect = p.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight;
    });
    assert.ok(restored, 'the original paragraph is visible after exiting the reader');
    const sourceRange = await page.evaluate(() => {
      const [range] = CSS.highlights.get('ks-follow-sentence');
      return { source: !!range.startContainer.parentElement.closest('#article-body'), text: range.toString() };
    });
    assert.deepEqual(sourceRange, { source: true, text: selected });
    await page.locator('#open-reader').click();
    assert.ok((await activeSentence(page)).includes(phrase));
    const reopened = await load(context, 'lu-xun');
    await reopened.locator('#open-reader').click();
    await reopened.locator('.ks-follow').click();
    assert.ok((await activeSentence(reopened)).includes(phrase), 'a fresh visit resumes the saved sentence');
  } finally {
    await context.close();
  }
});

test('a sentence divided by a page break advances directly to the next original sentence', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 610 }, reducedMotion: 'reduce' });
  try {
    const page = await load(context, 'lu-xun');
    await page.locator('#open-reader').click();
    await page.locator('.ks-follow').click();
    let split;
    while (!await page.locator('.ks-next').isDisabled()) {
      await page.locator('.ks-next').click();
      split = await page.locator('.ks-leaf:visible .ks-body > :first-child').evaluate(piece => {
        const offset = Number(piece.dataset.ksOffset);
        if (!offset || piece.tagName !== 'P') return null;
        const source = document.querySelector('#article-body').children[Number(piece.dataset.ksBlock)];
        const parts = [...new Intl.Segmenter('zh', { granularity: 'sentence' }).segment(source.textContent)];
        const i = parts.findIndex(part => part.index < offset && offset < part.index + part.segment.length);
        if (i < 0 || !parts[i + 1]) return null;
        const current = parts[i];
        const until = Math.min(offset + piece.textContent.length, current.index + current.segment.length);
        return { original: current.segment.trim(), tail: source.textContent.slice(offset, until).trimEnd(),
          next: parts[i + 1].segment.trim() };
      });
      if (split) break;
    }
    assert.ok(split, 'sample has a sentence that continues onto the next page');
    assert.equal(await activeSentence(page), split.tail);
    await page.keyboard.press('ArrowDown');
    const next = await activeSentence(page);
    assert.ok(next && split.next.startsWith(next), 'down starts the following sentence');
    await page.keyboard.press('ArrowUp');
    const previous = await activeSentence(page);
    assert.ok(previous && split.original.startsWith(previous), 'up returns to the beginning of the split sentence');
  } finally {
    await context.close();
  }
});

test('the chapter ribbon navigates to the source heading and restores focus and position', async () => {
  for (const [sample, width] of [['d-opsd', 1440], ['su-yang', 390], ['lu-xun', 1440], ['atr', 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    try {
      const page = await load(context, sample);
      const headings = page.locator('#article-body > h2');
      const expected = await headings.allTextContents();
      await page.locator('#open-reader').click();
      await page.locator('.ks-follow').click();
      const ribbon = page.locator('.ks-contents-toggle');
      const contents = page.locator('.ks-contents');
      const chapters = contents.getByRole('button');
      await ribbon.click();
      assert.deepEqual(await chapters.allTextContents(), expected);

      const target = chapters.last();
      const block = await target.getAttribute('data-ks-chapter');
      await target.click();
      assert.ok(await contents.isHidden());
      assert.equal(await activeSentence(page), expected.at(-1));
      const heading = page.locator('.ks-leaf:visible [data-ks-block="' + block + '"]');
      assert.ok(await heading.isVisible());

      await ribbon.click();
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-current')), 'location');
      await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(() => document.activeElement.textContent), expected.at(-2));
      await page.keyboard.press('Escape');
      assert.ok(await page.locator('.ks-reader').isVisible());
      assert.ok(await contents.isHidden());
      assert.ok(await ribbon.evaluate(button => button === document.activeElement));
      await page.keyboard.press('Escape');
      await page.locator('.ks-reader').waitFor({ state: 'hidden' });
      await layoutSettled(page);
      assert.ok(await headings.last().evaluate(h => {
        const rect = h.getBoundingClientRect();
        return rect.top >= 0 && rect.top < innerHeight;
      }), sample + ' restores the chosen chapter on return');
    } finally {
      await context.close();
    }
  }
});
