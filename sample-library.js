(() => {
  'use strict';

  const original = {
    id: 'd-opsd',
    title: document.getElementById('question-title').textContent,
    author: document.querySelector('[data-reader-author]').textContent,
    kind: '知乎回答',
  };
  const samples = [original, ...(window.READING_SAMPLES || []).filter(Boolean)];
  const sampleIds = new Set(samples.map(sample => sample.id));
  for (const article of window.ZHIHU_OFFLINE_ARTICLES || []) {
    if (!article?.id || !article.title || !(article.bodyHtml || Array.isArray(article.sections)) || sampleIds.has(article.id)) continue;
    samples.push(article);
    sampleIds.add(article.id);
  }
  const requestedId = new URLSearchParams(location.search).get('sample') || original.id;
  const selected = samples.find(sample => sample.id === requestedId);
  const current = selected || original;
  const sampleBySource = new Map();
  for (const sample of samples) {
    const link = sourceLink('', sample.url);
    if (link?.host) sampleBySource.set(link.origin + link.pathname, sample.id);
  }

  function element(tag, text, className) {
    const item = document.createElement(tag);
    if (text != null) item.textContent = text;
    if (className) item.className = className;
    return item;
  }

  function pageURL(id) {
    const url = new URL(location.href);
    url.searchParams.set('sample', id);
    url.searchParams.delete('reader');
    url.hash = '';
    return url.href;
  }

  function sourceLink(title, url) {
    if (!/^https?:\/\//i.test(url || '')) return null;
    const link = element('a', title);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  const localImage = window.zhihuLocalImageURL;
  function appendRichBody(article, html, toc) {
    window.renderZhihuBody(article, html, {toc, resolveLink(url) {
      const id = sampleBySource.get(url);
      return id ? pageURL(id) : '';
    }});
  }

  function appendTable(article, data, heading) {
    const table = element('table', null, 'sample-table');
    if (heading) table.setAttribute('aria-label', heading);
    const head = table.createTHead().insertRow();
    for (const header of data.headers) {
      const cell = element('th', header);
      cell.scope = 'col';
      head.append(cell);
    }
    const body = table.createTBody();
    for (const values of data.rows) {
      const row = body.insertRow();
      for (const value of values) row.insertCell().textContent = value;
    }
    article.append(table);
  }

  function appendFigure(article, block) {
    const src = localImage(block.src);
    if (!src) return;
    const figure = element('figure');
    const image = element('img');
    image.src = src;
    image.alt = block.alt || '';
    if (block.width > 0 && block.height > 0) {
      image.width = block.width;
      image.height = block.height;
    }
    figure.append(image);
    if (block.caption) figure.append(element('figcaption', block.caption));
    article.append(figure);
  }

  function renderCaptured(sample) {
    const get = selector => document.querySelector(selector);
    const column = sample.type === 'article';
    const meta = sample.detailMeta || {};
    document.title = sample.title + ' - 知乎';
    document.body.classList.add(column ? 'feed-column' : 'feed-answer');
    const title = get('#question-title');
    title.textContent = sample.title;
    get('.scroll-title').textContent = sample.title;
    const description = get('.question-description');
    const questionText = Array.from(meta.questionDescription || sample.lead || '');
    if (questionText.length > 86) {
      const extra = get('#question-extra');
      const toggle = get('#question-expand');
      extra.textContent = questionText.slice(86).join('');
      description.replaceChildren(questionText.slice(0,86).join(''), extra, toggle);
    } else if (questionText.length) description.textContent = questionText.join('');
    else description.remove();
    const topics = get('.topics');
    topics.replaceChildren(...(meta.topics || []).map(name => element('span', name)));
    if (!topics.childElementCount) topics.remove();
    const stats = get('.stat-pair');
    stats.replaceChildren();
    for (const [key, label] of [['followers','关注者'],['views','被浏览']]) {
      if (meta[key] == null || meta[key] === '') continue;
      const item = element('div', label);
      const count = element('b', meta[key]);
      if (key === 'followers' && /^[\d,]+$/.test(meta[key])) count.dataset.followTotal = '';
      item.append(count);
      stats.append(item);
    }
    get('.question-stats > p').remove();
    if (!stats.childElementCount) get('.question-stats').remove();
    for (const selector of ['.related','.column-end','.gift']) get(selector).remove();
    const columnTag = get('.column-tag');
    if (meta.column) columnTag.textContent = meta.column;
    else columnTag.remove();
    get('#question-comments').remove();
    const questionLink = sourceLink(meta.answersLabel || '查看全部回答', sample.url?.replace(/\/answer\/\d+.*$/, ''));
    const allAnswers = get('.all-answers');
    if (!column && questionLink) {
      questionLink.className = allAnswers.className;
      allAnswers.replaceWith(questionLink);
    } else allAnswers.remove();

    const author = get('.author-line [data-reader-author]');
    author.textContent = sample.author || '';
    if (!meta.verified) get('.author-line .verified-ic').remove();
    const bio = get('.author-line p');
    if (meta.bio) bio.textContent = meta.bio;
    else bio.remove();
    if (!column && meta.date) author.parentElement.append(element('span', meta.date, 'captured-date'));
    get('.author-line [data-follow-author]').textContent = '关注';
    const avatar = get('.author-avatar');
    if (localImage(sample.avatar)) avatar.src = localImage(sample.avatar);
    else avatar.remove();
    const about = get('.about-detail');
    const person = element('div', null, 'about-person');
    if (avatar.isConnected) person.append(avatar.cloneNode(false));
    const profile = sourceLink(sample.author, meta.profileUrl);
    if (profile) { profile.replaceChildren(element('b', sample.author)); person.append(profile); }
    else person.append(element('b', sample.author));
    about.replaceChildren(person);
    if (meta.bio) about.append(element('p', meta.bio, 'about-bio'));
    const originalLink = sourceLink(column ? '查看原文 ↗' : '查看原回答 ↗', sample.url);
    if (originalLink) about.append(originalLink);

    const upvotes = sample.upvotes == null ? '' : String(sample.upvotes);
    get('#vote').textContent = ('▲ 赞同 ' + upvotes).trim();
    if (upvotes) get('.agree-line').textContent = upvotes + (column ? ' 人赞同了该文章' : ' 人赞同了该回答 ›');
    else get('.agree-line').remove();
    get('#save span').textContent = sample.favorites ?? '收藏';
    get('#like span').textContent = sample.likes ?? '喜欢';
    if (sample.comments != null) get('#comments-btn').lastChild.textContent = sample.comments + ' 条评论';

    const article = get('#article-body');
    article.replaceChildren();
    article.setAttribute('aria-labelledby', 'question-title');
    article.removeAttribute('aria-label');
    const toc = get('#toc-links');
    toc.replaceChildren();
    appendRichBody(article, sample.bodyHtml, toc);
    if (!toc.childElementCount) get('.toc-rail').remove();
    if (column) {
      if (meta.date) article.after(element('p', meta.date, 'captured-date column-post-date'));
      get('.answer-head').prepend(title);
      get('#question').remove();
      get('.answer-head').id = 'question';
      const hero = localImage(meta.hero);
      if (hero) {
        const image = element('img', null, 'captured-cover');
        image.src = hero;
        image.alt = '';
        get('.answer-card').prepend(image);
      }
      document.querySelectorAll('.side-rail .side-ad,.scroll-action').forEach(node => node.remove());
      const recommended = element('section', null, 'panel related column-related');
      recommended.append(element('h2', '推荐阅读'));
      const articles = samples.filter(item => item.bodyHtml && item.id !== sample.id);
      for (const item of articles.slice(0, 3)) {
        const link = element('a', item.title);
        link.href = pageURL(item.id);
        recommended.append(link);
      }
      if (articles.length) get('.hot-card').after(recommended);
    }
  }

  function renderArticle(sample) {
    document.title = sample.title + ' · 看山陪读';
    document.body.classList.add('sample-view');
    document.querySelector('.scroll-title').textContent = sample.title;
    const brand = document.querySelector('.topbar .brand');
    brand.after(element('span', '专栏', 'sample-masthead'));
    const menuButton = element('button', '切换样本', 'sample-menu-button');
    menuButton.type = 'button';
    menuButton.dataset.openSamples = '';
    menuButton.setAttribute('aria-haspopup', 'dialog');
    const actions = document.querySelector('.top-actions');
    actions.replaceChildren(menuButton,actions.querySelector('.viewer'));
    document.getElementById('question').remove();
    const page = element('main', null, 'sample-layout');
    page.innerHTML = `
      <header id="question" class="sample-heading">
        <div class="sample-context"><button type="button" data-open-samples>阅读样本</button><span aria-hidden="true">/</span><span class="sample-kind"></span></div>
        <h1 id="question-title"></h1><div class="sample-byline"></div>
        <div class="sample-details"></div>
        <p class="sample-description"></p>
      </header>
      <aside class="sample-toc"><div class="sample-toc-inner">
        <div class="sample-toc-head"><b>文章目录</b><button id="toc-toggle" aria-controls="toc-links" aria-expanded="true">收起</button></div>
        <nav id="toc-links" aria-label="文章目录"></nav>
      </div></aside>
      <div class="sample-paper">
        <article id="article-body" aria-labelledby="question-title"></article>
        <footer class="sample-end"><button type="button" data-open-samples>选择其他样本 ›</button><button type="button" id="tool-reader">打开双页陪读</button></footer>
      </div>`;
    document.querySelector('main.layout').replaceWith(page);
    page.querySelector('h1').textContent = sample.title;
    page.querySelector('.sample-kind').textContent = sample.kind;
    const author = element('span', sample.author);
    author.dataset.readerAuthor = sample.author;
    const byline = page.querySelector('.sample-byline');
    if (localImage(sample.avatar)) {
      const picture = element('img', null, 'author-avatar');
      picture.src = localImage(sample.avatar);
      picture.alt = '';
      byline.append(picture);
    }
    byline.append(author);
    const originalLink = sourceLink('查看来源 ↗', sample.url);
    if (originalLink) byline.append(originalLink);
    const details = page.querySelector('.sample-details');
    if (sample.column) details.append(element('span', '收录于 · ' + sample.column, 'sample-column'));
    if (sample.upvotes != null) {
      details.append(element('span', sample.upvotes.toLocaleString('zh-CN') + ' 人赞同了该文章', 'sample-upvotes'));
    }
    if (!details.childElementCount) details.remove();
    const description = page.querySelector('.sample-description');
    if (sample.description) description.textContent = sample.description;
    else description.remove();
    const article = page.querySelector('#article-body');
    const toc = page.querySelector('#toc-links');
    if (sample.bodyHtml) appendRichBody(article, sample.bodyHtml, toc);
    (sample.sections || []).forEach((section, index) => {
      if (section.heading) {
        const heading = element('h2', section.heading);
        heading.id = 'section-' + (index + 1);
        article.append(heading);
        const link = element('a', section.heading);
        link.href = '#' + heading.id;
        toc.append(link);
      }
      for (const text of section.paragraphs || []) article.append(element('p', text));
      for (const block of section.blocks || []) {
        if (block.type === 'paragraph') article.append(element('p', block.text));
        if (block.type === 'image') appendFigure(article, block);
      }
      if (section.table) appendTable(article, section.table, section.heading);
    });
    if (sample.attribution || sample.sourceLinks?.length) {
      const sources = element('div', null, 'sample-sources');
      sources.append(element('h3', '来源与署名'));
      if (sample.attribution) sources.append(element('p', sample.attribution));
      const refs = element('ul');
      for (const ref of sample.sourceLinks || []) {
        const link = sourceLink(ref.label, ref.url);
        if (!link) continue;
        const item = element('li');
        item.append(link);
        refs.append(item);
      }
      if (refs.childElementCount) sources.append(refs);
      article.append(sources);
    }
    if (!toc.childElementCount) page.querySelector('.sample-toc').remove();
  }

  if (selected && selected !== original) {
    if (selected.bodyHtml) renderCaptured(selected);
    else renderArticle(selected);
  }

  // Match against the full paragraph, so an edited article never inherits a stale excerpt.
  // Wrap text within each original inline element to keep links and author formatting intact.
  function markExcerpt(block, excerpt, key) {
    const content = block.textContent;
    const start = content.indexOf(excerpt);
    if (start < 0 || content.indexOf(excerpt, start + 1) >= 0) return;
    const end = start + excerpt.length;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const ranges = [];
    let offset = 0;
    for (let node = walker.nextNode(); node && offset < end; node = walker.nextNode()) {
      const next = offset + node.length;
      if (next > start && offset < end && node.length) {
        if (node.parentElement.closest('math, svg, code, pre, .transcription-gap, [data-formula]')) return;
        const range = document.createRange();
        range.setStart(node, Math.max(0, start - offset));
        range.setEnd(node, Math.min(node.length, end - offset));
        ranges.push(range);
      }
      offset = next;
    }
    for (const range of ranges) {
      const mark = element('mark');
      mark.dataset.ksKey = key;
      range.surroundContents(mark);
    }
  }

  const prose = document.getElementById('article-body').querySelectorAll(':scope > p, :scope > ul > li, :scope > ol > li');
  const highlights = window.READING_HIGHLIGHTS?.[current.id];
  prose.forEach((block, index) => {
    const excerpt = highlights?.[block.textContent];
    if (typeof excerpt === 'string' && excerpt) markExcerpt(block, excerpt, String(index));
  });

  const library = element('dialog', null, 'sample-library');
  library.id = 'sample-library';
  library.setAttribute('aria-labelledby', 'library-title');
  library.innerHTML = `
    <div class="library-head"><h2 id="library-title">选择阅读样本</h2>
      <form method="dialog"><button aria-label="关闭样本列表" title="关闭" autofocus>×</button></form></div>
    <nav class="library-list" aria-label="阅读样本列表"></nav>`;
  const list = library.querySelector('.library-list');
  for (const sample of samples) {
    const link = element('a', null, 'library-link');
    link.href = pageURL(sample.id);
    const title = element('strong', sample.title);
    const meta = element('span', [sample.kind, sample.author].filter(Boolean).join(' · '), 'library-meta');
    if (sample.id === current.id) {
      link.setAttribute('aria-current', 'page');
      meta.append(element('span', '当前', 'library-active'));
    }
    link.append(meta, title);
    list.append(link);
  }
  if (samples.length > 12) {
    const search = element('input', null, 'library-search');
    search.type = 'search';
    search.placeholder = '搜索标题或作者';
    search.setAttribute('aria-label', search.placeholder);
    library.querySelector('.library-head form').before(search);
    const empty = element('p', '没有找到匹配的文章', 'library-note');
    empty.hidden = true;
    list.after(empty);
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      for (const link of list.children) link.hidden = !link.textContent.toLocaleLowerCase().includes(query);
      empty.hidden = Boolean(list.querySelector('a:not([hidden])'));
    });
    list.addEventListener('keydown', event => {
      if (event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const visible = list.querySelectorAll('a:not([hidden])');
      visible[event.key === 'Home' ? 0 : visible.length - 1]?.focus();
    });
  }
  document.body.append(library);
  const open = () => { if (!library.open) library.showModal(); };
  document.querySelectorAll('#open-samples,[data-open-samples]').forEach(button => button.addEventListener('click', open));
  library.addEventListener('click', event => {
    if (event.target !== library) return;
    const rect = library.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) library.close();
  });
  if (!selected) {
    const note = element('p', '这个样本链接已失效，请选择下方的文章。', 'library-note');
    list.before(note);
    open();
  }
})();
